import { supabase } from "@phinduloans/shared/integrations/supabase/client";

export type NotificationType = 'sms' | 'email' | 'whatsapp';

// All supported notification events
export type NotificationEvent = 
  // Account & Application
  | 'signup'
  | 'application_submitted'
  | 'application_under_review'
  | 'kyc_verification'
  | 'document_request'
  // Loan Status
  | 'loan_approval'
  | 'loan_rejection'
  | 'disbursement'
  | 'loan_restructured'
  | 'loan_completion'
  | 'contract_sent'
  // Payments
  | 'payment_received'
  | 'partial_payment'
  | 'payment_reminder'
  | 'overdue'
  | 'collection_escalation'
  | 'court_case'
  // Other
  | 'statement_available'
  | 'promotion';

interface NotificationSettings {
  // Channel enablement
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  
  // Event triggers
  notify_on_signup: boolean;
  notify_on_application_submitted: boolean;
  notify_on_application_under_review: boolean;
  notify_on_kyc_verification: boolean;
  notify_on_document_request: boolean;
  notify_on_loan_approval: boolean;
  notify_on_loan_rejection: boolean;
  notify_on_disbursement: boolean;
  notify_on_loan_restructured: boolean;
  notify_on_loan_completion: boolean;
  notify_on_payment_received: boolean;
  notify_on_partial_payment: boolean;
  notify_on_payment_reminder: boolean;
  notify_on_overdue: boolean;
  notify_on_collection_escalation: boolean;
  notify_on_statement_available: boolean;
  notify_on_promotion: boolean;
  notify_on_court_case: boolean;
  notify_on_contract_sent: boolean;
}

interface SendNotificationParams {
  userId?: string;
  type: NotificationType;
  to: string;
  subject?: string;
  message: string;
  title?: string;
  htmlContent?: string;
  eventType?: NotificationEvent;
  attachment?: {
    content: string; // Base64 encoded
    name: string;
  };
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

  // Clear settings cache to force reload
  clearCache() {
    this.settings = null;
    this.settingsLoadedAt = 0;
  }

  private async isDuplicateWithinWindow(params: SendNotificationParams, windowMinutes = 10) {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("notification_logs")
      .select("id")
      .eq("recipient", params.to)
      .eq("type", params.type)
      .eq("title", params.title ?? params.subject ?? null)
      .eq("message", params.message ?? null)
      .gte("created_at", cutoff)
      .limit(1);
    if (error) {
      console.warn("[Notification Service] Dedup check failed:", error.message);
      return false;
    }
    return Boolean(data && data.length > 0);
  }

  private async invokeProvider(params: SendNotificationParams) {
    return supabase.functions.invoke("send-notification", {
      body: {
        type: params.type,
        to: params.to,
        subject: params.subject,
        message: params.message,
        title: params.title,
        htmlContent: params.htmlContent,
        userId: params.userId,
        eventType: params.eventType,
      },
    });
  }

  async send(params: SendNotificationParams) {
    if (import.meta.env.DEV) console.log(`[Notification Service] Sending ${params.type} to ${params.to}: ${params.title || params.subject}`);

    const settings = await this.getSettings();
    
    // Check if event type notifications are enabled
    if (params.eventType && settings) {
      const eventKey = `notify_on_${params.eventType}` as keyof NotificationSettings;
      const eventEnabled = settings[eventKey];
      if (eventEnabled === false) {
        if (import.meta.env.DEV) console.log(`[Notification Service] ${params.eventType} notifications are disabled`);
        return { success: false, message: "Notification type disabled" };
      }
    }

    // Email is no longer supported - SMS/WhatsApp only
    if (params.type === 'email') {
      if (import.meta.env.DEV) console.log("[Notification Service] Email channel disabled - skipping");
      return { success: false, message: "Email channel disabled" };
    }

    // Check if channel is enabled
    let enabled = true;
    if (params.type === 'sms' && settings) {
      enabled = settings.sms_enabled !== false;
    } else if (params.type === 'whatsapp' && settings) {
      enabled = settings.whatsapp_enabled !== false;
    }

    if (!enabled) {
      if (import.meta.env.DEV) console.log(`[Notification Service] ${params.type} notifications not enabled`);
      return { success: false, message: "Channel not enabled" };
    }

    try {
      const isDuplicate = await this.isDuplicateWithinWindow(params, 10);
      if (isDuplicate) {
        if (import.meta.env.DEV) console.log(`[Notification Service] Duplicate suppressed for ${params.type} to ${params.to}`);
        return { success: true, skipped: true, message: "Duplicate suppressed" };
      }

      let { data, error } = await this.invokeProvider(params);
      if (error || !data?.success) {
        // One safe retry to reduce transient provider failures
        await new Promise((resolve) => setTimeout(resolve, 800));
        const retry = await this.invokeProvider(params);
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || "Failed to send notification");
      }

      return { success: true, data };
    } catch (error: any) {
      await supabase.from("notification_logs").insert({
        user_id: params.userId ?? null,
        type: params.type,
        recipient: params.to,
        subject: params.subject ?? null,
        title: params.title ?? params.subject ?? `${params.type.toUpperCase()} Notification`,
        message: error?.message ?? String(error),
        status: "failed",
      });
      console.error('[NotificationService] Error:', error?.message, {
        component: 'NotificationService',
        action: `send_${params.type}`,
        metadata: { recipient: params.to, eventType: params.eventType },
      });
      return { success: false, error: error.message };
    }
  }

  // Multi-channel send (SMS + WhatsApp only - email is no longer supported)
  async sendMultiChannel(params: Omit<SendNotificationParams, 'type' | 'to'> & { phone?: string; email?: string }) {
    const results = {
      sms: null as any,
      email: null as any,
      whatsapp: null as any
    };

    const promises: Promise<any>[] = [];

    if (params.phone) {
      // Send SMS
      promises.push(
        this.send({
          ...params,
          type: 'sms',
          to: params.phone,
        }).then(r => { results.sms = r; })
      );

      // Send WhatsApp
      promises.push(
        this.send({
          ...params,
          type: 'whatsapp',
          to: params.phone,
        }).then(r => { results.whatsapp = r; })
      );
    }

    await Promise.all(promises);
    return results;
  }

  // ============================================================================
  // ACCOUNT & APPLICATION NOTIFICATIONS
  // ============================================================================

  async sendSignupWelcome(userId: string, name: string, phone: string, email?: string) {
    const message = `Welcome to Phindu Finance, ${name}!\n\nYour account has been created successfully. You can now apply for loans and manage your finances with ease.\n\nContact us at info@phindu.com for any assistance.`;
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

  async sendApplicationSubmitted(userId: string, borrowerName: string, refNo: string, phone: string, email?: string) {
    const message = `Hi ${borrowerName}, your loan application (Ref: ${refNo}) has been received. We'll review it and get back to you within 24-48 hours.\n\n- Phindu Finance`;
    const subject = `Loan Application Received - Ref: ${refNo}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Application Received",
      eventType: "application_submitted"
    });
  }

  async sendApplicationUnderReview(userId: string, borrowerName: string, phone: string, email?: string) {
    const message = `Hi ${borrowerName}, your loan application is now being reviewed by our team. We'll notify you once a decision is made.\n\n- Phindu Finance`;
    const subject = "Application Under Review";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Under Review",
      eventType: "application_under_review"
    });
  }

  async sendKYCVerification(userId: string, borrowerName: string, status: 'pending' | 'verified' | 'failed', phone: string, email?: string) {
    const messages = {
      pending: `Hi ${borrowerName}, please complete your KYC verification to proceed with your loan application. Login to your account to submit the required documents.\n\n- Phindu Finance`,
      verified: `Hi ${borrowerName}, your identity has been verified successfully. Your loan application can now proceed to the next stage.\n\n- Phindu Finance`,
      failed: `Hi ${borrowerName}, we couldn't verify your identity with the documents provided. Please login and upload clearer documents.\n\n- Phindu Finance`
    };
    const subjects = {
      pending: "Complete Your KYC Verification",
      verified: "KYC Verification Successful",
      failed: "KYC Verification - Action Required"
    };

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message: messages[status],
      subject: subjects[status],
      title: "KYC Verification",
      eventType: "kyc_verification"
    });
  }

  async sendDocumentRequest(userId: string, borrowerName: string, documentTypes: string, phone: string, email?: string) {
    const message = `Hi ${borrowerName}, we need additional documents to process your loan application:\n\n${documentTypes}\n\nPlease upload these via your account.\n\n- Phindu Finance`;
    const subject = "Additional Documents Required";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Document Request",
      eventType: "document_request"
    });
  }

  // ============================================================================
  // LOAN STATUS NOTIFICATIONS
  // ============================================================================

  async sendLoanApproval(userId: string, borrowerName: string, amount: number, phone: string, email?: string) {
    const message = `Congratulations ${borrowerName}!\n\nYour loan application for K${amount.toLocaleString()} has been APPROVED.\n\nFunds will be disbursed shortly. Thank you for choosing Phindu Finance.`;
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
    const message = `Dear ${borrowerName},\n\nK${amount.toLocaleString()} has been disbursed to your account.\n\nRef: ${reference}\n\nYour first repayment will be due as per your loan schedule.\n\n- Phindu Finance`;
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

  async sendLoanRestructured(userId: string, borrowerName: string, newTerms: string, phone: string, email?: string) {
    const message = `Hi ${borrowerName},\n\nYour loan has been restructured as per your request.\n\nNew Terms:\n${newTerms}\n\nLogin to your account to view the updated payment schedule.\n\n- Phindu Finance`;
    const subject = "Loan Restructure Confirmation";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Loan Restructured",
      eventType: "loan_restructured"
    });
  }

  async sendLoanCompletion(userId: string, borrowerName: string, phone: string, email?: string) {
    const message = `Congratulations ${borrowerName}!\n\nYou have successfully completed all loan repayments. Your account is now clear.\n\nThank you for banking with Phindu Finance. You're welcome to apply for a new loan anytime!`;
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

  async sendContractSent(userId: string, borrowerName: string, loanAmount: number, phone: string, email?: string) {
    const message = `Hi ${borrowerName},\n\nYour loan contract for K${loanAmount.toLocaleString()} has been sent to your email. Please review and sign it to proceed with disbursement.\n\n- Phindu Finance`;
    const subject = "Loan Contract Ready for Signing";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Contract Sent",
      eventType: "contract_sent"
    });
  }

  // ============================================================================
  // PAYMENT NOTIFICATIONS
  // ============================================================================

  async sendPaymentConfirmation(userId: string, borrowerName: string, amount: number, remainingBalance: number, phone: string, email?: string) {
    const message = `Dear ${borrowerName},\n\nWe have received your payment of K${amount.toLocaleString()}.\n\nRemaining balance: K${remainingBalance.toLocaleString()}\n\nThank you!\n\n- Phindu Finance`;
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

  async sendPartialPaymentConfirmation(userId: string, borrowerName: string, amountPaid: number, amountDue: number, remaining: number, phone: string, email?: string) {
    const message = `Dear ${borrowerName},\n\nWe have received a partial payment of K${amountPaid.toLocaleString()}.\n\nAmount due was: K${amountDue.toLocaleString()}\nRemaining balance: K${remaining.toLocaleString()}\n\nPlease complete your payment to stay current.\n\n- Phindu Finance`;
    const subject = `Partial Payment Received - K${amountPaid.toLocaleString()}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Partial Payment",
      eventType: "partial_payment"
    });
  }

  async sendPaymentReminder(userId: string, borrowerName: string, amount: number, dueDate: string, phone: string, email?: string) {
    const message = `Dear ${borrowerName},\n\nThis is a reminder that your loan repayment of K${amount.toLocaleString()} is due on ${dueDate}.\n\nPlease ensure timely payment to avoid penalties.\n\n- Phindu Finance`;
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
    const message = `Dear ${borrowerName},\n\nYour payment of K${amount.toLocaleString()} is ${daysOverdue} day(s) overdue.\n\nPlease make payment immediately to avoid additional penalties. Contact us if you need assistance.\n\n- Phindu Finance`;
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

  async sendCollectionEscalation(userId: string, borrowerName: string, amount: number, escalationLevel: number, phone: string, email?: string) {
    const urgency = escalationLevel >= 3 ? "URGENT: " : "";
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
      eventType: "collection_escalation"
    });
  }

  async sendCourtCaseNotice(userId: string, borrowerName: string, caseNumber: string, amount: number, phone: string, email?: string) {
    const message = `LEGAL NOTICE: Dear ${borrowerName},\n\nDue to non-payment of your outstanding balance of K${amount.toLocaleString()}, legal proceedings have been initiated.\n\nCase Number: ${caseNumber}\n\nPlease contact our legal department immediately.\n\n- Phindu Finance Legal`;
    const subject = `LEGAL NOTICE - Case ${caseNumber}`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Court Case Notice",
      eventType: "court_case"
    });
  }

  // ============================================================================
  // OTHER NOTIFICATIONS
  // ============================================================================

  async sendStatementAvailable(userId: string, borrowerName: string, period: string, phone: string, email?: string) {
    const message = `Hi ${borrowerName},\n\nYour ${period} account statement is now available.\n\nLogin to your account to view or download your statement.\n\n- Phindu Finance`;
    const subject = `Your ${period} Statement is Ready`;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Statement Available",
      eventType: "statement_available"
    });
  }

  async sendPromotion(userId: string, borrowerName: string, offer: string, phone: string, email?: string) {
    const message = `Hi ${borrowerName}!\n\nWe have a special offer for you:\n\n${offer}\n\nApply now at app.phindu.com\n\n- Phindu Finance`;
    const subject = "Special Offer Just for You!";

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Promotion",
      eventType: "promotion"
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

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

  // Bulk send notifications (e.g., for payment reminders)
  async sendBulk(notifications: Array<{
    userId: string;
    borrowerName: string;
    phone: string;
    email?: string;
    message: string;
    subject: string;
    eventType: NotificationEvent;
  }>) {
    const results = [];
    for (const notification of notifications) {
      try {
        const result = await this.sendMultiChannel({
          userId: notification.userId,
          phone: notification.phone,
          email: notification.email,
          message: notification.message,
          subject: notification.subject,
          title: notification.subject,
          eventType: notification.eventType
        });
        results.push({ ...notification, success: true, result });
      } catch (error) {
        results.push({ ...notification, success: false, error });
      }
    }
    return results;
  }
}

export const notificationService = new NotificationService();
