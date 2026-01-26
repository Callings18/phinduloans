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
  eventType?: string;
  // Respond.io template parameters (optional fallback)
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: any[];
}

interface NotificationSettings {
  // Twilio Settings (unified for SMS, WhatsApp, Email)
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  twilio_whatsapp_number?: string;
  twilio_messaging_service_sid?: string;
  
  // SendGrid (Twilio Email)
  sendgrid_api_key?: string;
  sendgrid_from_email?: string;
  sendgrid_from_name?: string;
  
  // Respond.io (optional fallback for WhatsApp)
  respondio_api_key?: string;
  respondio_base_url?: string;
  respondio_whatsapp_channel_id?: string;
  
  // Channel enablement
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  email_enabled?: boolean;
  
  // Provider selection (for flexibility)
  sms_provider?: string;
  whatsapp_provider?: string;
  email_provider?: string;
  
  // Notification Event Triggers
  notify_on_signup?: boolean;
  notify_on_application_submitted?: boolean;
  notify_on_application_under_review?: boolean;
  notify_on_kyc_verification?: boolean;
  notify_on_document_request?: boolean;
  notify_on_loan_approval?: boolean;
  notify_on_loan_rejection?: boolean;
  notify_on_disbursement?: boolean;
  notify_on_payment_received?: boolean;
  notify_on_partial_payment?: boolean;
  notify_on_payment_reminder?: boolean;
  notify_on_overdue?: boolean;
  notify_on_collection_escalation?: boolean;
  notify_on_loan_restructured?: boolean;
  notify_on_loan_completion?: boolean;
  notify_on_statement_available?: boolean;
  notify_on_promotion?: boolean;
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

// Format Zambian phone numbers
function formatZambianPhone(phone: string): string {
  let formatted = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (formatted.startsWith("0")) {
    formatted = "+260" + formatted.substring(1);
  } else if (!formatted.startsWith("+")) {
    formatted = "+260" + formatted;
  }
  return formatted;
}

// ============================================================================
// TWILIO SMS
// ============================================================================

async function sendSMS_Twilio(
  to: string,
  message: string,
  settings: NotificationSettings
): Promise<any> {
  const accountSid = settings.twilio_account_sid;
  const authToken = settings.twilio_auth_token;
  const fromNumber = settings.twilio_phone_number;
  const messagingServiceSid = settings.twilio_messaging_service_sid;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured");
  }

  if (!fromNumber && !messagingServiceSid) {
    throw new Error("Twilio phone number or messaging service SID required");
  }

  const phone = formatZambianPhone(to);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", phone);
  formData.append("Body", message);
  
  if (messagingServiceSid) {
    formData.append("MessagingServiceSid", messagingServiceSid);
  } else {
    formData.append("From", fromNumber!);
  }

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

  if (result.error_code || result.code) {
    throw new Error(result.message || "Failed to send SMS via Twilio");
  }

  return result;
}

// ============================================================================
// TWILIO WHATSAPP
// ============================================================================

async function sendWhatsApp_Twilio(
  to: string,
  message: string,
  settings: NotificationSettings
): Promise<any> {
  const accountSid = settings.twilio_account_sid;
  const authToken = settings.twilio_auth_token;
  let whatsappNumber = settings.twilio_whatsapp_number;

  if (!accountSid || !authToken || !whatsappNumber) {
    throw new Error("Twilio WhatsApp credentials not configured");
  }

  // Ensure WhatsApp number has correct format
  if (!whatsappNumber.startsWith("whatsapp:")) {
    whatsappNumber = `whatsapp:${whatsappNumber}`;
  }

  const phone = formatZambianPhone(to);
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

  if (result.error_code || result.code) {
    throw new Error(result.message || "Failed to send WhatsApp message via Twilio");
  }

  return result;
}

/**
 * Respond.io WhatsApp Business API (Optional fallback)
 * Sends WhatsApp template messages via Respond.io
 * Documentation: https://docs.respond.io/
 */
async function sendWhatsApp_RespondIO(
  to: string,
  message: string,
  settings: NotificationSettings,
  templateName?: string,
  templateLanguage?: string,
  templateComponents?: any[]
): Promise<any> {
  const apiKey = settings.respondio_api_key;
  const baseUrl = settings.respondio_base_url || "https://api.respond.io/v3";
  const channelId = settings.respondio_whatsapp_channel_id;

  if (!apiKey || !channelId) {
    throw new Error("Respond.io credentials not configured (apiKey and channelId required)");
  }

  const phone = formatZambianPhone(to);

  // If template name is provided, send as template message
  if (templateName) {
    const payload: any = {
      channelId: channelId,
      to: phone,
      template: {
        name: templateName,
        language: {
          code: templateLanguage || "en",
        },
      },
    };

    if (templateComponents && templateComponents.length > 0) {
      payload.template.components = templateComponents;
    }

    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let result: any;

    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { error: responseText, status: response.status };
    }

    console.log("[WhatsApp - Respond.io] Template Response:", JSON.stringify(result));

    if (!response.ok) {
      const errorMessage = result?.message || result?.error || `HTTP ${response.status}`;
      throw new Error(`Respond.io API error: ${errorMessage}`);
    }

    return result;
  } else {
    throw new Error("Template name is required for Respond.io WhatsApp messages");
  }
}

// ============================================================================
// TWILIO SENDGRID EMAIL
// ============================================================================

async function sendEmail_SendGrid(
  to: string,
  subject: string,
  message: string,
  settings: NotificationSettings,
  htmlContent?: string
): Promise<any> {
  const apiKey = settings.sendgrid_api_key;
  const fromEmail = settings.sendgrid_from_email || "noreply@phindu.com";
  const fromName = settings.sendgrid_from_name || "Phindu Finance";

  if (!apiKey) {
    throw new Error("SendGrid API key not configured");
  }

  // Generate HTML if not provided
  const html = htmlContent || generateEmailHtml(subject, message);

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
        {
          type: "text/html",
          value: html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Email - SendGrid] Error:", error);
    throw new Error(`SendGrid error: ${response.status} - ${error}`);
  }

  console.log("[Email - SendGrid] Sent successfully");
  return { success: true, messageId: response.headers.get("x-message-id") };
}

// Generate a nice HTML email template
function generateEmailHtml(subject: string, message: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #E91E8C 0%, #FF6B9D 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">PHINDU</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Finance Made Simple</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">${subject}</h2>
              <div style="color: #555555; font-size: 16px; line-height: 1.6;">
                ${message.replace(/\n/g, '<br>')}
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="color: #888888; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Phindu Finance. All rights reserved.
              </p>
              <p style="color: #888888; font-size: 12px; margin: 10px 0 0 0;">
                <a href="mailto:info@phindu.com" style="color: #E91E8C; text-decoration: none;">info@phindu.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    const { type, to, message, subject, title, userId, htmlContent, eventType, templateName, templateLanguage, templateComponents } = request;

    if (!type || !to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, to, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const settings = await getNotificationSettings(supabase);
    
    // Check if event type is enabled (if provided)
    if (eventType) {
      const eventKey = `notify_on_${eventType}` as keyof NotificationSettings;
      if (settings[eventKey] === false) {
        console.log(`[Notification] Event type '${eventType}' is disabled`);
        return new Response(
          JSON.stringify({ success: false, message: `Notification for ${eventType} is disabled` }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Determine provider - default to Twilio
    const whatsappProvider = settings.whatsapp_provider || 'twilio';
    
    console.log(`[Notification] Sending ${type} to ${to}`);

    let result: any;
    let status = "sent";
    let provider = "twilio";

    try {
      if (type === 'sms') {
        if (!settings.sms_enabled) {
          throw new Error("SMS notifications are disabled");
        }
        result = await sendSMS_Twilio(to, message, settings);
      } else if (type === 'whatsapp') {
        if (!settings.whatsapp_enabled) {
          throw new Error("WhatsApp notifications are disabled");
        }
        
        // Use Twilio by default, Respond.io as fallback if configured
        if (whatsappProvider === 'respondio' && settings.respondio_api_key) {
          provider = 'respondio';
          result = await sendWhatsApp_RespondIO(to, message, settings, templateName, templateLanguage, templateComponents);
        } else {
          result = await sendWhatsApp_Twilio(to, message, settings);
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
        provider = "sendgrid";
        result = await sendEmail_SendGrid(to, subject, message, settings, htmlContent);
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
        provider_response: { provider, eventType, ...result }
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
