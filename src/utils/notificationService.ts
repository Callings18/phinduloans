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
    const subject = "🎉 Welcome to Phindu Finance - Your Financial Journey Starts Here!";
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0f23;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #2d1f4e 100%); padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #f97316 100%); border-radius: 20px 20px 0 0; padding: 40px; text-align: center;">
                    <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: white; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                      ✨ PHINDU FINANCE ✨
                    </h1>
                    <p style="margin: 10px 0 0; font-size: 14px; color: rgba(255,255,255,0.9); letter-spacing: 2px;">
                      EMPOWERING YOUR FINANCIAL FUTURE
                    </p>
                  </td>
                </tr>
                
                <!-- Welcome Banner -->
                <tr>
                  <td style="background: linear-gradient(180deg, #1e1e3f 0%, #252550 100%); padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="text-align: center; padding: 40px 30px;">
                          <div style="width: 100px; height: 100px; margin: 0 auto 20px; background: linear-gradient(135deg, #8b5cf6, #d946ef); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 50px;">🎉</span>
                          </div>
                          <h2 style="margin: 0 0 10px; font-size: 28px; color: white; font-weight: 600;">
                            Welcome, ${name}!
                          </h2>
                          <p style="margin: 0; font-size: 16px; color: #a78bfa;">
                            Your account has been created successfully
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="background: #1a1a3e; padding: 40px 30px;">
                    <p style="margin: 0 0 20px; font-size: 16px; color: #e2e8f0; line-height: 1.6;">
                      We're thrilled to have you join the Phindu Finance family! Your journey to financial freedom starts now.
                    </p>
                    
                    <!-- Features Grid -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td style="padding: 15px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(217, 70, 239, 0.1)); border-radius: 12px; border-left: 4px solid #8b5cf6; margin-bottom: 15px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 15px;">
                                <span style="font-size: 24px;">💰</span>
                              </td>
                              <td>
                                <h3 style="margin: 0 0 5px; color: #d8b4fe; font-size: 16px;">Quick Loan Applications</h3>
                                <p style="margin: 0; color: #94a3b8; font-size: 14px;">Apply for loans in minutes with our simple process</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr><td style="height: 15px;"></td></tr>
                      <tr>
                        <td style="padding: 15px; background: linear-gradient(135deg, rgba(217, 70, 239, 0.2), rgba(249, 115, 22, 0.1)); border-radius: 12px; border-left: 4px solid #d946ef;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 15px;">
                                <span style="font-size: 24px;">📊</span>
                              </td>
                              <td>
                                <h3 style="margin: 0 0 5px; color: #f0abfc; font-size: 16px;">Track Your Progress</h3>
                                <p style="margin: 0; color: #94a3b8; font-size: 14px;">Monitor your loans and payments from your dashboard</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr><td style="height: 15px;"></td></tr>
                      <tr>
                        <td style="padding: 15px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(139, 92, 246, 0.1)); border-radius: 12px; border-left: 4px solid #f97316;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 15px;">
                                <span style="font-size: 24px;">🔒</span>
                              </td>
                              <td>
                                <h3 style="margin: 0 0 5px; color: #fdba74; font-size: 16px;">Secure & Reliable</h3>
                                <p style="margin: 0; color: #94a3b8; font-size: 14px;">Your data is protected with bank-grade security</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="https://loan-kindly-flow.lovable.app/dashboard" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); color: white; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 30px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);">
                            🚀 Access Your Dashboard
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Support Section -->
                <tr>
                  <td style="background: linear-gradient(180deg, #252550 0%, #1e1e3f 100%); padding: 30px; text-align: center; border-radius: 0 0 20px 20px;">
                    <p style="margin: 0 0 15px; font-size: 14px; color: #a78bfa;">
                      Need assistance? We're here to help!
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 15px;">
                          <a href="mailto:info@phindu.com" style="color: #d8b4fe; text-decoration: none; font-size: 14px;">
                            📧 info@phindu.com
                          </a>
                        </td>
                        <td style="padding: 0 15px;">
                          <a href="tel:+260123456789" style="color: #d8b4fe; text-decoration: none; font-size: 14px;">
                            📞 +260 123 456 789
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <div style="margin-top: 25px; padding-top: 25px; border-top: 1px solid rgba(139, 92, 246, 0.3);">
                      <p style="margin: 0; font-size: 12px; color: #64748b;">
                        © ${new Date().getFullYear()} Phindu Finance. All rights reserved.
                      </p>
                      <p style="margin: 5px 0 0; font-size: 11px; color: #475569;">
                        Lusaka, Zambia | Licensed by Bank of Zambia
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendMultiChannel({
      userId,
      phone,
      email,
      message,
      subject,
      title: "Welcome",
      htmlContent,
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
