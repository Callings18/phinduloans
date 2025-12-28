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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("AFRICASTALKING_API_KEY");
    const username = Deno.env.get("AFRICASTALKING_USERNAME");

    if (!apiKey || !username) {
      console.log("[SMS] Africa's Talking credentials not configured - SMS will be logged only");
      
      const { to, message, userId, title }: SMSRequest = await req.json();
      
      // Log the SMS attempt for debugging
      console.log("[SMS] Would send to:", to);
      console.log("[SMS] Message:", message);

      // Still log to database for tracking
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const recipients = Array.isArray(to) ? to : [to];
      
      for (const recipient of recipients) {
        await supabase.from("notification_logs").insert({
          user_id: userId || null,
          type: "sms",
          recipient: recipient,
          title: title || "SMS Notification",
          message: message,
          status: "pending_config",
          provider_response: { note: "API keys not configured" }
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMS logged (API keys not configured)",
          simulated: true 
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
    
    // Format phone numbers for Zambia if needed
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

    // Africa's Talking API call
    const atUrl = username === "sandbox" 
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("to", formattedRecipients);
    formData.append("message", message);
    formData.append("from", "PHINDU"); // Sender ID

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
    console.log("[SMS] Africa's Talking response:", JSON.stringify(result));

    // Log to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const recipientList = formattedRecipients.split(",");
    for (const recipient of recipientList) {
      const messageResult = result.SMSMessageData?.Recipients?.find(
        (r: any) => r.number === recipient
      );
      
      await supabase.from("notification_logs").insert({
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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
