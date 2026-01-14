import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'sms' | 'email' | 'whatsapp';
  provider: string;
  to: string;
  message: string;
  subject?: string;
  title?: string;
  userId?: string;
}

interface NotificationSettings {
  africastalking_username?: string;
  africastalking_api_key?: string;
  africastalking_sender_id?: string;
  africastalking_whatsapp_number?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  twilio_whatsapp_number?: string;
  sendgrid_api_key?: string;
  sendgrid_from_email?: string;
  sendgrid_from_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
}

async function getNotificationSettings(supabase: any): Promise<NotificationSettings> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_providers")
    .maybeSingle();

  if (error || !data) {
    console.error("[Notification] Error loading settings:", error);
    return {};
  }

  return data.value as NotificationSettings;
}

async function sendSMS_AfricasTalking(
  to: string,
  message: string,
  settings: NotificationSettings
): Promise<any> {
  const username = settings.africastalking_username;
  const apiKey = settings.africastalking_api_key;
  const senderId = settings.africastalking_sender_id || "PHINDU";

  if (!username || !apiKey) {
    throw new Error("Africa's Talking credentials not configured");
  }

  // Format phone number
  let phone = to.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("0")) {
    phone = "+260" + phone.substring(1);
  } else if (!phone.startsWith("+")) {
    phone = "+260" + phone;
  }

  const atUrl = username === "sandbox" 
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("to", phone);
  formData.append("message", message);
  formData.append("from", senderId);

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
  console.log("[SMS - AfricasTalking] Response:", JSON.stringify(result));

  if (result.SMSMessageData?.Recipients?.[0]?.status !== "Success") {
    throw new Error(result.SMSMessageData?.Recipients?.[0]?.statusCode || "Failed to send SMS");
  }

  return result;
}

async function sendSMS_Twilio(
  to: string,
  message: string,
  settings: NotificationSettings
): Promise<any> {
  const accountSid = settings.twilio_account_sid;
  const authToken = settings.twilio_auth_token;
  const fromNumber = settings.twilio_phone_number;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials not configured");
  }

  // Format phone number
  let phone = to.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("0")) {
    phone = "+260" + phone.substring(1);
  } else if (!phone.startsWith("+")) {
    phone = "+260" + phone;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", phone);
  formData.append("From", fromNumber);
  formData.append("Body", message);

  const auth = btoa(`${accountSid}:${authToken}`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString()
  });

  const result = await response.json();
  console.log("[SMS - Twilio] Response:", JSON.stringify(result));

  if (result.error_code) {
    throw new Error(result.message || "Failed to send SMS via Twilio");
  }

  return result;
}

async function sendWhatsApp_AfricasTalking(
  to: string,
  message: string,
  settings: NotificationSettings
): Promise<any> {
  const username = settings.africastalking_username;
  const apiKey = settings.africastalking_api_key;
  const whatsappNumber = settings.africastalking_whatsapp_number;

  if (!username || !apiKey || !whatsappNumber) {
    throw new Error("Africa's Talking WhatsApp credentials not configured");
  }

  // Format phone number
  let phone = to.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("0")) {
    phone = "+260" + phone.substring(1);
  } else if (!phone.startsWith("+")) {
    phone = "+260" + phone;
  }

  const atUrl = username === "sandbox" 
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("to", phone);
  formData.append("message", message);
  formData.append("from", whatsappNumber);

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
  console.log("[WhatsApp - AfricasTalking] Response:", JSON.stringify(result));

  return result;
}

async function sendWhatsApp_Twilio(
  to: string,
  message: string,
  settings: NotificationSettings
): Promise<any> {
  const accountSid = settings.twilio_account_sid;
  const authToken = settings.twilio_auth_token;
  const whatsappNumber = settings.twilio_whatsapp_number;

  if (!accountSid || !authToken || !whatsappNumber) {
    throw new Error("Twilio WhatsApp credentials not configured");
  }

  // Format phone number
  let phone = to.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("0")) {
    phone = "+260" + phone.substring(1);
  } else if (!phone.startsWith("+")) {
    phone = "+260" + phone;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", `whatsapp:${phone}`);
  formData.append("From", whatsappNumber);
  formData.append("Body", message);

  const auth = btoa(`${accountSid}:${authToken}`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString()
  });

  const result = await response.json();
  console.log("[WhatsApp - Twilio] Response:", JSON.stringify(result));

  if (result.error_code) {
    throw new Error(result.message || "Failed to send WhatsApp message via Twilio");
  }

  return result;
}

async function sendEmail_SendGrid(
  to: string,
  subject: string,
  message: string,
  settings: NotificationSettings
): Promise<any> {
  const apiKey = settings.sendgrid_api_key;
  const fromEmail = settings.sendgrid_from_email;
  const fromName = settings.sendgrid_from_name || "Phindu Finance";

  if (!apiKey || !fromEmail) {
    throw new Error("SendGrid credentials not configured");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }],
        subject: subject,
      }],
      from: {
        email: fromEmail,
        name: fromName,
      },
      content: [{
        type: "text/plain",
        value: message,
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Email - SendGrid] Error:", error);
    throw new Error(`SendGrid error: ${response.status}`);
  }

  console.log("[Email - SendGrid] Sent successfully");
  return { success: true, messageId: response.headers.get("x-message-id") };
}

async function sendEmail_SMTP(
  to: string,
  subject: string,
  message: string,
  settings: NotificationSettings
): Promise<any> {
  // Note: Deno doesn't have built-in SMTP support
  // This would typically require a third-party library or service
  // For now, we'll log and return a placeholder
  console.log("[Email - SMTP] SMTP sending not yet implemented in edge function");
  console.log(`Would send to: ${to}, Subject: ${subject}`);
  
  throw new Error("SMTP sending not yet implemented. Please use SendGrid or configure an SMTP relay service.");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: NotificationRequest = await req.json();
    const { type, provider, to, message, subject, title, userId } = request;

    if (!type || !provider || !to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, provider, to, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[Notification] Sending ${type} via ${provider} to ${to}`);

    const settings = await getNotificationSettings(supabase);
    let result: any;

    // Route to appropriate provider
    if (type === 'sms') {
      if (provider === 'africastalking') {
        result = await sendSMS_AfricasTalking(to, message, settings);
      } else if (provider === 'twilio') {
        result = await sendSMS_Twilio(to, message, settings);
      } else {
        throw new Error(`Unsupported SMS provider: ${provider}`);
      }
    } else if (type === 'whatsapp') {
      if (provider === 'africastalking') {
        result = await sendWhatsApp_AfricasTalking(to, message, settings);
      } else if (provider === 'twilio') {
        result = await sendWhatsApp_Twilio(to, message, settings);
      } else {
        throw new Error(`Unsupported WhatsApp provider: ${provider}`);
      }
    } else if (type === 'email') {
      if (!subject) {
        return new Response(
          JSON.stringify({ error: "Subject required for email notifications" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (provider === 'sendgrid') {
        result = await sendEmail_SendGrid(to, subject, message, settings);
      } else if (provider === 'smtp') {
        result = await sendEmail_SMTP(to, subject, message, settings);
      } else {
        throw new Error(`Unsupported email provider: ${provider}`);
      }
    } else {
      throw new Error(`Unsupported notification type: ${type}`);
    }

    // Log to database
    await supabase.from("notification_logs").insert({
      user_id: userId || null,
      type: type,
      recipient: to,
      title: title || subject || "Notification",
      message: message,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_response: result
    });

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[Notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
