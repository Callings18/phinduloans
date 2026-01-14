import { supabase } from "@/integrations/supabase/client";

export type NotificationType = 'sms' | 'email' | 'whatsapp';

interface NotificationSettings {
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
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
  htmlContent?: string;
  eventType?: string;
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
      const eventKey = `notify_on_${params.eventType}` as keyof NotificationSettings;
      const eventEnabled = settings[eventKey];
      if (eventEnabled === false) {
        console.log(`[Notification Service] ${params.eventType} notifications are disabled`);
        return { success: false, message: "Notification type disabled" };
      }
    }

    // Check if channel is enabled
    let enabled = false;
    if (params.type === 'sms' && settings) {
      enabled = settings.sms_enabled;
    } else if (params.type === 'whatsapp' && settings) {
      enabled = settings.whatsapp_enabled;
    } else if (params.type === 'email' && settings) {
      enabled = settings.email_enabled;
    }

    if (!enabled) {
      console.log(`[Notification Service] ${params.type} notifications not enabled`);
      return { success: false, message: "Channel not enabled" };
    }

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
        },
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || "Failed to send notification");
      }

      return { success: true, data };
    } catch (error: any) {
      console.error("[Notification Service] Error sending notification:", error);
      return { success: false, error: error.message };
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
      // Send SMS
      results.sms = await this.send({
        ...params,
        type: 'sms',
        to: params.phone,
      });

      // Send WhatsApp
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

  // ============================================================================
  // SPECIFIC NOTIFICATION METHODS
  // ============================================================================

  async sendSignupWelcome(userId: string, name: string, phone: string, email?: string) {
    const message = `Welcome to Phindu Finance, ${name}! 🎉\n\nYour account has been created successfully. You can now apply for loans and manage your finances with ease.\n\nContact us at info@phindu.com for any assistance.`;
    const subject = "Welcome to Phindu Finance!";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Welcome",
      eventType: "signup"
    });
  }

  async sendLoanApproval(userId: string, borrowerName: string, amount: number, phone: string, email?: string) {
    const message = `Congratulations ${borrowerName}! ✅\n\nYour loan application for K${amount.toLocaleString()} has been APPROVED.\n\nFunds will be disbursed shortly. Thank you for choosing Phindu Finance.`;
    const subject = `Loan Approved - K${amount.toLocaleString()}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Loan Approved",
      eventType: "loan_approval"
    });
  }

  async sendLoanRejection(userId: string, borrowerName: string, phone: string, email?: string, reason?: string) {
    const reasonText = reason ? `\n\nReason: ${reason}` : "";
    const message = `Dear ${borrowerName},\n\nWe regret to inform you that your loan application was not approved at this time.${reasonText}\n\nPlease contact us for more information.\n\n- Phindu Finance`;
    const subject = "Loan Application Update";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Loan Application Update",
      eventType: "loan_rejection"
    });
  }

  async sendDisbursementConfirmation(userId: string, borrowerName: string, amount: number, reference: string, phone: string, email?: string) {
    const message = `Dear ${borrowerName}, 💰\n\nK${amount.toLocaleString()} has been disbursed to your account.\n\nRef: ${reference}\n\nYour first repayment will be due in 30 days.\n\n- Phindu Finance`;
    const subject = `Loan Disbursed - K${amount.toLocaleString()}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Disbursement Confirmation",
      eventType: "disbursement"
    });
  }

  async sendPaymentConfirmation(userId: string, borrowerName: string, amount: number, remainingBalance: number, phone: string, email?: string) {
    const message = `Dear ${borrowerName}, 🧾\n\nWe have received your payment of K${amount.toLocaleString()}.\n\nRemaining balance: K${remainingBalance.toLocaleString()}\n\nThank you!\n\n- Phindu Finance`;
    const subject = `Payment Received - K${amount.toLocaleString()}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Payment Received",
      eventType: "payment_received"
    });
  }

  async sendPaymentReminder(userId: string, borrowerName: string, amount: number, dueDate: string, phone: string, email?: string) {
    const message = `Dear ${borrowerName}, ⏰\n\nThis is a reminder that your loan repayment of K${amount.toLocaleString()} is due on ${dueDate}.\n\nPlease ensure timely payment to avoid penalties.\n\n- Phindu Finance`;
    const subject = `Payment Reminder - Due ${dueDate}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Payment Reminder",
      eventType: "payment_reminder"
    });
  }

  async sendOverdueNotice(userId: string, borrowerName: string, amount: number, daysOverdue: number, phone: string, email?: string) {
    const message = `Dear ${borrowerName}, ⚠️\n\nYour payment of K${amount.toLocaleString()} is ${daysOverdue} day(s) overdue.\n\nPlease make payment immediately to avoid additional penalties. Contact us if you need assistance.\n\n- Phindu Finance`;
    const subject = `Overdue Payment Notice - ${daysOverdue} Days`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Overdue Notice",
      eventType: "overdue"
    });
  }

  async sendLoanCompletion(userId: string, borrowerName: string, phone: string, email?: string) {
    const message = `Congratulations ${borrowerName}! 🎉\n\nYou have successfully completed all loan repayments. Your account is now clear.\n\nThank you for banking with Phindu Finance. You're welcome to apply for a new loan anytime!`;
    const subject = "Loan Completed - Congratulations!";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Loan Completed",
      eventType: "loan_completion"
    });
  }

  async sendCollectionReminder(userId: string, borrowerName: string, amount: number, escalationLevel: number, phone: string, email?: string) {
    const urgency = escalationLevel >= 3 ? "⚠️ URGENT: " : "";
    const action = escalationLevel >= 3 
      ? "Failure to respond may result in legal action." 
      : "Please contact us immediately to discuss payment arrangements.";
    
    const message = `${urgency}Dear ${borrowerName},\n\nYour account has an outstanding balance of K${amount.toLocaleString()}.\n\n${action}\n\n- Phindu Finance Collections`;
    const subject = `${urgency}Collection Notice - Level ${escalationLevel}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: `Collection Notice - Level ${escalationLevel}`,
      eventType: "overdue"
    });
  }

  // Send OTP via SMS only
  async sendOTP(phone: string, otp: string) {
    const message = `Your Phindu Finance verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share this code with anyone.`;
    
    return this.send({
      type: 'sms',
      to: phone,
      message,
      title: 'OTP Verification',
    });
  }

  // Send custom notification
  async sendCustom(params: {
    phone?: string;
    email?: string;
    message: string;
    subject?: string;
    userId?: string;
  }) {
    return this.sendMultiChannel({
      ...params,
      title: "Custom Notification"
    });
  }
}

export const notificationService = new NotificationService();
