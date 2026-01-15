import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'sms' | 'email' | 'whatsapp';
  provider?: string;
  to: string;
  message: string;
  subject?: string;
  title?: string;
  userId?: string;
  htmlContent?: string;
}

interface NotificationSettings {
  // SMS Settings
  sms_enabled?: boolean;
  sms_provider?: string;
  africastalking_username?: string;
  africastalking_api_key?: string;
  africastalking_sender_id?: string;
  
  // WhatsApp Settings  
  whatsapp_enabled?: boolean;
  whatsapp_provider?: string;
  africastalking_whatsapp_number?: string;
  fonnte_api_token?: string;
  fonnte_device_id?: string;
  
  // Email Settings
  email_enabled?: boolean;
  email_provider?: string;
  resend_api_key?: string;
  resend_from_email?: string;
  resend_from_name?: string;
  
  // Legacy settings (keeping for backwards compatibility)
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

// ============================================================================
// SMS PROVIDERS
// ============================================================================

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

  // Format phone number for Zambia
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

// ============================================================================
// WHATSAPP PROVIDERS
// ============================================================================

/**
 * Fonnte WhatsApp API - Very affordable (~$6/month unlimited)
 * Documentation: https://fonnte.com/api
 */
async function sendWhatsApp_Fonnte(
  to: string,
  message: string,
  settings: NotificationSettings
): Promise<any> {
  const apiToken = settings.fonnte_api_token;

  if (!apiToken) {
    throw new Error("Fonnte API token not configured");
  }

  // Format phone number - Fonnte accepts various formats
  let phone = to.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("0")) {
    phone = "260" + phone.substring(1); // Zambia country code without +
  } else if (phone.startsWith("+")) {
    phone = phone.substring(1); // Remove + prefix
  }

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      "Authorization": apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: phone,
      message: message,
      countryCode: "260", // Zambia
    })
  });

  const result = await response.json();
  console.log("[WhatsApp - Fonnte] Response:", JSON.stringify(result));

  if (!result.status) {
    throw new Error(result.reason || result.detail || "Failed to send WhatsApp via Fonnte");
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
  const waNumber = settings.africastalking_whatsapp_number;

  if (!username || !apiKey || !waNumber) {
    throw new Error("Africa's Talking WhatsApp credentials not configured");
  }

  // Format phone number for Zambia
  let phone = to.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("0")) {
    phone = "+260" + phone.substring(1);
  } else if (!phone.startsWith("+")) {
    phone = "+260" + phone;
  }

  // Normalize WhatsApp number
  let fromNumber = waNumber.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (fromNumber.startsWith("0")) {
    fromNumber = "+260" + fromNumber.substring(1);
  } else if (!fromNumber.startsWith("+")) {
    fromNumber = "+260" + fromNumber;
  }

  const atUrl = username === "sandbox"
    ? "https://chat.sandbox.africastalking.com/whatsapp/message/send"
    : "https://chat.africastalking.com/whatsapp/message/send";

  const response = await fetch(atUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "apiKey": apiKey,
    },
    body: JSON.stringify({
      username: username,
      waNumber: fromNumber,
      phoneNumber: phone,
      body: {
        message: message,
      },
    }),
  });

  const result = await response.json();
  console.log("[WhatsApp - AfricasTalking] Response:", JSON.stringify(result));

  if (!response.ok) {
    throw new Error(result?.message || `Africa's Talking error: ${response.status}`);
  }

  if (!result?.status || result.status === "FAILED") {
    throw new Error(result?.status || "Failed to send WhatsApp via Africa's Talking");
  }

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

// ============================================================================
// EMAIL PROVIDERS
// ============================================================================

/**
 * Resend Email API - 3,000 free emails/month, very easy to use
 * Documentation: https://resend.com/docs
 */
async function sendEmail_Resend(
  to: string,
  subject: string,
  message: string,
  settings: NotificationSettings,
  htmlContent?: string
): Promise<any> {
  const apiKey = settings.resend_api_key;
  const fromEmail = settings.resend_from_email || "noreply@phindu.com";
  const fromName = settings.resend_from_name || "Phindu Finance";

  if (!apiKey) {
    throw new Error("Resend API key not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      text: message,
      html: htmlContent || `<p>${message.replace(/\n/g, '<br>')}</p>`,
    }),
  });

  const result = await response.json();
  console.log("[Email - Resend] Response:", JSON.stringify(result));

  if (!response.ok) {
    throw new Error(result.message || `Resend error: ${response.status}`);
  }

  return result;
}

async function sendEmail_SendGrid(
  to: string,
  subject: string,
  message: string,
  settings: NotificationSettings,
  htmlContent?: string
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
      content: [
        {
          type: "text/plain",
          value: message,
        },
        ...(htmlContent ? [{
          type: "text/html",
          value: htmlContent,
        }] : []),
      ],
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

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: NotificationRequest = await req.json();
    const { type, provider: requestedProvider, to, message, subject, title, userId, htmlContent } = request;

    if (!type || !to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, to, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const settings = await getNotificationSettings(supabase);
    
    // Determine provider from settings or request
    let provider = requestedProvider;
    if (!provider) {
      if (type === 'sms') {
        provider = settings.sms_provider || 'africastalking';
      } else if (type === 'whatsapp') {
        provider = settings.whatsapp_provider || 'fonnte';
      } else if (type === 'email') {
        provider = settings.email_provider || 'resend';
      }
    }

    console.log(`[Notification] Sending ${type} via ${provider} to ${to}`);

    let result: any;
    let status = "sent";

    try {
      // Route to appropriate provider
      if (type === 'sms') {
        if (!settings.sms_enabled) {
          throw new Error("SMS notifications are disabled");
        }
        if (provider === 'africastalking') {
          result = await sendSMS_AfricasTalking(to, message, settings);
        } else if (provider === 'twilio') {
          result = await sendSMS_Twilio(to, message, settings);
        } else {
          throw new Error(`Unsupported SMS provider: ${provider}`);
        }
      } else if (type === 'whatsapp') {
        if (!settings.whatsapp_enabled) {
          throw new Error("WhatsApp notifications are disabled");
        }
        if (provider === 'africastalking') {
          result = await sendWhatsApp_AfricasTalking(to, message, settings);
        } else if (provider === 'fonnte') {
          result = await sendWhatsApp_Fonnte(to, message, settings);
        } else if (provider === 'twilio') {
          result = await sendWhatsApp_Twilio(to, message, settings);
        } else {
          throw new Error(`Unsupported WhatsApp provider: ${provider}`);
        }
      } else if (type === 'email') {
        if (!settings.email_enabled) {
          throw new Error("Email notifications are disabled");
        }
        if (!subject) {
          return new Response(
            JSON.stringify({ error: "Subject required for email notifications" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        if (provider === 'resend') {
          result = await sendEmail_Resend(to, subject, message, settings, htmlContent);
        } else if (provider === 'sendgrid') {
          result = await sendEmail_SendGrid(to, subject, message, settings, htmlContent);
        } else {
          throw new Error(`Unsupported email provider: ${provider}`);
        }
      } else {
        throw new Error(`Unsupported notification type: ${type}`);
      }
    } catch (sendError: any) {
      status = "failed";
      result = { error: sendError.message };
      console.error(`[Notification] Send failed:`, sendError.message);
    }

    // Log to database
    try {
      await supabase.from("notification_logs").insert({
        user_id: userId || null,
        type: type,
        recipient: to,
        title: title || subject || "Notification",
        message: message,
        status: status,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        provider_response: { provider, ...result }
      });
    } catch (logError) {
      console.error("[Notification] Failed to log:", logError);
    }

    if (status === "failed") {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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
