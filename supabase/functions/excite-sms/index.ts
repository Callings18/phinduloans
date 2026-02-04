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

// Format Zambian phone numbers properly
function formatZambianPhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  
  // Remove leading + if present
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle local format starting with 0
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "260" + cleaned.substring(1);
  }
  
  // Handle 9-digit numbers (without country code or leading 0)
  if (cleaned.length === 9 && !cleaned.startsWith("260")) {
    cleaned = "260" + cleaned;
  }
  
  // If already has 260 prefix, use as is
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
  const baseUrl = providers.excitesms_api_url || config.excitesms_api_url || Deno.env.get("EXCITESMS_API_URL") || "https://gateway.excitesms.com/api/v3";
  const apiUrl = baseUrl.includes("/sms/send") ? baseUrl : baseUrl.replace(/\/?$/, "") + "/sms/send";
  return {
    apiUrl,
    apiToken: providers.excitesms_api_token || config.excitesms_api_token || Deno.env.get("EXCITESMS_API_TOKEN") || "",
    senderId: providers.excitesms_sender_id || config.excitesms_sender_id || Deno.env.get("EXCITESMS_SENDER_ID") || "Phindu",
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get ExciteSMS credentials from DB (Admin Settings) or env
    const creds = await getExciteSmsCredentials(supabase);
    const { apiToken, senderId, apiUrl } = creds;

    const { to, message, userId, title }: ExciteSMSRequest = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format recipients
    const recipients = Array.isArray(to) ? to : [to];
    const formattedRecipients = recipients.map(formatZambianPhone);

    console.log("[ExciteSMS] Sending to:", formattedRecipients.join(", "));
    console.log("[ExciteSMS] Message:", message.substring(0, 50) + "...");

    if (!apiToken) {
      console.log("[ExciteSMS] API token not configured - logging SMS only");
      
      for (const recipient of formattedRecipients) {
        await supabase.from("notification_logs").insert({
          user_id: userId || null,
          type: "sms",
          recipient: recipient,
          title: title || "SMS Notification",
          message: message,
          status: "pending_config",
          provider_response: { note: "ExciteSMS API token not configured", provider: "excitesms" }
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMS logged (ExciteSMS API token not configured)",
          simulated: true 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send SMS via ExciteSMS API
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
            result = { status: "error", message: "Invalid JSON response" };
          }
        } else {
          result = { status: "error", message: `Unexpected response (${response.status}): ${responseText.substring(0, 100)}` };
        }
        console.log(`[ExciteSMS] Response for ${recipient}:`, JSON.stringify(result));

        const isSuccess = response.ok && (result.status === "success" || result.success === true);

        // Log to database
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

        results.push({
          recipient,
          success: isSuccess,
          response: result
        });
      } catch (error: any) {
        console.error(`[ExciteSMS] Error sending to ${recipient}:`, error);
        
        await supabase.from("notification_logs").insert({
          user_id: userId || null,
          type: "sms",
          recipient: recipient,
          title: title || "SMS Notification",
          message: message,
          status: "failed",
          provider_response: { error: error.message, provider: "excitesms" }
        });

        results.push({
          recipient,
          success: false,
          error: error.message
        });
      }
    }

    const allSuccess = results.every(r => r.success);
    const anySuccess = results.some(r => r.success);

    return new Response(
      JSON.stringify({ 
        success: anySuccess,
        message: allSuccess ? "All SMS sent successfully" : (anySuccess ? "Some SMS sent" : "All SMS failed"),
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[ExciteSMS] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
