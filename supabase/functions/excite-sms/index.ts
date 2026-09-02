import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExciteSMSRequest {
  to: string | string[];
  message: string;
  userId?: string;
  title?: string;
}

function formatZambianPhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "260" + cleaned.substring(1);
  }
  if (cleaned.length === 9 && !cleaned.startsWith("260")) {
    cleaned = "260" + cleaned;
  }
  if (!cleaned.startsWith("260") && cleaned.length >= 9) {
    cleaned = "260" + cleaned;
  }
  return cleaned;
}

async function getExciteSmsCredentials(supabase: any): Promise<{
  apiUrl: string;
  apiToken: string;
  senderId: string;
}> {
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
  // Prefer the env secret first so a stale AdminSettings token cannot force Unauthenticated.
  const envToken = (Deno.env.get("EXCITESMS_API_TOKEN") || "").trim().replace(/^Bearer\s+/i, "").trim();
  const dbToken = (providers.excitesms_api_token || config.excitesms_api_token || "").trim().replace(/^Bearer\s+/i, "").trim();
  const baseUrl = Deno.env.get("EXCITESMS_API_URL") || providers.excitesms_api_url || config.excitesms_api_url || "https://gateway.excitesms.com/api/v3";
  const normalizedBase = baseUrl
    .replace("gateway.excitesms.tech", "gateway.excitesms.com")
    .replace(/\/sms\/send\/?$/i, "")
    .replace(/\/+$/, "");
  const apiUrl = `${normalizedBase}/sms/send`;
  return {
    apiUrl,
    apiToken: envToken || dbToken,
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Auth check: require authenticated staff/admin or service_role ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseKey) {
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
      const adminClient = createClient(supabaseUrl, supabaseKey);
      const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", userId);
      const isStaff = roles?.some((r: any) => ["admin", "super_admin", "loan_officer", "finance_officer", "collections_officer", "credit_officer"].includes(r.role));
      if (!isStaff) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const creds = await getExciteSmsCredentials(supabase);
    const { apiToken, senderId, apiUrl } = creds;

    const { to, message, userId, title }: ExciteSMSRequest = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recipients = Array.isArray(to) ? to : [to];
    const formattedRecipients = recipients.map(formatZambianPhone);

    console.log("[ExciteSMS] Sending to:", formattedRecipients.join(", "));

    if (!apiToken) {
      console.error("[ExciteSMS] API token not configured");
      
      for (const recipient of formattedRecipients) {
        await supabase.from("notification_logs").insert({
          user_id: userId || null,
          type: "sms",
          recipient: recipient,
          title: title || "SMS Notification",
          message: message,
          status: "pending_config",
          provider_response: { note: "SMS provider not configured" }
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMS queued for delivery"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const results = [];
    for (const recipient of formattedRecipients) {
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            recipient: recipient,
            sender_id: senderId,
            type: "plain",
            message: message,
          })
        });

        const contentType = response.headers.get("content-type") || "";
        const responseText = await response.text();
        let result: any;
        if (contentType.includes("application/json")) {
          try {
            result = JSON.parse(responseText);
          } catch {
            result = { status: "error", message: "Invalid provider response" };
          }
        } else {
          console.error(`[ExciteSMS] Non-JSON response (${response.status}): ${responseText.substring(0, 200)}`);
          result = { status: "error", message: "SMS delivery failed" };
        }
        console.log(`[ExciteSMS] Response for ${recipient}:`, JSON.stringify(result));

        const isSuccess = response.ok && (result.status === "success" || result.success === true);

        await supabase.from("notification_logs").insert({
          user_id: userId || null,
          type: "sms",
          recipient: recipient,
          title: title || "SMS Notification",
          message: message,
          status: isSuccess ? "sent" : "failed",
          sent_at: isSuccess ? new Date().toISOString() : null,
          provider_response: { ...result, provider: "excitesms" }
        });

        results.push({ recipient, success: isSuccess });
      } catch (error: any) {
        console.error(`[ExciteSMS] Error sending to ${recipient}:`, error);
        
        await supabase.from("notification_logs").insert({
          user_id: userId || null,
          type: "sms",
          recipient: recipient,
          title: title || "SMS Notification",
          message: message,
          status: "failed",
          provider_response: { error: "delivery_failed", provider: "excitesms" }
        });

        results.push({ recipient, success: false });
      }
    }

    const allSuccess = results.every(r => r.success);
    const anySuccess = results.some(r => r.success);

    return new Response(
      JSON.stringify({ 
        success: anySuccess,
        message: allSuccess ? "All SMS sent successfully" : (anySuccess ? "Some SMS sent" : "SMS delivery failed"),
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[ExciteSMS] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "SMS service temporarily unavailable" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
