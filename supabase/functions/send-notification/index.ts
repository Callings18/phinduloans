import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'sms' | 'email' | 'whatsapp';
  to: string;
  message: string;
  subject?: string;
  title?: string;
  userId?: string;
  htmlContent?: string;
  eventType?: string;
}

interface NotificationSettings {
  // Channel enablement (from system_settings)
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  email_enabled?: boolean;
  
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
  notify_on_court_case?: boolean;
  notify_on_contract_sent?: boolean;
}

// Get Twilio credentials from environment
function getTwilioCredentials() {
  return {
    accountSid: Deno.env.get("TWILIO_ACCOUNT_SID"),
    authToken: Deno.env.get("TWILIO_AUTH_TOKEN"),
    phoneNumber: Deno.env.get("TWILIO_PHONE_NUMBER"),
    whatsappNumber: Deno.env.get("TWILIO_WHATSAPP_NUMBER"),
    sendgridApiKey: Deno.env.get("SENDGRID_API_KEY"),
    sendgridFromEmail: Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@phindu.com",
  };
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

async function sendSMS_Twilio(to: string, message: string): Promise<any> {
  const creds = getTwilioCredentials();
  
  if (!creds.accountSid || !creds.authToken) {
    throw new Error("Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)");
  }

  if (!creds.phoneNumber) {
    throw new Error("Twilio phone number not configured (TWILIO_PHONE_NUMBER)");
  }

  const phone = formatZambianPhone(to);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", phone);
  formData.append("From", creds.phoneNumber);
  formData.append("Body", message);

  const auth = btoa(`${creds.accountSid}:${creds.authToken}`);
  
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

async function sendWhatsApp_Twilio(to: string, message: string): Promise<any> {
  const creds = getTwilioCredentials();

  if (!creds.accountSid || !creds.authToken) {
    throw new Error("Twilio credentials not configured");
  }

  if (!creds.whatsappNumber) {
    throw new Error("Twilio WhatsApp number not configured (TWILIO_WHATSAPP_NUMBER)");
  }

  // Ensure WhatsApp number has correct format
  let whatsappFrom = creds.whatsappNumber;
  if (!whatsappFrom.startsWith("whatsapp:")) {
    whatsappFrom = `whatsapp:${whatsappFrom}`;
  }

  const phone = formatZambianPhone(to);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", `whatsapp:${phone}`);
  formData.append("From", whatsappFrom);
  formData.append("Body", message);

  const auth = btoa(`${creds.accountSid}:${creds.authToken}`);
  
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

// ============================================================================
// TWILIO SENDGRID EMAIL
// ============================================================================

async function sendEmail_SendGrid(
  to: string,
  subject: string,
  message: string,
  htmlContent?: string
): Promise<any> {
  const creds = getTwilioCredentials();

  if (!creds.sendgridApiKey) {
    throw new Error("SendGrid API key not configured (SENDGRID_API_KEY)");
  }

  // Generate HTML if not provided
  const html = htmlContent || generateEmailHtml(subject, message);

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${creds.sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }],
        subject: subject,
      }],
      from: {
        email: creds.sendgridFromEmail,
        name: "Phindu Finance",
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
    const { type, to, message, subject, title, userId, htmlContent, eventType } = request;

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

    console.log(`[Notification] Sending ${type} to ${to} via Twilio`);

    let result: any;
    let status = "sent";
    const provider = type === 'email' ? 'sendgrid' : 'twilio';

    try {
      if (type === 'sms') {
        if (settings.sms_enabled === false) {
          throw new Error("SMS notifications are disabled");
        }
        result = await sendSMS_Twilio(to, message);
      } else if (type === 'whatsapp') {
        if (settings.whatsapp_enabled === false) {
          throw new Error("WhatsApp notifications are disabled");
        }
        result = await sendWhatsApp_Twilio(to, message);
      } else if (type === 'email') {
        if (settings.email_enabled === false) {
          throw new Error("Email notifications are disabled");
        }
        if (!subject) {
          return new Response(
            JSON.stringify({ error: "Subject required for email notifications" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        result = await sendEmail_SendGrid(to, subject, message, htmlContent);
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
    console.error("[Notification] Handler error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
