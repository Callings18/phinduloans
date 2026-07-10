import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function normalizeExciteSmsUrl(url: string): string {
  return (url || "https://gateway.excitesms.com/api/v3")
    .replace("gateway.excitesms.tech", "gateway.excitesms.com")
    .replace(/\/+$/, "");
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

  return {
    apiUrl: normalizeExciteSmsUrl(providers.excitesms_api_url || config.excitesms_api_url || Deno.env.get("EXCITESMS_API_URL") || "https://gateway.excitesms.com/api/v3"),
    apiToken: (providers.excitesms_api_token || config.excitesms_api_token || Deno.env.get("EXCITESMS_API_TOKEN") || "").trim(),
    senderId: (providers.excitesms_sender_id || config.excitesms_sender_id || Deno.env.get("EXCITESMS_SENDER_ID") || "Phindu").trim(),
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

    // --- Auth check: require authenticated staff/admin or service_role ---
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

    const logSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { apiUrl, apiToken, senderId } = await getExciteSmsCredentials(logSupabase);

    if (!apiToken) {
      console.error("[SMS] ExciteSMS credentials not configured");
      
      const { to, message, userId, title }: SMSRequest = await req.json();
      const recipients = Array.isArray(to) ? to : [to];
      
      for (const recipient of recipients) {
        await logSupabase.from("notification_logs").insert({
          user_id: userId || null,
          type: "sms",
          recipient: recipient,
          title: title || "SMS Notification",
          message: message,
          status: "pending_config",
          provider_response: { note: "ExciteSMS provider not configured", provider: "excitesms" }
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

    const { to, message, userId, title }: SMSRequest = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recipients = Array.isArray(to) ? to.join(",") : to;
    
    const formattedRecipients = recipients.split(",").map(phone => {
      let cleaned = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
      if (cleaned.startsWith("0")) {
        cleaned = "+260" + cleaned.substring(1);
      } else if (!cleaned.startsWith("+")) {
        cleaned = "+260" + cleaned;
      }
      return cleaned;
    }).join(",");

    console.log("[SMS] Sending via ExciteSMS to:", formattedRecipients);

    const response = await fetch(`${apiUrl}/sms/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        recipient: formattedRecipients.replace(/\+/g, ""),
        sender_id: senderId,
        type: "plain",
        message,
      })
    });

    const result = await response.json().catch(() => ({ status: "error", message: "Invalid provider response" }));
    console.log("[SMS] Provider response:", JSON.stringify(result));

    const recipientList = formattedRecipients.split(",");
    const providerStatus = String(result?.data?.status || result?.status || "").toLowerCase();
    const isSuccess = response.ok && result?.status !== "error" && !["failed", "rejected", "undelivered"].includes(providerStatus);
    for (const recipient of recipientList) {
      await logSupabase.from("notification_logs").insert({
        user_id: userId || null,
        type: "sms",
        recipient: recipient,
        title: title || "SMS Notification",
        message: message,
        status: isSuccess ? "sent" : "failed",
        sent_at: isSuccess ? new Date().toISOString() : null,
        provider_response: { ...result, provider: "excitesms" }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: isSuccess,
        result,
        provider: "excitesms"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[SMS] Error:", error);
    return new Response(
      JSON.stringify({ error: "SMS service temporarily unavailable" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
