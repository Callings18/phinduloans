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
  // SMS Provider Selection
  sms_provider?: 'twilio' | 'excitesms';
  // ExciteSMS Credentials
  excitesms_api_url?: string;
  excitesms_api_token?: string;
  excitesms_sender_id?: string;
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
// EXCITESMS
// ============================================================================

async function getExciteSmsCredentials(supabase: any): Promise<{
  apiUrl: string;
  apiToken: string;
  senderId: string;
}> {
  // Try to get from notification_providers first
  const { data: providersData } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_providers")
    .maybeSingle();

  // Also check notification_config (from AdminSettings page)
  const { data: configData } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_config")
    .maybeSingle();

  const providers = providersData?.value || {};
  const config = configData?.value || {};
  
  // Use the correct ExciteSMS domain (.com)
  const apiUrl = providers.excitesms_api_url || config.excitesms_api_url || Deno.env.get("EXCITESMS_API_URL") || "https://gateway.excitesms.com/api/v3";
  
  // Ensure we use .com (the correct domain)
  const correctedApiUrl = apiUrl.replace("gateway.excitesms.tech", "gateway.excitesms.com");
  
  // Get and trim the API token (remove any trailing whitespace)
  const rawToken = providers.excitesms_api_token || config.excitesms_api_token || Deno.env.get("EXCITESMS_API_TOKEN") || "";
  
  return {
    apiUrl: correctedApiUrl,
    apiToken: rawToken.trim(),
    senderId: (providers.excitesms_sender_id || config.excitesms_sender_id || Deno.env.get("EXCITESMS_SENDER_ID") || "Phindu").trim(),
  };
}

async function sendSMS_ExciteSMS(to: string, message: string, creds: any): Promise<any> {
  if (!creds.apiToken) {
    throw new Error("ExciteSMS API token not configured (EXCITESMS_API_TOKEN)");
  }

  // ExciteSMS requires phone number without + prefix
  const phone = formatPhoneNumber(to).replace("+", "");
  const url = `${creds.apiUrl}/sms/send`;

  console.log(`[SMS - ExciteSMS] Sending to ${phone} via ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${creds.apiToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      recipient: phone,
      sender_id: creds.senderId,
      type: "plain",
      message: message,
    }),
  });

  // Check content-type BEFORE attempting to parse as JSON
  const contentType = response.headers.get("content-type") || "";
  const responseText = await response.text();
  
  console.log(`[SMS - ExciteSMS] Status: ${response.status}, Content-Type: ${contentType}`);
  console.log(`[SMS - ExciteSMS] Response preview: ${responseText.substring(0, 200)}`);

  // Handle non-JSON responses
  if (!contentType.includes("application/json")) {
    // Check for common HTML patterns indicating error pages
    if (responseText.trim().startsWith("<!") || responseText.includes("<html")) {
      throw new Error(
        `ExciteSMS API returned HTML instead of JSON (Status: ${response.status}). ` +
        `This may indicate: auth failure, wrong endpoint, or server error. ` +
        `Check API URL and token configuration.`
      );
    }
    throw new Error(`ExciteSMS unexpected response format: ${contentType}. Response: ${responseText.substring(0, 100)}`);
  }

  // Now safely parse as JSON
  let result;
  try {
    result = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`ExciteSMS returned invalid JSON. Response: ${responseText.substring(0, 100)}`);
  }
  
  console.log("[SMS - ExciteSMS] Response:", JSON.stringify(result));

  if (result.status === "error") {
    throw new Error(result.message || "Failed to send SMS via ExciteSMS");
  }

  return result;
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

  const phone = formatPhoneNumber(to);
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

  const phone = formatPhoneNumber(to);
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
  // Get notification_providers settings
  const { data: providersData, error: providersError } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_providers")
    .maybeSingle();

  // Also get notification_config settings (from AdminSettings page)
  const { data: configData } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_config")
    .maybeSingle();

  if (providersError) {
    console.error("[Notification] Error loading settings:", providersError);
  }

  const providers = providersData?.value || {};
  const config = configData?.value || {};

  // Merge settings: notification_providers takes priority, but check notification_config for sms_provider
  // Map notification_config's sms_provider to our format
  let smsProvider = providers.sms_provider;
  if (!smsProvider && config.sms_provider) {
    smsProvider = config.sms_provider;
  }

  return {
    ...providers,
    sms_provider: smsProvider,
  } as NotificationSettings;
}

// Check user notification preferences from profiles table
async function checkUserPreferences(
  supabase: any, 
  userId: string | undefined, 
  notificationType: string,
  eventType?: string
): Promise<{ allowed: boolean; reason?: string }> {
  // If no userId, allow notification (e.g., for admin notifications or guest notifications)
  if (!userId) {
    return { allowed: true };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("email_reminders, sms_reminders, payment_alerts, marketing")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.log("[Notification] Could not fetch user preferences, allowing notification");
      return { allowed: true };
    }

    // Map event types to preference categories
    const paymentRelatedEvents = [
      'payment_reminder', 
      'payment_received', 
      'partial_payment', 
      'overdue',
      'collection_escalation'
    ];
    const marketingEvents = ['promotion'];
    
    const isPaymentRelated = paymentRelatedEvents.includes(eventType || '');
    const isMarketing = marketingEvents.includes(eventType || '');

    // Check based on notification type and event category
    if (notificationType === 'sms' || notificationType === 'whatsapp') {
      // For marketing, check marketing preference
      if (isMarketing && data.marketing === false) {
        return { allowed: false, reason: "User has disabled marketing notifications" };
      }
      // For payment-related, check both payment_alerts and sms_reminders
      if (isPaymentRelated) {
        if (data.payment_alerts === false) {
          return { allowed: false, reason: "User has disabled payment alerts" };
        }
        if (data.sms_reminders === false) {
          return { allowed: false, reason: "User has disabled SMS reminders" };
        }
      }
      // For general notifications, check sms_reminders
      if (data.sms_reminders === false) {
        return { allowed: false, reason: "User has disabled SMS reminders" };
      }
    }

    if (notificationType === 'email') {
      // For marketing, check marketing preference
      if (isMarketing && data.marketing === false) {
        return { allowed: false, reason: "User has disabled marketing notifications" };
      }
      // For payment-related, check both payment_alerts and email_reminders
      if (isPaymentRelated) {
        if (data.payment_alerts === false) {
          return { allowed: false, reason: "User has disabled payment alerts" };
        }
        if (data.email_reminders === false) {
          return { allowed: false, reason: "User has disabled email reminders" };
        }
      }
      // For general notifications, check email_reminders
      if (data.email_reminders === false) {
        return { allowed: false, reason: "User has disabled email reminders" };
      }
    }

    return { allowed: true };
  } catch (err) {
    console.error("[Notification] Error checking user preferences:", err);
    return { allowed: true }; // Allow on error to not block notifications
  }
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
  const { borrowerName, borrowerPhone, borrowerEmail, loanId, loanAmount, signatureUrl } = request;
  
  const adminPhone = settings.admin_phone || settings.admin_whatsapp;
  const adminEmail = settings.admin_email;
  
  const loanRef = `LOAN-${loanId?.slice(0, 8).toUpperCase()}`;
  
  // Generate signed URL for the signature file if available
  let signedContractUrl = "";
  if (signatureUrl) {
    try {
      const { data: signedData } = await supabase.storage
        .from('loan-documents')
        .createSignedUrl(signatureUrl, 86400); // 24 hour expiry
      
      if (signedData?.signedUrl) {
        signedContractUrl = signedData.signedUrl;
      }
    } catch (err) {
      console.error("[Admin Notification] Failed to get signed URL:", err);
    }
  }
  
  const message = `📝 CONTRACT SIGNED\n\n` +
    `Borrower: ${borrowerName}\n` +
    `Phone: ${borrowerPhone || 'N/A'}\n` +
    `Email: ${borrowerEmail || 'N/A'}\n` +
    `Loan Ref: ${loanRef}\n` +
    `Amount: K${loanAmount?.toLocaleString()}\n\n` +
    `The borrower has digitally signed the contract. Please review and proceed with disbursement.\n\n` +
    `- Phindu Credit Solutions`;

  // Enhanced email content with link to view signature
  const emailHtmlContent = `
    <h2 style="color: #6B1A3A;">📝 Contract Signed - Action Required</h2>
    <p>A borrower has signed their loan contract and is awaiting disbursement.</p>
    
    <table style="border-collapse: collapse; margin: 20px 0; width: 100%;">
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Borrower</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">${borrowerName}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Phone</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">${borrowerPhone || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Email</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">${borrowerEmail || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Loan Reference</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">${loanRef}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Loan Amount</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">K${loanAmount?.toLocaleString()}</td>
      </tr>
    </table>
    
    ${signedContractUrl ? `
      <p><strong>View Signed Contract:</strong></p>
      <p><a href="${signedContractUrl}" style="display: inline-block; background: linear-gradient(135deg, #6B1A3A 0%, #9B2D5A 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Download Signature</a></p>
      <p style="font-size: 12px; color: #666;">This link expires in 24 hours.</p>
    ` : ''}
    
    <p style="margin-top: 20px;">Please log in to the admin dashboard to review the application and proceed with disbursement.</p>
    
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      - Phindu Credit Solutions<br>
      Automated Notification System
    </p>
  `;

  const results: any = { sms: null, whatsapp: null, email: null };

  // Send SMS to admin
  if (adminPhone && settings.sms_enabled !== false) {
    try {
      const smsProvider = settings.sms_provider || Deno.env.get("SMS_PROVIDER") || 'twilio';
      if (smsProvider === 'excitesms') {
        const exciteCreds = await getExciteSmsCredentials(supabase);
        results.sms = await sendSMS_ExciteSMS(adminPhone, message, exciteCreds);
      } else {
        results.sms = await sendSMS_Twilio(adminPhone, message);
      }
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

  // Send Email to admin with rich HTML content
  if (adminEmail && settings.email_enabled !== false) {
    try {
      results.email = await sendEmail_SendGrid(
        adminEmail,
        `🔔 Action Required: Contract Signed - ${loanRef} by ${borrowerName}`,
        message.replace(/📝 /g, ''),
        emailHtmlContent
      );
    } catch (err: any) {
      console.error("[Admin Notification] Email failed:", err.message);
      results.email = { error: err.message };
    }
  }

  // Log the notification with loan details for reference
  await supabase.from("notification_logs").insert({
    user_id: null,
    type: "admin_notification",
    recipient: adminPhone || adminEmail || "admin",
    title: `Contract Signed: ${borrowerName} - ${loanRef}`,
    message: message,
    subject: `Contract signed by ${borrowerName}`,
    status: "sent",
    sent_at: new Date().toISOString(),
    event_type: "contract_signed",
    provider_response: { 
      ...results, 
      loanId, 
      borrowerName, 
      borrowerPhone, 
      signatureUrl,
      signedContractUrl: signedContractUrl || null
    }
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

    // Check user preferences (if userId is provided)
    const userPrefs = await checkUserPreferences(supabase, userId, type, eventType);
    if (!userPrefs.allowed) {
      console.log(`[Notification] Blocked by user preference: ${userPrefs.reason}`);
      
      // Log the blocked notification
      try {
        await supabase.from("notification_logs").insert({
          user_id: userId || null,
          type: type,
          recipient: to,
          title: title || subject || "Notification",
          message: message,
          status: "disabled",
          event_type: eventType,
          provider_response: { blocked_reason: userPrefs.reason }
        });
      } catch (logError) {
        console.error("[Notification] Failed to log blocked notification:", logError);
      }
      
      return new Response(
        JSON.stringify({ success: false, message: userPrefs.reason }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[Notification] Sending ${type} to ${to}`);

    let result: any;
    let status = "sent";
    const smsProviderName = settings.sms_provider || Deno.env.get("SMS_PROVIDER") || 'twilio';
    const provider = type === 'email' ? 'sendgrid' : (type === 'sms' ? smsProviderName : 'twilio');

    try {
      if (type === 'sms') {
        if (settings.sms_enabled === false) {
          throw new Error("SMS notifications are disabled");
        }
        
        // Check which SMS provider to use (priority: DB settings > env var > default 'twilio')
        const smsProvider = settings.sms_provider || Deno.env.get("SMS_PROVIDER") || 'twilio';
        console.log(`[Notification] Using SMS provider: ${smsProvider}`);
        
        if (smsProvider === 'excitesms') {
          const exciteCreds = await getExciteSmsCredentials(supabase);
          result = await sendSMS_ExciteSMS(to, message, exciteCreds);
        } else {
          const twilioCreds = await getTwilioCredentials(supabase);
          result = await sendSMS_Twilio(to, message, twilioCreds);
        }
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
        event_type: eventType,
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
    console.error("[Notification] Handler error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
