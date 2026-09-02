import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth-user";
import { SupabaseService } from "../auth/supabase.service";
import { apiFail } from "../common/http";

function normalizePhoneForAuth(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("260") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `260${digits.slice(1)}`;
  if (digits.length >= 9) return `260${digits}`;
  return digits;
}

function looksLikeDuplicateUserError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    message.includes("already been registered") ||
    message.includes("already registered") ||
    code === "email_exists" ||
    code === "phone_exists" ||
    code === "user_already_exists"
  );
}

@Injectable()
export class CoreWritesService {
  private readonly logger = new Logger(CoreWritesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async createBorrower(dto: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    nrc_number?: string;
    address?: string;
    city?: string;
    product_code?: string;
    gender?: string;
    marital_status?: string;
  }, actor: AuthUser) {
    const admin = this.supabase.getAdminClient();
    const full_name = dto.full_name.trim();
    if (!full_name) apiFail(HttpStatus.BAD_REQUEST, "NAME_REQUIRED", "Full name is required");

    const normalizedPhone = normalizePhoneForAuth(dto.phone);
    let email = dto.email?.trim() || null;

    const nameSlug =
      full_name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "borrower";
    const syntheticEmail = !email
      ? normalizedPhone
        ? `${normalizedPhone}@phone.phindu.local`
        : `${nameSlug}.${Date.now()}@borrower.phindu.local`
      : null;
    const authEmail = email || syntheticEmail!;
    const profileEmail = email;

    const tempPassword = `${randomUUID().slice(0, 10)}Aa1!`;
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      ...(normalizedPhone ? { phone: normalizedPhone, phone_confirm: true } : {}),
      user_metadata: { full_name },
    });

    const upsertProfile = async (userId: string) => {
      const { error } = await admin.from("profiles").upsert(
        {
          id: userId,
          email: profileEmail,
          full_name,
          phone: normalizedPhone || null,
          nrc_number: dto.nrc_number || null,
          address: dto.address || null,
          city: dto.city || null,
          gender: dto.gender || null,
          marital_status: dto.marital_status || null,
        },
        { onConflict: "id" },
      );
      if (error) apiFail(HttpStatus.BAD_REQUEST, "PROFILE_FAILED", error.message);
    };

    const linkHouse = async (userId: string) => {
      if (!dto.product_code) return;
      const { error } = await admin.from("product_house_borrowers").upsert(
        { product_code: dto.product_code, borrower_id: userId, added_by: actor.userId },
        { onConflict: "product_code,borrower_id" },
      );
      if (error) apiFail(HttpStatus.BAD_REQUEST, "HOUSE_LINK_FAILED", error.message);
    };

    if (createError) {
      if (!looksLikeDuplicateUserError(createError)) {
        apiFail(HttpStatus.BAD_REQUEST, "CREATE_USER_FAILED", createError.message);
      }

      const profileFilters: string[] = [];
      if (authEmail) profileFilters.push(`email.eq.${authEmail}`);
      if (normalizedPhone) profileFilters.push(`phone.eq.${normalizedPhone}`);
      let foundId: string | null = null;
      if (profileFilters.length) {
        const { data: profileMatches } = await admin
          .from("profiles")
          .select("id")
          .or(profileFilters.join(","))
          .limit(1);
        foundId = profileMatches?.[0]?.id ?? null;
      }
      if (!foundId) {
        let page = 1;
        while (!foundId && page <= 20) {
          const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 100 });
          if (listError || !listData.users.length) break;
          const match = listData.users.find(
            (u) => u.email === authEmail || (normalizedPhone ? u.phone === normalizedPhone : false),
          );
          if (match) foundId = match.id;
          if (listData.users.length < 100) break;
          page += 1;
        }
      }
      if (!foundId) {
        apiFail(HttpStatus.BAD_REQUEST, "DUPLICATE_UNRESOLVED", createError.message);
      }
      await upsertProfile(foundId);
      await linkHouse(foundId);
      return {
        ok: true,
        success: true,
        user_id: foundId,
        existing: true,
        message: profileEmail
          ? `Borrower profile updated. This email (${profileEmail}) was already registered.`
          : "Borrower profile updated. This phone number was already registered.",
      };
    }

    const userId = newUser.user!.id;
    await upsertProfile(userId);
    await admin.from("user_roles").insert({ user_id: userId, role: "user" });
    await linkHouse(userId);
    return {
      ok: true,
      success: true,
      user_id: userId,
      existing: false,
      message: "Borrower created successfully",
    };
  }

  async createApplication(
    dto: { application: Record<string, unknown>; borrowers?: Record<string, unknown>[]; productCode?: string },
    actor: AuthUser,
  ) {
    const admin = this.supabase.getAdminClient();
    const application = {
      ...dto.application,
      user_id: actor.actorType === "admin" ? (dto.application.user_id as string) : actor.userId,
    };
    if (!application.user_id) {
      apiFail(HttpStatus.BAD_REQUEST, "USER_REQUIRED", "Application is missing user_id");
    }
    if (actor.actorType !== "admin" && application.user_id !== actor.userId) {
      apiFail(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot create an application for another user");
    }

    const { data: inserted, error } = await admin
      .from("loan_applications")
      .insert(application)
      .select("id")
      .single();
    if (error || !inserted) {
      apiFail(HttpStatus.BAD_REQUEST, "APPLICATION_INSERT_FAILED", error?.message ?? "Insert failed");
    }

    if (dto.borrowers?.length) {
      const rows = dto.borrowers.map((row) => ({
        ...row,
        loan_application_id: inserted.id,
        created_by: actor.userId,
      }));
      const { error: borrowersErr } = await admin.from("loan_borrowers").insert(rows);
      if (borrowersErr) this.logger.warn(`loan_borrowers insert: ${borrowersErr.message}`);
    }

    if (dto.productCode) {
      const { error: houseErr } = await admin.from("product_house_borrowers").upsert(
        { product_code: dto.productCode, borrower_id: application.user_id as string, added_by: actor.userId },
        { onConflict: "product_code,borrower_id" },
      );
      if (houseErr) this.logger.warn(`house roster: ${houseErr.message}`);
    }

    return { ok: true, data: { id: inserted.id } };
  }

  async recordPayment(
    repaymentId: string,
    dto: {
      amount: number;
      paymentMethod?: string;
      accountId?: string | null;
      transactionReference?: string;
      paidDate?: string;
      penaltyAmount?: number;
    },
  ) {
    const admin = this.supabase.getAdminClient();
    const args: Record<string, unknown> = {
      p_repayment_id: repaymentId,
      p_amount: dto.amount,
      p_payment_method: dto.paymentMethod || "cash",
      p_account_id: dto.accountId || null,
      p_transaction_reference: dto.transactionReference || `PAY-${Date.now()}`,
      p_paid_date: dto.paidDate || new Date().toISOString().slice(0, 10),
    };
    if (dto.penaltyAmount !== undefined && dto.penaltyAmount > 0) {
      args.p_penalty_amount = dto.penaltyAmount;
    }
    const { data, error } = await admin.rpc("record_loan_payment", args);
    if (error) apiFail(HttpStatus.BAD_REQUEST, "PAYMENT_RPC_FAILED", error.message);
    const rpc = data as { success?: boolean; error?: string } | null;
    if (rpc && rpc.success === false) {
      apiFail(HttpStatus.CONFLICT, "PAYMENT_REJECTED", rpc.error || "Failed to record payment");
    }
    return { ok: true, data: rpc };
  }

  async createStaff(
    dto: { email: string; full_name: string; role: string; phone?: string | null },
    actor: AuthUser,
  ) {
    const isAdmin = actor.roles.includes("admin") || actor.roles.includes("super_admin");
    if (!isAdmin) apiFail(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "Only admins can create staff users");

    const validRoles = [
      "super_admin",
      "admin",
      "loan_officer",
      "credit_officer",
      "finance_officer",
      "collections_officer",
      "auditor",
      "support",
    ];
    if (!validRoles.includes(dto.role)) {
      apiFail(HttpStatus.BAD_REQUEST, "INVALID_ROLE", `Invalid role: ${dto.role}`);
    }

    const email = dto.email.trim().toLowerCase();
    const full_name = dto.full_name.trim();
    if (!email || !full_name) apiFail(HttpStatus.BAD_REQUEST, "FIELDS_REQUIRED", "email and full_name are required");

    const admin = this.supabase.getAdminClient();
    const tempPassword = `${randomUUID().slice(0, 12)}A1!`;
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createError || !newUser.user) {
      apiFail(HttpStatus.BAD_REQUEST, "CREATE_STAFF_FAILED", createError?.message || "Failed to create staff user");
    }

    const userId = newUser.user.id;
    await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      phone: dto.phone || null,
    });
    const { error: roleErr } = await admin.from("user_roles").upsert(
      { user_id: userId, role: dto.role },
      { onConflict: "user_id,role" },
    );
    if (roleErr) this.logger.warn(`staff role upsert: ${roleErr.message}`);

    return {
      ok: true,
      success: true,
      user_id: userId,
      temp_password: tempPassword,
      message: "Staff user created. Share the temporary password with them securely.",
    };
  }
}
