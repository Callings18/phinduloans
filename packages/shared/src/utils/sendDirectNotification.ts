// Direct notification sending utility - bypasses UI settings checks
// Used for admin-initiated actions like sending contracts via Email/WhatsApp

import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { toast } from "sonner";

export type NotificationType = 'sms' | 'whatsapp' | 'email';

interface SendDirectNotificationParams {
  type: NotificationType;
  to: string;
  message: string;
  subject?: string;
  title?: string;
  userId?: string;
  htmlContent?: string;
  eventType?: string;
  mediaUrl?: string; // For WhatsApp media attachments
}

/**
 * Sends a notification directly via the edge function without checking UI settings.
 * Use this for admin-initiated actions where the admin explicitly clicks a button.
 */
export async function sendDirectNotification(params: SendDirectNotificationParams) {
  if (import.meta.env.DEV) console.log(`[Direct Notification] Sending ${params.type} to ${params.to}`);
  
  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: {
        type: params.type,
        to: params.to,
        subject: params.subject,
        message: params.message,
        title: params.title,
        htmlContent: params.htmlContent,
        userId: params.userId,
        eventType: params.eventType,
        mediaUrl: params.mediaUrl,
      },
    });

    if (error) {
      console.error("[Direct Notification] Edge function error:", error);
      throw error;
    }
    
    if (!data?.success) {
      const errorMsg = data?.error || "Failed to send notification";
      console.error("[Direct Notification] API error:", errorMsg);
      throw new Error(errorMsg);
    }

    if (import.meta.env.DEV) console.log("[Direct Notification] Success:", data);
    return { success: true, data };
  } catch (error: any) {
    console.error("[Direct Notification] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send an SMS via Twilio (through edge function)
 */
export async function sendSMSDirect(to: string, message: string, title?: string) {
  const result = await sendDirectNotification({
    type: 'sms',
    to,
    message,
    title,
  });
  
  if (result.success) {
    toast.success(`SMS sent to ${to}`);
  } else {
    toast.error(`Failed to send SMS: ${result.error}`);
  }
  
  return result;
}

/**
 * Send a WhatsApp message via Twilio (through edge function)
 */
export async function sendWhatsAppDirect(
  to: string, 
  message: string, 
  title?: string,
  mediaUrl?: string
) {
  const result = await sendDirectNotification({
    type: 'whatsapp',
    to,
    message,
    title,
    mediaUrl,
  });
  
  if (result.success) {
    toast.success(`WhatsApp message sent to ${to}`);
  } else {
    toast.error(`Failed to send WhatsApp: ${result.error}`);
  }
  
  return result;
}

/**
 * Send an email directly (through edge function)
 */
export async function sendEmailDirect(
  to: string,
  subject: string,
  message: string,
  htmlContent?: string,
) {
  const result = await sendDirectNotification({
    type: 'email',
    to,
    subject,
    title: subject,
    message,
    htmlContent,
  });

  if (result.success) {
    toast.success(`Email sent to ${to}`);
  } else {
    toast.error(`Failed to send email: ${result.error}`);
  }

  return result;
}
