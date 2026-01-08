import { supabase } from "@/integrations/supabase/client";

export type NotificationType = 'sms' | 'email' | 'whatsapp';
export type NotificationProvider = 'africastalking' | 'twilio' | 'sendgrid' | 'smtp';

interface NotificationSettings {
  sms_enabled: boolean;
  sms_provider: 'africastalking' | 'twilio' | 'none';
  whatsapp_enabled: boolean;
  whatsapp_provider: 'africastalking' | 'twilio' | 'none';
  email_enabled: boolean;
  email_provider: 'sendgrid' | 'smtp' | 'none';
  notify_on_signup: boolean;
  notify_on_loan_approval: boolean;
  notify_on_loan_rejection: boolean;
  notify_on_disbursement: boolean;
  notify_on_payment_received: boolean;
  notify_on_payment_reminder: boolean;
  notify_on_overdue: boolean;
  notify_on_loan_completion: boolean;
}

interface SendNotificationParams {
  userId?: string;
  type: NotificationType;
  to: string;
  subject?: string;
  message: string;
  title?: string;
  eventType?: keyof NotificationSettings;
}

class NotificationService {
  private settings: NotificationSettings | null = null;
  private settingsLoadedAt: number = 0;
  private settingsCacheDuration = 5 * 60 * 1000; // 5 minutes

  async getSettings(): Promise<NotificationSettings | null> {
    const now = Date.now();
    
    // Return cached settings if still valid
    if (this.settings && (now - this.settingsLoadedAt) < this.settingsCacheDuration) {
      return this.settings;
    }

    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "notification_providers")
        .maybeSingle();

      if (error) {
        console.error("[Notification Service] Error loading settings:", error);
        return null;
      }

      this.settings = data?.value as unknown as NotificationSettings || null;
      this.settingsLoadedAt = now;
      return this.settings;
    } catch (error) {
      console.error("[Notification Service] Error loading settings:", error);
      return null;
    }
  }

  async send(params: SendNotificationParams) {
    console.log(`[Notification Service] Sending ${params.type} to ${params.to}: ${params.title || params.subject}`);

    const settings = await this.getSettings();
    
    // Check if event type notifications are enabled
    if (params.eventType && settings) {
      const eventEnabled = settings[params.eventType];
      if (!eventEnabled) {
        console.log(`[Notification Service] ${params.eventType} notifications are disabled`);
        return { success: false, message: "Notification type disabled" };
      }
    }

    // Determine provider and check if enabled
    let provider: string | null = null;
    let enabled = false;

    if (params.type === 'sms' && settings) {
      enabled = settings.sms_enabled;
      provider = settings.sms_provider !== 'none' ? settings.sms_provider : null;
    } else if (params.type === 'whatsapp' && settings) {
      enabled = settings.whatsapp_enabled;
      provider = settings.whatsapp_provider !== 'none' ? settings.whatsapp_provider : null;
    } else if (params.type === 'email' && settings) {
      enabled = settings.email_enabled;
      provider = settings.email_provider !== 'none' ? settings.email_provider : null;
    }

    if (!enabled || !provider) {
      console.log(`[Notification Service] ${params.type} notifications not enabled or provider not configured`);
      // Still log to database
      await this.logNotification({
        ...params,
        status: 'disabled',
        provider_response: { note: 'Notifications not enabled or provider not configured' }
      });
      return { success: false, message: "Notifications not enabled" };
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: params.type,
          provider: provider,
          to: params.to,
          subject: params.subject,
          message: params.message,
          title: params.title,
          userId: params.userId,
        },
      });

      if (error) throw error;

      await this.logNotification({
        ...params,
        status: 'sent',
        provider_response: data
      });

      return { success: true, data };
    } catch (error: any) {
      console.error("[Notification Service] Error sending notification:", error);
      
      await this.logNotification({
        ...params,
        status: 'failed',
        provider_response: { error: error.message }
      });

      return { success: false, error };
    }
  }

  private async logNotification(params: SendNotificationParams & { status: string; provider_response?: any }) {
    try {
      await supabase.from('notification_logs').insert({
        user_id: params.userId || null,
        type: params.type,
        recipient: params.to,
        title: params.title || params.subject || "Notification",
        message: params.message,
        status: params.status,
        sent_at: params.status === 'sent' ? new Date().toISOString() : null,
        provider_response: params.provider_response || {}
      });
    } catch (error) {
      console.error("[Notification Service] Error logging notification:", error);
    }
  }

  // Multi-channel send (SMS + Email + WhatsApp)
  async sendMultiChannel(params: Omit<SendNotificationParams, 'type' | 'to'> & { phone?: string; email?: string }) {
    const results = {
      sms: null as any,
      email: null as any,
      whatsapp: null as any
    };

    if (params.phone) {
      results.sms = await this.send({
        ...params,
        type: 'sms',
        to: params.phone,
      });

      results.whatsapp = await this.send({
        ...params,
        type: 'whatsapp',
        to: params.phone,
      });
    }

    if (params.email && params.subject) {
      results.email = await this.send({
        ...params,
        type: 'email',
        to: params.email,
        subject: params.subject,
      });
    }

    return results;
  }

  // Specific notification methods
  async sendSignupWelcome(userId: string, name: string, phone: string, email?: string) {
    const message = `Welcome to Phindu Finance, ${name}! Your account has been created successfully. You can now apply for loans and manage your finances with ease. Contact us at support@phindu.co.zm for any assistance.`;
    const subject = "Welcome to Phindu Finance!";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Welcome",
      eventType: "notify_on_signup"
    });
  }

  async sendLoanApproval(userId: string, borrowerName: string, amount: number, phone: string, email?: string) {
    const message = `Congratulations ${borrowerName}! Your loan application for K${amount.toLocaleString()} has been APPROVED. Funds will be disbursed shortly. Thank you for choosing Phindu Finance.`;
    const subject = `Loan Approved - K${amount.toLocaleString()}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Loan Approved",
      eventType: "notify_on_loan_approval"
    });
  }

  async sendLoanRejection(userId: string, borrowerName: string, phone: string, email?: string, reason?: string) {
    const reasonText = reason ? ` Reason: ${reason}` : "";
    const message = `Dear ${borrowerName}, we regret to inform you that your loan application was not approved at this time.${reasonText} Please contact us for more information. - Phindu Finance`;
    const subject = "Loan Application Update";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Loan Application Update",
      eventType: "notify_on_loan_rejection"
    });
  }

  async sendDisbursementConfirmation(userId: string, borrowerName: string, amount: number, reference: string, phone: string, email?: string) {
    const message = `Dear ${borrowerName}, K${amount.toLocaleString()} has been disbursed to your account. Ref: ${reference}. Your first repayment will be due in 30 days. - Phindu Finance`;
    const subject = `Loan Disbursed - K${amount.toLocaleString()}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Disbursement Confirmation",
      eventType: "notify_on_disbursement"
    });
  }

  async sendPaymentConfirmation(userId: string, borrowerName: string, amount: number, remainingBalance: number, phone: string, email?: string) {
    const message = `Dear ${borrowerName}, we have received your payment of K${amount.toLocaleString()}. Remaining balance: K${remainingBalance.toLocaleString()}. Thank you! - Phindu Finance`;
    const subject = `Payment Received - K${amount.toLocaleString()}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Payment Received",
      eventType: "notify_on_payment_received"
    });
  }

  async sendPaymentReminder(userId: string, borrowerName: string, amount: number, dueDate: string, phone: string, email?: string) {
    const message = `Dear ${borrowerName}, this is a reminder that your loan repayment of K${amount.toLocaleString()} is due on ${dueDate}. Please ensure timely payment to avoid penalties. - Phindu Finance`;
    const subject = `Payment Reminder - Due ${dueDate}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Payment Reminder",
      eventType: "notify_on_payment_reminder"
    });
  }

  async sendOverdueNotice(userId: string, borrowerName: string, amount: number, daysOverdue: number, phone: string, email?: string) {
    const message = `Dear ${borrowerName}, your payment of K${amount.toLocaleString()} is ${daysOverdue} day(s) overdue. Please make payment immediately to avoid additional penalties. Contact us if you need assistance. - Phindu Finance`;
    const subject = `Overdue Payment Notice - ${daysOverdue} Days`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Overdue Notice",
      eventType: "notify_on_overdue"
    });
  }

  async sendLoanCompletion(userId: string, borrowerName: string, phone: string, email?: string) {
    const message = `Congratulations ${borrowerName}! You have successfully completed all loan repayments. Your account is now clear. Thank you for banking with Phindu Finance. You're welcome to apply for a new loan anytime!`;
    const subject = "Loan Completed - Congratulations!";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Loan Completed",
      eventType: "notify_on_loan_completion"
    });
  }

  async sendCollectionReminder(userId: string, borrowerName: string, amount: number, escalationLevel: number, phone: string, email?: string) {
    const urgency = escalationLevel >= 3 ? "URGENT: " : "";
    const action = escalationLevel >= 3 
      ? "Failure to respond may result in legal action." 
      : "Please contact us immediately to discuss payment arrangements.";
    
    const message = `${urgency}Dear ${borrowerName}, your account has an outstanding balance of K${amount.toLocaleString()}. ${action} - Phindu Finance Collections`;
    const subject = `${urgency}Collection Notice - Level ${escalationLevel}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: `Collection Notice - Level ${escalationLevel}`,
      eventType: "notify_on_overdue"
    });
  }
}

export const notificationService = new NotificationService();
