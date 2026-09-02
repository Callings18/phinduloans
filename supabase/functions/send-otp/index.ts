import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  phone: string;
  purpose?: "signup" | "login" | "verify";
}

type ExciteSmsRoute = { apiUrl: string; apiToken: string; senderId: string; label: string };

type SmsSettings = {
  excitesms: { primary: ExciteSmsRoute; secondary?: ExciteSmsRoute };
};

type SmsSendResult = {
  provider: "excitesms";
  providerResponse: Record<string, unknown>;
};

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord => {
  return value && typeof value === "object" ? value as JsonRecord : {};
};

function formatPhoneNumber(phone: string): string {
  const formatted = phone.trim().replace(/\s+/g, "").replace(/[^0-9+]/g, "");

  if (formatted.startsWith("+260")) return formatted;
  if (formatted.startsWith("260")) return `+${formatted}`;
  if (formatted.startsWith("0")) return `+260${formatted.substring(1)}`;
  if (formatted.length === 9 && !formatted.startsWith("+")) return `+260${formatted}`;
  if (formatted.startsWith("+")) return formatted;
  return `+260${formatted}`;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Strip accidental Bearer prefix / whitespace that cause ExciteSMS "Unauthenticated". */
function cleanApiToken(token: string): string {
  return (token || "").trim().replace(/^Bearer\s+/i, "").trim();
}

function pickToken(...candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    const cleaned = cleanApiToken(candidate || "");
    if (cleaned) return cleaned;
  }
  return "";
}

function normalizeExciteSmsUrl(url: string): string {
  return (url || "https://gateway.excitesms.com/api/v3")
    .replace("gateway.excitesms.tech", "gateway.excitesms.com")
    .replace(/\/sms\/send\/?$/i, "")
    .replace(/\/+$/, "");
}

async function getSmsSettings(supabase: ReturnType<typeof createClient>): Promise<SmsSettings> {
  const { data: providersData } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_providers")
    .maybeSingle();

  const { data: configData } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_config")
    .maybeSingle();

  const providers = providersData?.value || {};
  const config = configData?.value || {};
  const rawApiUrl = providers.excitesms_api_url || config.excitesms_api_url || Deno.env.get("EXCITESMS_API_URL") || "https://gateway.excitesms.com/api/v3";
  // Prefer the env secret first so a stale AdminSettings token cannot force Unauthenticated.
  const primaryApiToken = pickToken(
    Deno.env.get("EXCITESMS_API_TOKEN"),
    providers.excitesms_api_token,
    config.excitesms_api_token,
  );
  const secondaryApiToken = pickToken(
    Deno.env.get("EXCITESMS_SECONDARY_API_TOKEN"),
    providers.excitesms_secondary_api_token,
    // Only use config token as secondary when it differs from the chosen primary.
    config.excitesms_api_token !== primaryApiToken ? config.excitesms_api_token : "",
    providers.excitesms_api_token !== primaryApiToken ? providers.excitesms_api_token : "",
  );
  const senderId = pickToken(
    providers.excitesms_sender_id,
    config.excitesms_sender_id,
    Deno.env.get("EXCITESMS_SENDER_ID"),
  ) || "Phindu";

  return {
    excitesms: {
      primary: {
        apiUrl: normalizeExciteSmsUrl(rawApiUrl),
        apiToken: primaryApiToken,
        senderId,
        label: "primary",
      },
      secondary: secondaryApiToken && secondaryApiToken !== primaryApiToken
        ? {
            apiUrl: normalizeExciteSmsUrl(rawApiUrl),
            apiToken: secondaryApiToken,
            senderId: pickToken(
              providers.excitesms_secondary_sender_id,
              providers.excitesms_sender_id,
              Deno.env.get("EXCITESMS_SECONDARY_SENDER_ID"),
              Deno.env.get("EXCITESMS_SENDER_ID"),
            ) || senderId,
            label: "secondary",
          }
        : undefined,
    },
  };
}

async function sendViaExciteSms(to: string, message: string, route: ExciteSmsRoute): Promise<SmsSendResult> {
  const creds = route;
  const apiToken = cleanApiToken(creds.apiToken);
  if (!apiToken) throw new Error("ExciteSMS is not configured. Set EXCITESMS_API_TOKEN in Supabase secrets / Admin Settings.");

  // ExciteSMS accepts Zambian MSISDNs as 260XXXXXXXXX (no "+"). Keep E.164 for logs.
  const e164 = formatPhoneNumber(to);
  const msisdn = e164.replace(/^\+/, "");
  console.log(`[OTP] ExciteSMS route=${route.label}, sender=${creds.senderId}, tokenLen=${apiToken.length}, urlHost=${new URL(creds.apiUrl).host}, to=${msisdn}`);

  const attempt = async (recipient: string, includeType: boolean) => {
    const body: Record<string, string> = {
      recipient,
      sender_id: creds.senderId,
      message,
    };
    if (includeType) body.type = "plain";

    const response = await fetch(`${creds.apiUrl}/sms/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      console.error(`[OTP] ExciteSMS returned non-JSON (${response.status}): ${responseText.slice(0, 200)}`);
      throw new Error("ExciteSMS delivery failed (invalid provider response)");
    }
    return { response, result: asRecord(parsedResult) };
  };

  // Prefer MSISDN without "+", then retry with "+" if the gateway rejects the first form.
  let response: Response;
  let result: JsonRecord;
  ({ response, result } = await attempt(msisdn, true));

  const deliveryStatus = String(asRecord(result.data).status || result.status || "").toLowerCase();
  const providerMsgFirst = String(result?.message || "").toLowerCase();
  const rejected = !response.ok || result?.status === "error" || ["failed", "rejected", "undelivered"].includes(deliveryStatus);

  if (rejected) {
    console.error(`[OTP] ExciteSMS ${route.label} first attempt failed status=${response.status}/${deliveryStatus || "unknown"}; message=${String(result?.message || "none").slice(0, 160)}`);
    // Auth failures won't be fixed by changing recipient format — fail fast with a clear message.
    if (response.status === 401 || providerMsgFirst.includes("unauthenticated") || providerMsgFirst.includes("unauthorized")) {
      throw new Error("ExciteSMS authentication failed (Unauthenticated). Update EXCITESMS_API_TOKEN in Supabase secrets and Admin → Settings.");
    }
    try {
      ({ response, result } = await attempt(e164, false));
    } catch {
      // fall through to rejection handling below
    }
  }

  const data = asRecord(result.data);
  const finalStatus = String(data.status || result.status || "").toLowerCase();
  if (!response.ok || result?.status === "error" || ["failed", "rejected", "undelivered"].includes(finalStatus)) {
    const providerMsg = String(result?.message || data?.message || "").trim();
    console.error(`[OTP] ExciteSMS ${route.label} failed with status ${response.status}/${finalStatus || "unknown"}; message=${providerMsg.slice(0, 160)}`);
    if (/unauthenticated|unauthorized/i.test(providerMsg) || response.status === 401) {
      throw new Error("ExciteSMS authentication failed (Unauthenticated). Update EXCITESMS_API_TOKEN in Supabase secrets and Admin → Settings.");
    }
    const looksLikePhone = /^\+?260\d{9}$/.test(providerMsg.replace(/\s+/g, ""));
    throw new Error(
      looksLikePhone || !providerMsg
        ? "ExciteSMS rejected the OTP. Verify the approved sender ID and account balance."
        : `SMS delivery failed: ${providerMsg}`,
    );
  }

  return {
    provider: "excitesms",
    providerResponse: {
      provider: "excitesms",
      route: route.label,
      status: result?.status,
      provider_message: result?.message,
      data: {
        id: data.id,
        uid: data.uid,
        to: data.to,
        from: data.from,
        status: data.status,
        cost: data.cost,
        sms_count: data.sms_count,
      },
    },
  };
}

/** ExciteSMS only — no Twilio / Africa's Talking fallbacks. */
async function deliverOtpSms(to: string, message: string, settings: SmsSettings, preferSecondary: boolean): Promise<SmsSendResult> {
  const preferred = preferSecondary && settings.excitesms.secondary ? settings.excitesms.secondary : settings.excitesms.primary;
  const fallback = preferred === settings.excitesms.secondary ? settings.excitesms.primary : settings.excitesms.secondary;

  try {
    return await sendViaExciteSms(to, message, preferred);
  } catch (error) {
    if (fallback) {
      console.error("[OTP] Preferred ExciteSMS route failed; retrying alternate ExciteSMS token/route", error);
      return await sendViaExciteSms(to, message, fallback);
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { phone, purpose = 'signup' } = await req.json() as OTPRequest;

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`[OTP] Request for ${formattedPhone}, purpose: ${purpose}`);

    const { data: phoneProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", formattedPhone)
      .maybeSingle();

    if (phoneProfile?.id) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", phoneProfile.id);
      const staffRoles = new Set([
        "admin", "super_admin", "loan_officer", "credit_officer",
        "finance_officer", "collections_officer", "auditor", "support",
      ]);
      if (roles?.some((r: { role: string }) => staffRoles.has(r.role))) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Office staff sign in with email and password. Phone OTP is for borrowers only.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Check rate limiting - max 5 OTPs per phone in 10 minutes.
    // Resends are routed through the backup provider when available.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", formattedPhone)
      .gte("created_at", tenMinutesAgo);

    if (recentCount && recentCount >= 5) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many OTP requests. Please try again in 10 minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For login, check if user exists
    if (purpose === 'login') {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", formattedPhone)
        .maybeSingle();

      if (!existingProfile) {
        return new Response(
          JSON.stringify({ success: false, error: "No account found for this number. Please sign up first." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Store OTP in database
    const { data: otpRecord, error: insertError } = await supabase
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
      console.error("[OTP] Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = await getSmsSettings(supabase);
    const message = `Your Phindu Finance verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
    const sendResult = await deliverOtpSms(formattedPhone, message, settings, Boolean(recentCount && recentCount > 0));

    // Log best-effort only; do not fail OTP flow if notification_logs write fails.
    const { error: notificationLogError } = await supabase.from("notification_logs").insert({
      type: "sms",
      recipient: formattedPhone,
      title: "OTP Verification",
      message: "OTP code sent for verification",
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_response: sendResult.providerResponse,
    });
    if (notificationLogError) {
      console.error("[OTP] notification_logs insert failed (non-blocking):", notificationLogError);
    }

    console.log(`[OTP] Successfully sent to ${formattedPhone} via ${sendResult.provider}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP sent successfully",
        expiresIn: 300,
        provider: sendResult.provider,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[OTP] Error:", error);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const body = await req.clone().json().catch(() => null) as OTPRequest | null;
      if (body?.phone) {
        await supabase
          .from("otp_codes")
          .delete()
          .eq("phone", formatPhoneNumber(body.phone))
          .is("verified_at", null)
          .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString());
      }
    } catch {
      // cleanup best-effort only
    }
    const message = error instanceof Error ? error.message : "Failed to send verification code. Please try again.";
    const compact = message.replace(/\s+/g, "");
    const friendly =
      /^\+?260\d{9}$/.test(compact)
        ? "SMS delivery failed. Please check your phone number and try again."
        : message;
    return new Response(
      JSON.stringify({ success: false, error: friendly }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
