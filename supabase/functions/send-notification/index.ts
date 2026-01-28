import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'sms' | 'email' | 'whatsapp' | 'admin_contract_signed';
  to?: string;
  message?: string;
  subject?: string;
  title?: string;
  userId?: string;
  htmlContent?: string;
  eventType?: string;
  // For admin_contract_signed
  loanId?: string;
  borrowerName?: string;
  borrowerPhone?: string;
  borrowerEmail?: string;
  loanAmount?: number;
  signatureUrl?: string;
  // For WhatsApp with media
  mediaUrl?: string;
}

interface NotificationSettings {
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  email_enabled?: boolean;
  admin_phone?: string;
  admin_email?: string;
  admin_whatsapp?: string;
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

// Get Twilio credentials - first from DB settings, then fallback to env secrets
async function getTwilioCredentials(supabase: any): Promise<{
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  whatsappNumber: string;
  sendgridApiKey: string;
  sendgridFromEmail: string;
}> {
  // Try to get from database first
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_providers")
    .maybeSingle();

  const dbSettings = data?.value || {};
  
  // Return DB values if set, otherwise fallback to env secrets
  return {
    accountSid: dbSettings.twilio_account_sid || Deno.env.get("TWILIO_ACCOUNT_SID") || "",
    authToken: dbSettings.twilio_auth_token || Deno.env.get("TWILIO_AUTH_TOKEN") || "",
    phoneNumber: dbSettings.twilio_phone_number || Deno.env.get("TWILIO_PHONE_NUMBER") || "",
    whatsappNumber: dbSettings.twilio_whatsapp_number || Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "",
    sendgridApiKey: dbSettings.sendgrid_api_key || Deno.env.get("SENDGRID_API_KEY") || "",
    sendgridFromEmail: dbSettings.sendgrid_from_email || Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@phindu.com",
  };
}

// Legacy sync function for functions that can't await
function getTwilioCredentialsSync() {
  return {
    accountSid: Deno.env.get("TWILIO_ACCOUNT_SID"),
    authToken: Deno.env.get("TWILIO_AUTH_TOKEN"),
    phoneNumber: Deno.env.get("TWILIO_PHONE_NUMBER"),
    whatsappNumber: Deno.env.get("TWILIO_WHATSAPP_NUMBER"),
    sendgridApiKey: Deno.env.get("SENDGRID_API_KEY"),
    sendgridFromEmail: Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@phindu.com",
  };
}

function formatPhoneNumber(phone: string): string {
  // Clean up the phone number - remove spaces and non-digit characters (except +)
  let formatted = phone.trim().replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  
  // Handle various Zambian number formats
  if (formatted.startsWith("+260")) {
    // Already in international format
    return formatted;
  } else if (formatted.startsWith("260")) {
    // Has country code without +
    return "+" + formatted;
  } else if (formatted.startsWith("0")) {
    // Local format starting with 0
    return "+260" + formatted.substring(1);
  } else if (formatted.length === 9 && !formatted.startsWith("+")) {
    // 9-digit number without leading 0 (e.g., 976664789)
    return "+260" + formatted;
  } else if (formatted.startsWith("+")) {
    // Already has + prefix (non-Zambian international number)
    return formatted;
  } else {
    // Assume it's a Zambian number without prefix
    return "+260" + formatted;
  }
}

// ============================================================================
// TWILIO SMS
// ============================================================================

async function sendSMS_Twilio(to: string, message: string, creds?: any): Promise<any> {
  const credentials = creds || getTwilioCredentialsSync();
  
  if (!credentials.accountSid || !credentials.authToken) {
    throw new Error("Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)");
  }

  if (!credentials.phoneNumber) {
    throw new Error("Twilio phone number not configured (TWILIO_PHONE_NUMBER)");
  }

  const phone = formatZambianPhone(to);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", phone);
  formData.append("From", credentials.phoneNumber);
  formData.append("Body", message);

  const auth = btoa(`${credentials.accountSid}:${credentials.authToken}`);
  
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
// TWILIO WHATSAPP (with optional media support)
// ============================================================================

async function sendWhatsApp_Twilio(to: string, message: string, mediaUrl?: string, creds?: any): Promise<any> {
  const credentials = creds || getTwilioCredentialsSync();

  if (!credentials.accountSid || !credentials.authToken) {
    throw new Error("Twilio credentials not configured");
  }

  if (!credentials.whatsappNumber) {
    throw new Error("Twilio WhatsApp number not configured (TWILIO_WHATSAPP_NUMBER)");
  }

  let whatsappFrom = credentials.whatsappNumber;
  if (!whatsappFrom.startsWith("whatsapp:")) {
    whatsappFrom = `whatsapp:${whatsappFrom}`;
  }

  const phone = formatZambianPhone(to);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", `whatsapp:${phone}`);
  formData.append("From", whatsappFrom);
  formData.append("Body", message);
  
  // Add media URL if provided (for PDFs, images, etc.)
  if (mediaUrl) {
    formData.append("MediaUrl", mediaUrl);
  }

  const auth = btoa(`${credentials.accountSid}:${credentials.authToken}`);
  
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
// TWILIO SENDGRID EMAIL (with optional attachment)
// ============================================================================

async function sendEmail_SendGrid(
  to: string,
  subject: string,
  message: string,
  htmlContent?: string,
  attachment?: { content: string; filename: string; type?: string },
  creds?: any
): Promise<any> {
  const credentials = creds || getTwilioCredentialsSync();

  if (!credentials.sendgridApiKey) {
    throw new Error("SendGrid API key not configured (SENDGRID_API_KEY)");
  }

  const html = htmlContent || generateEmailHtml(subject, message);

  const emailPayload: any = {
    personalizations: [{
      to: [{ email: to }],
      subject: subject,
    }],
    from: {
      email: credentials.sendgridFromEmail,
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
  };

  // Add attachment if provided
  if (attachment) {
    emailPayload.attachments = [{
      content: attachment.content,
      filename: attachment.filename,
      type: attachment.type || "application/pdf",
      disposition: "attachment",
    }];
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${credentials.sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Email - SendGrid] Error:", error);
    throw new Error(`SendGrid error: ${response.status} - ${error}`);
  }

  console.log("[Email - SendGrid] Sent successfully");
  return { success: true, messageId: response.headers.get("x-message-id") };
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

function generateEmailHtml(subject: string, message: string): string {
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse: collapse;}
    td, th {font-family: Arial, sans-serif;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%); min-height: 100vh;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%); padding: 40px 20px;">
    <tr>
      <td align="center" valign="top">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #6B1A3A 0%, #9B2D5A 50%, #6B1A3A 100%); border-radius: 16px 16px 0 0; overflow: hidden;">
                <!-- Glossy overlay effect -->
                <tr>
                  <td style="padding: 40px 30px; text-align: center; position: relative;">
                    <!-- Shine effect -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 50%; background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%);"></div>
                    
                    <!-- Logo Text -->
                    <h1 style="color: #ffffff; margin: 0; font-size: 36px; font-weight: 800; letter-spacing: 3px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                      PHINDU
                    </h1>
                    <p style="color: rgba(255,255,255,0.95); margin: 8px 0 0 0; font-size: 14px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase;">
                      Credit Solutions Limited
                    </p>
                    
                    <!-- Decorative line -->
                    <div style="width: 60px; height: 3px; background: rgba(255,255,255,0.5); margin: 20px auto 0; border-radius: 2px;"></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%); box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                <tr>
                  <td style="padding: 45px 40px;">
                    <!-- Subject Title -->
                    <h2 style="color: #1a1a2e; margin: 0 0 25px 0; font-size: 24px; font-weight: 700; border-left: 4px solid #6B1A3A; padding-left: 15px;">
                      ${subject}
                    </h2>
                    
                    <!-- Message Content -->
                    <div style="color: #444444; font-size: 16px; line-height: 1.8; padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 12px; border: 1px solid #e9ecef;">
                      ${message.replace(/\n/g, '<br>')}
                    </div>
                    
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 35px;">
                      <tr>
                        <td align="center">
                          <a href="https://phinducredit.co.zm" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6B1A3A 0%, #9B2D5A 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 30px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(107,26,58,0.35);">
                            Visit Your Account
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%); border-radius: 0 0 16px 16px;">
                <tr>
                  <td style="padding: 35px 30px; text-align: center;">
                    <!-- Contact Info -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td align="center">
                          <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px 0;">
                            📞 +260 XXX XXX XXX &nbsp;&nbsp;|&nbsp;&nbsp; 📧 info@phinducredit.co.zm
                          </p>
                          <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                            📍 Lusaka, Zambia
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Divider -->
                    <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(107,26,58,0.5) 50%, transparent 100%); margin: 20px 0;"></div>
                    
                    <!-- Copyright -->
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 10px 0;">
                      © ${currentYear} Phindu Credit Solutions Limited. All rights reserved.
                    </p>
                    
                    <!-- Legal Links -->
                    <p style="margin: 0;">
                      <a href="#" style="color: #9B2D5A; text-decoration: none; font-size: 11px; margin: 0 10px;">Privacy Policy</a>
                      <span style="color: #4b5563;">|</span>
                      <a href="#" style="color: #9B2D5A; text-decoration: none; font-size: 11px; margin: 0 10px;">Terms of Service</a>
                      <span style="color: #4b5563;">|</span>
                      <a href="#" style="color: #9B2D5A; text-decoration: none; font-size: 11px; margin: 0 10px;">Unsubscribe</a>
                    </p>
                    
                    <!-- Regulatory Note -->
                    <p style="color: #6b7280; font-size: 10px; margin: 15px 0 0 0; line-height: 1.5;">
                      Phindu Credit Solutions Limited is a licensed financial services provider<br>
                      regulated by the Bank of Zambia.
                    </p>
                  </td>
                </tr>
              </table>
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
// ADMIN CONTRACT SIGNED NOTIFICATION
// ============================================================================

async function handleAdminContractSigned(
  supabase: any,
  request: NotificationRequest,
  settings: NotificationSettings
): Promise<any> {
  const { borrowerName, borrowerPhone, loanId, loanAmount, signatureUrl } = request;
  
  const adminPhone = settings.admin_phone || settings.admin_whatsapp;
  const adminEmail = settings.admin_email;
  
  const loanRef = `LOAN-${loanId?.slice(0, 8).toUpperCase()}`;
  
  const message = `📝 CONTRACT SIGNED\n\n` +
    `Borrower: ${borrowerName}\n` +
    `Loan Ref: ${loanRef}\n` +
    `Amount: K${loanAmount?.toLocaleString()}\n\n` +
    `The borrower has digitally signed the contract. Please review and proceed with disbursement.\n\n` +
    `- Phindu Credit Solutions`;

  const results: any = { sms: null, whatsapp: null, email: null };

  // Send SMS to admin
  if (adminPhone && settings.sms_enabled !== false) {
    try {
      results.sms = await sendSMS_Twilio(adminPhone, message);
    } catch (err: any) {
      console.error("[Admin Notification] SMS failed:", err.message);
      results.sms = { error: err.message };
    }
  }

  // Send WhatsApp to admin
  if (adminPhone && settings.whatsapp_enabled !== false) {
    try {
      results.whatsapp = await sendWhatsApp_Twilio(adminPhone, message);
    } catch (err: any) {
      console.error("[Admin Notification] WhatsApp failed:", err.message);
      results.whatsapp = { error: err.message };
    }
  }

  // Send Email to admin
  if (adminEmail && settings.email_enabled !== false) {
    try {
      results.email = await sendEmail_SendGrid(
        adminEmail,
        `Contract Signed - ${loanRef} by ${borrowerName}`,
        message.replace(/📝 /g, '')
      );
    } catch (err: any) {
      console.error("[Admin Notification] Email failed:", err.message);
      results.email = { error: err.message };
    }
  }

  // Log the notification
  await supabase.from("notification_logs").insert({
    user_id: null,
    type: "admin_notification",
    recipient: adminPhone || adminEmail || "admin",
    title: "Contract Signed Notification",
    message: message,
    status: "sent",
    sent_at: new Date().toISOString(),
    provider_response: results
  });

  return results;
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
    const { type, to, message, subject, title, userId, htmlContent, eventType, mediaUrl } = request;

    const settings = await getNotificationSettings(supabase);

    // Handle admin contract signed notification
    if (type === 'admin_contract_signed') {
      const result = await handleAdminContractSigned(supabase, request, settings);
      return new Response(
        JSON.stringify({ success: true, result }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!type || !to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, to, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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
        result = await sendWhatsApp_Twilio(to, message, mediaUrl);
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
