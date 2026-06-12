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

type SmsSettings = {
  excitesms: { apiUrl: string; apiToken: string; senderId: string };
  africastalking: { apiKey: string; username: string; senderId: string };
};

type SmsSendResult = {
  provider: "excitesms" | "africastalking";
  providerResponse: Record<string, unknown>;
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

async function getSmsSettings(supabase: any): Promise<SmsSettings> {
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

  return {
    excitesms: {
      apiUrl: rawApiUrl.replace("gateway.excitesms.tech", "gateway.excitesms.com").replace(/\/+$/, ""),
      apiToken: providers.excitesms_api_token || config.excitesms_api_token || Deno.env.get("EXCITESMS_API_TOKEN") || "",
      senderId: providers.excitesms_sender_id || config.excitesms_sender_id || Deno.env.get("EXCITESMS_SENDER_ID") || "PhinduLoans",
    },
    africastalking: {
      apiKey: providers.africastalking_api_key || config.africastalking_api_key || Deno.env.get("AFRICASTALKING_API_KEY") || "",
      username: providers.africastalking_username || config.africastalking_username || Deno.env.get("AFRICASTALKING_USERNAME") || "",
      senderId: providers.africastalking_sender_id || config.africastalking_sender_id || Deno.env.get("AFRICASTALKING_SENDER_ID") || "PHINDU",
    },
  };
}

function hasBackupProvider(settings: SmsSettings): boolean {
  return Boolean(settings.africastalking.apiKey && settings.africastalking.username);
}

async function sendViaExciteSms(to: string, message: string, settings: SmsSettings): Promise<SmsSendResult> {
  const creds = settings.excitesms;
  if (!creds.apiToken) throw new Error("Primary SMS provider is not configured");

  const phone = formatPhoneNumber(to).replace("+", "");
  const response = await fetch(`${creds.apiUrl}/sms/send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${creds.apiToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ recipient: phone, sender_id: creds.senderId, type: "plain", message }),
  });

  const responseText = await response.text();
  let result: any;
  try {
    result = JSON.parse(responseText);
  } catch {
    console.error(`[OTP] Primary provider returned non-JSON (${response.status})`);
    throw new Error("Primary SMS delivery failed");
  }

  const deliveryStatus = String(result?.data?.status || result?.status || "").toLowerCase();
  if (!response.ok || result?.status === "error" || ["failed", "rejected", "undelivered"].includes(deliveryStatus)) {
    console.error(`[OTP] Primary provider failed with status ${response.status}/${deliveryStatus || "unknown"}`);
    throw new Error("Primary SMS delivery failed");
  }

  return {
    provider: "excitesms",
    providerResponse: {
      provider: "excitesms",
      status: result?.status,
      provider_message: result?.message,
      data: {
        id: result?.data?.id,
        uid: result?.data?.uid,
        to: result?.data?.to,
        from: result?.data?.from,
        status: result?.data?.status,
        cost: result?.data?.cost,
        sms_count: result?.data?.sms_count,
      },
    },
  };
}

async function sendViaAfricasTalking(to: string, message: string, settings: SmsSettings): Promise<SmsSendResult> {
  const creds = settings.africastalking;
  if (!creds.apiKey || !creds.username) throw new Error("Backup SMS provider is not configured");

  const formattedPhone = formatPhoneNumber(to);
  const url = creds.username === "sandbox"
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const formData = new URLSearchParams();
  formData.append("username", creds.username);
  formData.append("to", formattedPhone);
  formData.append("message", message);
  if (creds.senderId) formData.append("from", creds.senderId);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "apiKey": creds.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: formData.toString(),
  });

  const result = await response.json().catch(() => null);
  const recipients = result?.SMSMessageData?.Recipients || [];
  const recipientStatus = recipients[0]?.status;
  if (!response.ok || !recipients.length || recipientStatus !== "Success") {
    console.error(`[OTP] Backup provider failed with status ${response.status}/${recipientStatus || "unknown"}`);
    throw new Error("Backup SMS delivery failed");
  }

  return {
    provider: "africastalking",
    providerResponse: {
      provider: "africastalking",
      status: recipientStatus,
      provider_message: result?.SMSMessageData?.Message,
      data: recipients[0],
    },
  };
}

async function deliverOtpSms(to: string, message: string, settings: SmsSettings, preferBackup: boolean): Promise<SmsSendResult> {
  if (preferBackup && hasBackupProvider(settings)) {
    try {
      return await sendViaAfricasTalking(to, message, settings);
    } catch (error) {
      console.error("[OTP] Backup provider failed; retrying with primary provider", error);
      return await sendViaExciteSms(to, message, settings);
    }
  }

  try {
    return await sendViaExciteSms(to, message, settings);
  } catch (error) {
    if (!hasBackupProvider(settings)) throw error;
    console.error("[OTP] Primary provider failed; retrying with backup provider", error);
    return await sendViaAfricasTalking(to, message, settings);
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
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
