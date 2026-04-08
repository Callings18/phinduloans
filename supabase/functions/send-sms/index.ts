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

    const apiKey = Deno.env.get("AFRICASTALKING_API_KEY");
    const username = Deno.env.get("AFRICASTALKING_USERNAME");

    if (!apiKey || !username) {
      console.error("[SMS] Africa's Talking credentials not configured");
      
      const { to, message, userId, title }: SMSRequest = await req.json();

      const logSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const recipients = Array.isArray(to) ? to : [to];
      
      for (const recipient of recipients) {
        await logSupabase.from("notification_logs").insert({
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

    console.log("[SMS] Sending to:", formattedRecipients);

    const atUrl = username === "sandbox" 
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("to", formattedRecipients);
    formData.append("message", message);
    formData.append("from", "PHINDU");

    const response = await fetch(atUrl, {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: formData.toString()
    });

    const result = await response.json();
    console.log("[SMS] Provider response:", JSON.stringify(result));

    const logClient = createClient(supabaseUrl, supabaseServiceKey);

    const recipientList = formattedRecipients.split(",");
    for (const recipient of recipientList) {
      const messageResult = result.SMSMessageData?.Recipients?.find(
        (r: any) => r.number === recipient
      );
      
      await logClient.from("notification_logs").insert({
        user_id: userId || null,
        type: "sms",
        recipient: recipient,
        title: title || "SMS Notification",
        message: message,
        status: messageResult?.status === "Success" ? "sent" : "failed",
        sent_at: messageResult?.status === "Success" ? new Date().toISOString() : null,
        provider_response: messageResult || result
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: result.SMSMessageData 
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
