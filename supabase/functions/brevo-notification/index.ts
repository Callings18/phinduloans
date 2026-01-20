import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BrevoNotificationRequest {
  type: 'sms' | 'email' | 'whatsapp';
  to: string;
  message: string;
  subject?: string;
  htmlContent?: string;
  templateId?: number;
  templateParams?: Record<string, string>;
  userId?: string;
  eventType?: string;
  attachment?: {
    content: string; // Base64 encoded
    name: string;
  };
}

interface BrevoSettings {
  brevo_api_key: string;
  brevo_smtp_host: string;
  brevo_smtp_port: number;
  brevo_smtp_username: string;
  brevo_smtp_password: string;
  brevo_sender_name: string;
  brevo_sender_email: string;
  brevo_sender_phone: string;
  brevo_email_enabled: boolean;
  brevo_sms_enabled: boolean;
  brevo_whatsapp_enabled: boolean;
}

async function getBrevoSettings(supabase: any): Promise<BrevoSettings | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "brevo_settings")
    .maybeSingle();

  if (error || !data) {
    console.error("[Brevo] Error loading settings:", error);
    return null;
  }

  return data.value as BrevoSettings;
}

async function sendEmailBrevo(
  to: string,
  subject: string,
  message: string,
  htmlContent: string | undefined,
  settings: BrevoSettings,
  templateId?: number,
  templateParams?: Record<string, string>,
  attachment?: { content: string; name: string }
): Promise<any> {
  const apiKey = settings.brevo_api_key;
  const senderEmail = settings.brevo_sender_email;
  const senderName = settings.brevo_sender_name || "Phindu Finance";

  if (!apiKey) {
    throw new Error("Brevo API key not configured");
  }

  if (!senderEmail) {
    throw new Error("Brevo sender email not configured");
  }

  let payload: any;

  if (templateId) {
    // Using a Brevo template
    payload = {
      templateId: templateId,
      to: [{ email: to }],
      params: templateParams || {}
    };
  } else {
    // Sending custom email
    payload = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [{ email: to }],
      subject: subject,
      textContent: message,
      htmlContent: htmlContent || `<html><body><p>${message.replace(/\n/g, '<br>')}</p></body></html>`
    };

    // Add attachment if provided (for PDFs like contracts)
    if (attachment) {
      payload.attachment = [{
        content: attachment.content,
        name: attachment.name
      }];
    }
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Brevo Email] Error:", errorText);
    throw new Error(`Brevo email error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("[Brevo Email] Success:", JSON.stringify(result));
  return result;
}

async function sendSMSBrevo(
  to: string,
  message: string,
  settings: BrevoSettings
): Promise<any> {
  const apiKey = settings.brevo_api_key;
  const senderPhone = settings.brevo_sender_phone || "Phindu";

  if (!apiKey) {
    throw new Error("Brevo API key not configured");
  }

  // Format phone number - Brevo requires international format without +
  let phone = to.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("0")) {
    phone = "260" + phone.substring(1);
  } else if (phone.startsWith("+")) {
    phone = phone.substring(1);
  } else if (!phone.startsWith("260")) {
    phone = "260" + phone;
  }

  const payload = {
    type: "transactional",
    unicodeEnabled: false,
    sender: senderPhone,
    recipient: phone,
    content: message
  };

  const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Brevo SMS] Error:", errorText);
    throw new Error(`Brevo SMS error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("[Brevo SMS] Success:", JSON.stringify(result));
  return result;
}

async function sendWhatsAppBrevo(
  to: string,
  message: string,
  settings: BrevoSettings,
  templateId?: string,
  templateParams?: Record<string, string>
): Promise<any> {
  const apiKey = settings.brevo_api_key;

  if (!apiKey) {
    throw new Error("Brevo API key not configured");
  }

  // Format phone number
  let phone = to.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("0")) {
    phone = "+260" + phone.substring(1);
  } else if (!phone.startsWith("+")) {
    phone = "+260" + phone;
  }

  let payload: any;

  if (templateId) {
    // Using approved WhatsApp template
    payload = {
      templateId: templateId,
      senderNumber: settings.brevo_sender_phone,
      contactNumbers: [phone],
      params: templateParams || {}
    };
  } else {
    // Sending session message (only works within 24hr window)
    payload = {
      senderNumber: settings.brevo_sender_phone,
      contactNumbers: [phone],
      text: message
    };
  }

  const response = await fetch("https://api.brevo.com/v3/whatsapp/sendMessage", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Brevo WhatsApp] Error:", errorText);
    throw new Error(`Brevo WhatsApp error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("[Brevo WhatsApp] Success:", JSON.stringify(result));
  return result;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: BrevoNotificationRequest = await req.json();
    const { type, to, message, subject, htmlContent, templateId, templateParams, userId, eventType, attachment } = request;

    if (!type || !to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, to, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[Brevo] Sending ${type} to ${to}`);

    const settings = await getBrevoSettings(supabase);
    
    if (!settings) {
      throw new Error("Brevo settings not configured");
    }

    // Check if the channel is enabled
    if (type === 'email' && !settings.brevo_email_enabled) {
      throw new Error("Email notifications are disabled");
    }
    if (type === 'sms' && !settings.brevo_sms_enabled) {
      throw new Error("SMS notifications are disabled");
    }
    if (type === 'whatsapp' && !settings.brevo_whatsapp_enabled) {
      throw new Error("WhatsApp notifications are disabled");
    }

    let result: any;
    let whatsappTemplateId: string | undefined;

    // Get WhatsApp template ID if eventType is provided
    if (type === 'whatsapp' && eventType) {
      const { data: templateData } = await supabase
        .from('brevo_whatsapp_templates')
        .select('template_id')
        .eq('event_type', eventType)
        .eq('is_active', true)
        .maybeSingle();
      
      if (templateData?.template_id) {
        whatsappTemplateId = templateData.template_id;
      }
    }

    // Route to appropriate method
    if (type === 'email') {
      if (!subject) {
        return new Response(
          JSON.stringify({ error: "Subject required for email notifications" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      result = await sendEmailBrevo(to, subject, message, htmlContent, settings, templateId, templateParams, attachment);
    } else if (type === 'sms') {
      result = await sendSMSBrevo(to, message, settings);
    } else if (type === 'whatsapp') {
      result = await sendWhatsAppBrevo(to, message, settings, whatsappTemplateId, templateParams);
    } else {
      throw new Error(`Unsupported notification type: ${type}`);
    }

    // Log to database
    await supabase.from("notification_logs").insert({
      user_id: userId || null,
      type: type,
      recipient: to,
      title: subject || eventType || "Notification",
      message: message,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_response: { provider: 'brevo', ...result }
    });

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[Brevo] Error:", error);
    
    // Try to log failure
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const request: BrevoNotificationRequest = await req.clone().json();
      await supabase.from("notification_logs").insert({
        user_id: request.userId || null,
        type: request.type,
        recipient: request.to,
        title: request.subject || request.eventType || "Notification",
        message: request.message,
        status: "failed",
        provider_response: { provider: 'brevo', error: error.message }
      });
    } catch (logError) {
      console.error("[Brevo] Error logging failure:", logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);