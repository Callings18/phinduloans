import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Legacy send-sms entrypoint — ExciteSMS only (Twilio / Africa's Talking removed).
 * Prefer calling excite-sms or send-notification for new code.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  to: string | string[];
  message: string;
  userId?: string;
  title?: string;
}

function cleanApiToken(token: string): string {
  return (token || "").trim().replace(/^Bearer\s+/i, "").trim();
}

function formatZambianPhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.substring(1);
  if (cleaned.startsWith("0") && cleaned.length === 10) cleaned = "260" + cleaned.substring(1);
  if (cleaned.length === 9 && !cleaned.startsWith("260")) cleaned = "260" + cleaned;
  if (!cleaned.startsWith("260") && cleaned.length >= 9) cleaned = "260" + cleaned;
  return cleaned;
}

async function getExciteSmsCredentials(supabase: ReturnType<typeof createClient>) {
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
  const baseUrl = (
    Deno.env.get("EXCITESMS_API_URL")
    || providers.excitesms_api_url
    || config.excitesms_api_url
    || "https://gateway.excitesms.com/api/v3"
  )
    .replace("gateway.excitesms.tech", "gateway.excitesms.com")
    .replace(/\/sms\/send\/?$/i, "")
    .replace(/\/+$/, "");

  return {
    apiUrl: `${baseUrl}/sms/send`,
    apiToken: cleanApiToken(Deno.env.get("EXCITESMS_API_TOKEN") || "")
      || cleanApiToken(providers.excitesms_api_token || config.excitesms_api_token || ""),
    senderId: providers.excitesms_sender_id || config.excitesms_sender_id || Deno.env.get("EXCITESMS_SENDER_ID") || "Phindu",
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const userId = claimsData.claims.sub as string;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", userId);
      const isStaff = roles?.some((r: any) => ["admin", "super_admin", "loan_officer", "finance_officer", "collections_officer", "credit_officer"].includes(r.role));
      if (!isStaff) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { apiToken, senderId, apiUrl } = await getExciteSmsCredentials(supabase);
    const { to, message, userId, title }: SMSRequest = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recipients = (Array.isArray(to) ? to : [to]).map(formatZambianPhone);

    if (!apiToken) {
      for (const recipient of recipients) {
        await supabase.from("notification_logs").insert({
          user_id: userId || null,
          type: "sms",
          recipient,
          title: title || "SMS Notification",
          message,
          status: "pending_config",
          provider_response: { note: "EXCITESMS_API_TOKEN not configured" },
        });
      }
      return new Response(
        JSON.stringify({ success: false, error: "ExciteSMS is not configured. Set EXCITESMS_API_TOKEN." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[SMS] ExciteSMS sending to:", recipients.join(", "));

    const results = [];
    for (const recipient of recipients) {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          recipient,
          sender_id: senderId,
          type: "plain",
          message,
        }),
      });
      const result = await response.json().catch(() => ({ status: "error", message: "Invalid JSON" }));
      const ok = response.ok && result?.status !== "error";
      await supabase.from("notification_logs").insert({
        user_id: userId || null,
        type: "sms",
        recipient,
        title: title || "SMS Notification",
        message,
        status: ok ? "sent" : "failed",
        sent_at: ok ? new Date().toISOString() : null,
        provider_response: { provider: "excitesms", ...result },
      });
      results.push({ recipient, ok, result });
    }

    const allOk = results.every((r) => r.ok);
    return new Response(
      JSON.stringify({
        success: allOk,
        message: allOk ? "SMS sent via ExciteSMS" : "One or more SMS failed",
        results,
      }),
      { status: allOk ? 200 : 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "SMS send failed";
    console.error("[SMS] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
