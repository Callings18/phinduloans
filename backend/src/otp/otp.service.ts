import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isStaffRole } from "../auth/staff-roles";
import { SupabaseService } from "../auth/supabase.service";
import { apiFail } from "../common/http";
import { deliverOtpSms, getSmsSettings } from "./excite-sms";
import type { SendOtpDto, VerifyOtpDto } from "./otp.dto";
import { formatPhoneNumber } from "./phone";

type OtpPurpose = "signup" | "login" | "verify";

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async send(dto: SendOtpDto) {
    const admin = this.supabase.getAdminClient();
    const purpose: OtpPurpose = dto.purpose ?? "signup";
    const formattedPhone = formatPhoneNumber(dto.phone);
    this.logger.log(`OTP send ${formattedPhone} purpose=${purpose}`);

    const { data: phoneProfile } = await admin.from("profiles").select("id").eq("phone", formattedPhone).maybeSingle();
    if (phoneProfile?.id) {
      await this.assertNotStaff(admin, phoneProfile.id);
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", formattedPhone)
      .gte("created_at", tenMinutesAgo);

    if (recentCount && recentCount >= 5) {
      apiFail(HttpStatus.TOO_MANY_REQUESTS, "OTP_RATE_LIMIT", "Too many OTP requests. Please try again in 10 minutes.");
    }

    if (purpose === "login") {
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("phone", formattedPhone)
        .maybeSingle();
      if (!existingProfile) {
        apiFail(HttpStatus.NOT_FOUND, "NO_ACCOUNT", "No account found for this number. Please sign up first.");
      }
    }

    const otp = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { error: insertError } = await admin
      .from("otp_codes")
      .insert({
        phone: formattedPhone,
        code: otp,
        expires_at: expiresAt.toISOString(),
        purpose,
      })
      .select("id")
      .single();

    if (insertError) {
      this.logger.error(`store OTP failed: ${insertError.message}`);
      apiFail(HttpStatus.INTERNAL_SERVER_ERROR, "OTP_STORE_FAILED", "Failed to generate OTP");
    }

    try {
      const settings = await getSmsSettings(admin);
      const message = `Your Phindu Finance verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
      const sendResult = await deliverOtpSms(formattedPhone, message, settings, Boolean(recentCount && recentCount > 0));
      const { error: logErr } = await admin.from("notification_logs").insert({
        type: "sms",
        recipient: formattedPhone,
        title: "OTP Verification",
        message: "OTP code sent for verification",
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_response: sendResult.providerResponse,
      });
      if (logErr) this.logger.warn(`notification_logs insert failed: ${logErr.message}`);

      return {
        success: true,
        message: "OTP sent successfully",
        expiresIn: 300,
        provider: sendResult.provider,
      };
    } catch (error: unknown) {
      await admin
        .from("otp_codes")
        .delete()
        .eq("phone", formattedPhone)
        .is("verified_at", null)
        .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString());
      const message = error instanceof Error ? error.message : "Failed to send verification code. Please try again.";
      const compact = message.replace(/\s+/g, "");
      const friendly = /^\+?260\d{9}$/.test(compact)
        ? "SMS delivery failed. Please check your phone number and try again."
        : message;
      apiFail(HttpStatus.INTERNAL_SERVER_ERROR, "OTP_SMS_FAILED", friendly);
    }
  }

  async verify(dto: VerifyOtpDto) {
    const admin = this.supabase.getAdminClient();
    const purpose: OtpPurpose = dto.purpose ?? "signup";
    const formattedPhone = formatPhoneNumber(dto.phone);

    await admin
      .from("otp_codes")
      .delete()
      .eq("phone", formattedPhone)
      .eq("purpose", purpose)
      .is("verified_at", null)
      .lt("expires_at", new Date().toISOString());

    const { data: otpRecords, error: fetchError } = await admin
      .from("otp_codes")
      .select("*")
      .eq("phone", formattedPhone)
      .eq("purpose", purpose)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(5);

    if (fetchError || !otpRecords?.length) {
      apiFail(HttpStatus.BAD_REQUEST, "OTP_NOT_FOUND", "No pending OTP found. Please request a new code.");
    }

    const otpRecord = otpRecords.find((record: { code: string }) => record.code === dto.code);
    if (!otpRecord) {
      const newest = otpRecords[0] as { id: string; attempts: number };
      await admin.from("otp_codes").update({ attempts: newest.attempts + 1 }).eq("id", newest.id);
      apiFail(HttpStatus.BAD_REQUEST, "OTP_INVALID", "Invalid OTP.");
    }

    const matched = otpRecord as { id: string; attempts: number; max_attempts: number };
    if (matched.attempts >= matched.max_attempts) {
      await admin.from("otp_codes").delete().eq("id", matched.id);
      apiFail(HttpStatus.BAD_REQUEST, "OTP_MAX_ATTEMPTS", "Maximum attempts exceeded. Please request a new code.");
    }

    await admin
      .from("otp_codes")
      .update({ attempts: matched.attempts + 1, verified_at: new Date().toISOString() })
      .eq("id", matched.id);

    if (purpose === "signup") {
      return this.finishSignup(admin, formattedPhone, dto);
    }
    if (purpose === "login") {
      return this.finishLogin(admin, formattedPhone);
    }
    return { success: true, verified: true };
  }

  private getBorrowerDashboardUrl(): string {
    const base = (process.env.BORROWER_APP_URL || "https://app.phindu.com").replace(/\/+$/, "");
    return `${base}/dashboard`;
  }

  private async assertNotStaff(admin: SupabaseClient, userId: string) {
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const list = (roles ?? []).map((r: { role: string }) => r.role);
    if (isStaffRole(list)) {
      apiFail(
        HttpStatus.FORBIDDEN,
        "STAFF_USE_OFFICE",
        "Office staff sign in with email and password. Phone OTP is for borrowers only.",
      );
    }
  }

  private async findAuthUserByPhoneOrEmail(
    admin: SupabaseClient,
    formattedPhone: string,
    syntheticEmail: string,
  ): Promise<User | null> {
    const perPage = 200;
    const maxPages = 50;
    const phoneNoPlus = formattedPhone.replace(/^\+/, "");
    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        this.logger.error(`listUsers page ${page}: ${error.message}`);
        return null;
      }
      const users = data?.users ?? [];
      const match = users.find(
        (u) =>
          u.email === syntheticEmail ||
          u.user_metadata?.phone === formattedPhone ||
          u.phone === formattedPhone ||
          u.phone === phoneNoPlus,
      );
      if (match) return match;
      if (users.length < perPage) return null;
    }
    return null;
  }

  private async finishSignup(admin: SupabaseClient, formattedPhone: string, dto: VerifyOtpDto) {
    const safePhone = formattedPhone.replace(/[^0-9]/g, "");
    const syntheticEmail =
      dto.email && dto.email.includes("@") ? dto.email : `${safePhone}@phone.phindu.local`;
    const generatedPassword = dto.password || randomUUID() + randomUUID();

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("phone", formattedPhone)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.id;
    } else {
      const { data: newUser, error: signupError } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: dto.fullName || null,
          phone: formattedPhone,
        },
      });

      if (signupError || !newUser?.user) {
        const rawMsg = signupError?.message || "";
        const alreadyExists =
          (signupError as { code?: string; status?: number } | null)?.code === "email_exists" ||
          (signupError as { status?: number } | null)?.status === 422 ||
          /already been registered/i.test(rawMsg) ||
          /email_exists/i.test(rawMsg);

        if (alreadyExists) {
          const match = await this.findAuthUserByPhoneOrEmail(admin, formattedPhone, syntheticEmail);
          if (!match) {
            apiFail(
              HttpStatus.BAD_REQUEST,
              "ACCOUNT_EXISTS",
              "An account already exists for this number. Please try logging in.",
            );
          }
          userId = match.id;
        } else {
          this.logger.error(`signup: ${rawMsg}`);
          const looksLikePhone = /^\+?260\d{9}$/.test(rawMsg.replace(/\s+/g, ""));
          const friendly =
            looksLikePhone || /phone/i.test(rawMsg)
              ? "Could not create your account. Please try again or contact support."
              : rawMsg || "Failed to create account";
          apiFail(HttpStatus.BAD_REQUEST, "SIGNUP_FAILED", friendly);
        }
      } else {
        userId = newUser.user.id;
      }

      await admin
        .from("profiles")
        .update({
          phone: formattedPhone,
          full_name: dto.fullName || null,
          nrc_number: dto.nrcNumber || null,
          email: syntheticEmail.endsWith("@phone.phindu.local") ? null : syntheticEmail,
        })
        .eq("id", userId);
    }

    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
      options: { redirectTo: this.getBorrowerDashboardUrl() },
    });

    return {
      success: true,
      message: "Account ready",
      userId,
      verified: true,
      tokenHash: link?.properties?.hashed_token ?? null,
      magicLink: link?.properties?.action_link ?? null,
    };
  }

  private async finishLogin(admin: SupabaseClient, formattedPhone: string) {
    const { data: profile } = await admin.from("profiles").select("id, email").eq("phone", formattedPhone).maybeSingle();

    let loginEmail = profile?.email ?? null;
    let userId = profile?.id ?? null;

    if (!loginEmail || !userId) {
      const safePhone = formattedPhone.replace(/[^0-9]/g, "");
      const fallback = `${safePhone}@phone.phindu.local`;
      const match = await this.findAuthUserByPhoneOrEmail(admin, formattedPhone, fallback);
      if (match) {
        userId = match.id;
        loginEmail = match.email ?? fallback;
      } else {
        loginEmail = fallback;
      }
    }

    if (!userId || !loginEmail) {
      apiFail(HttpStatus.NOT_FOUND, "NO_ACCOUNT", "No account found for this number. Please sign up first.");
    }

    await this.assertNotStaff(admin, userId);

    const { data: sessionData, error: sessionError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: loginEmail,
      options: { redirectTo: this.getBorrowerDashboardUrl() },
    });

    if (sessionError) {
      this.logger.error(`generateLink: ${sessionError.message}`);
      apiFail(HttpStatus.INTERNAL_SERVER_ERROR, "SESSION_FAILED", "Failed to create session");
    }

    return {
      success: true,
      message: "Login successful",
      verified: true,
      userId,
      tokenHash: sessionData.properties?.hashed_token ?? null,
      magicLink: sessionData.properties?.action_link,
    };
  }
}
