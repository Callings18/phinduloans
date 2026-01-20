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
  eventType?: string;
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
        .eq("key", "brevo_settings")
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

    // Check if channel is enabled based on brevo settings
    const brevoSettings = settings as any;
    let enabled = false;
    if (params.type === 'sms' && brevoSettings) {
      enabled = brevoSettings.brevo_sms_enabled;
    } else if (params.type === 'whatsapp' && brevoSettings) {
      enabled = brevoSettings.brevo_whatsapp_enabled;
    } else if (params.type === 'email' && brevoSettings) {
      enabled = brevoSettings.brevo_email_enabled;
    }

    if (!enabled) {
      console.log(`[Notification Service] ${params.type} notifications not enabled`);
      return { success: false, message: "Channel not enabled" };
    }

    try {
      // Use Brevo edge function for all notifications
      const { data, error } = await supabase.functions.invoke("brevo-notification", {
        body: {
          type: params.type,
          to: params.to,
          subject: params.subject,
          message: params.message,
          title: params.title,
          htmlContent: params.htmlContent,
          userId: params.userId,
          eventType: params.eventType,
          attachment: params.attachment,
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

  // Multi-channel send (SMS + Email)
  async sendMultiChannel(params: Omit<SendNotificationParams, 'type' | 'to'> & { phone?: string; email?: string }) {
    const results = {
      sms: null as any,
      email: null as any,
    };

    if (params.phone) {
      // Send SMS via Brevo
      results.sms = await this.send({
        ...params,
        type: 'sms',
        to: params.phone,
      });
    }

    if (params.email && params.subject) {
      // Send Email via Brevo
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

  // Send contract via email with PDF attachment
  async sendContractEmail(
    userId: string, 
    borrowerName: string, 
    borrowerEmail: string, 
    loanAmount: number,
    contractPdfBase64: string
  ) {
    const subject = `Your Loan Contract - K${loanAmount.toLocaleString()} - Phindu Finance`;
    const message = `Dear ${borrowerName},\n\nPlease find attached your loan contract for K${loanAmount.toLocaleString()}.\n\nKindly review and sign the contract at your earliest convenience.\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\nPhindu Finance Team`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a2e; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Phindu Finance</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Dear ${borrowerName},</h2>
          <p>Please find attached your loan contract for <strong>K${loanAmount.toLocaleString()}</strong>.</p>
          <p>Kindly review and sign the contract at your earliest convenience.</p>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <br>
          <p>Best regards,<br><strong>Phindu Finance Team</strong></p>
        </div>
        <div style="background: #1a1a2e; color: white; padding: 10px; text-align: center; font-size: 12px;">
          <p>© 2024 Phindu Finance. All rights reserved.</p>
        </div>
      </div>
    `;

    return this.send({
      userId,
      type: 'email',
      to: borrowerEmail,
      subject,
      message,
      htmlContent,
      eventType: 'contract_sent',
      attachment: {
        content: contractPdfBase64,
        name: `Loan_Contract_${borrowerName.replace(/\s+/g, '_')}.pdf`
      }
    });
  }

  // Send court case notification to borrower
  async sendCourtCaseNotificationToBorrower(
    userId: string,
    borrowerName: string,
    borrowerPhone: string,
    borrowerEmail: string,
    claimAmount: number,
    courtName?: string,
    hearingDate?: string
  ) {
    const courtInfo = courtName ? `\n\nCourt: ${courtName}` : "";
    const hearingInfo = hearingDate ? `\nHearing Date: ${hearingDate}` : "";
    
    const message = `Dear ${borrowerName},\n\n⚖️ LEGAL NOTICE\n\nDue to non-payment of your outstanding loan balance of K${claimAmount.toLocaleString()}, we have initiated legal proceedings against you.${courtInfo}${hearingInfo}\n\nTo avoid further legal action, please contact us immediately to settle your account.\n\n- Phindu Finance Legal Department`;
    
    const subject = `Legal Notice - Court Case Filed - K${claimAmount.toLocaleString()}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">⚖️ LEGAL NOTICE</h1>
        </div>
        <div style="padding: 20px; background: #fef2f2; border: 2px solid #dc2626;">
          <h2>Dear ${borrowerName},</h2>
          <p>Due to non-payment of your outstanding loan balance of <strong>K${claimAmount.toLocaleString()}</strong>, we have initiated legal proceedings against you.</p>
          ${courtName ? `<p><strong>Court:</strong> ${courtName}</p>` : ''}
          ${hearingDate ? `<p><strong>Hearing Date:</strong> ${hearingDate}</p>` : ''}
          <p style="color: #dc2626; font-weight: bold;">To avoid further legal action, please contact us immediately to settle your account.</p>
          <br>
          <p>Phindu Finance Legal Department</p>
        </div>
      </div>
    `;

    return this.sendMultiChannel({
      userId,
      phone: borrowerPhone,
      email: borrowerEmail,
      message,
      subject,
      htmlContent,
      eventType: 'court_case'
    });
  }

  // Send court case notification to lawyer
  async sendCourtCaseNotificationToLawyer(
    lawyerName: string,
    lawyerEmail: string,
    lawyerPhone: string | undefined,
    borrowerName: string,
    claimAmount: number,
    loanDetails: {
      loanId: string;
      phone: string;
      email: string;
      address?: string;
    }
  ) {
    const subject = `New Court Case Assignment - ${borrowerName} - K${claimAmount.toLocaleString()}`;
    
    const message = `Dear ${lawyerName},\n\nA new court case has been assigned to you.\n\nDefendant: ${borrowerName}\nClaim Amount: K${claimAmount.toLocaleString()}\nContact: ${loanDetails.phone}\nEmail: ${loanDetails.email}\n\nPlease review the case details and proceed accordingly.\n\n- Phindu Finance`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a2e; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">New Case Assignment</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Dear ${lawyerName},</h2>
          <p>A new court case has been assigned to you.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f0f0f0;"><strong>Defendant</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${borrowerName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f0f0f0;"><strong>Claim Amount</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">K${claimAmount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f0f0f0;"><strong>Contact Phone</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${loanDetails.phone}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f0f0f0;"><strong>Contact Email</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${loanDetails.email}</td>
            </tr>
            ${loanDetails.address ? `<tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f0f0f0;"><strong>Address</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${loanDetails.address}</td>
            </tr>` : ''}
          </table>
          <p>Please review the case details and proceed accordingly.</p>
          <br>
          <p>Best regards,<br><strong>Phindu Finance</strong></p>
        </div>
      </div>
    `;

    // Send email to lawyer
    const emailResult = await this.send({
      type: 'email',
      to: lawyerEmail,
      subject,
      message,
      htmlContent,
      eventType: 'court_case'
    });

    // Also send SMS to lawyer if phone available
    let smsResult = null;
    if (lawyerPhone) {
      smsResult = await this.send({
        type: 'sms',
        to: lawyerPhone,
        message: `New case assigned: ${borrowerName}, K${claimAmount.toLocaleString()}. Check email for details. - Phindu Finance`
      });
    }

    return { email: emailResult, sms: smsResult };
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
