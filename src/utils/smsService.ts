import { supabase } from "@/integrations/supabase/client";

export interface SMSParams {
  to: string | string[];
  message: string;
  userId?: string;
  title?: string;
}

export const smsService = {
  async send(params: SMSParams) {
    console.log("[SMS Service] Sending SMS:", params);
    
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: params
    });

    if (error) {
      console.error("[SMS Service] Error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  },

  async sendPaymentReminder(
    phone: string,
    borrowerName: string,
    amount: number,
    dueDate: string,
    userId?: string
  ) {
    return this.send({
      to: phone,
      message: `Dear ${borrowerName}, this is a reminder that your loan repayment of K${amount.toLocaleString()} is due on ${dueDate}. Please ensure timely payment to avoid penalties. - Phindu Finance`,
      userId,
      title: "Payment Reminder"
    });
  },

  async sendOverdueNotice(
    phone: string,
    borrowerName: string,
    amount: number,
    daysOverdue: number,
    userId?: string
  ) {
    return this.send({
      to: phone,
      message: `Dear ${borrowerName}, your payment of K${amount.toLocaleString()} is ${daysOverdue} day(s) overdue. Please make payment immediately to avoid additional penalties. Contact us if you need assistance. - Phindu Finance`,
      userId,
      title: "Overdue Notice"
    });
  },

  async sendLoanApproval(
    phone: string,
    borrowerName: string,
    amount: number,
    userId?: string
  ) {
    return this.send({
      to: phone,
      message: `Congratulations ${borrowerName}! Your loan application for K${amount.toLocaleString()} has been APPROVED. Funds will be disbursed shortly. Thank you for choosing Phindu Finance.`,
      userId,
      title: "Loan Approved"
    });
  },

  async sendLoanRejection(
    phone: string,
    borrowerName: string,
    reason?: string,
    userId?: string
  ) {
    const reasonText = reason ? ` Reason: ${reason}` : "";
    return this.send({
      to: phone,
      message: `Dear ${borrowerName}, we regret to inform you that your loan application was not approved at this time.${reasonText} Please contact us for more information. - Phindu Finance`,
      userId,
      title: "Loan Application Update"
    });
  },

  async sendDisbursementConfirmation(
    phone: string,
    borrowerName: string,
    amount: number,
    reference: string,
    userId?: string
  ) {
    return this.send({
      to: phone,
      message: `Dear ${borrowerName}, K${amount.toLocaleString()} has been disbursed to your account. Ref: ${reference}. Your first repayment will be due in 30 days. - Phindu Finance`,
      userId,
      title: "Disbursement Confirmation"
    });
  },

  async sendPaymentConfirmation(
    phone: string,
    borrowerName: string,
    amount: number,
    remainingBalance: number,
    userId?: string
  ) {
    return this.send({
      to: phone,
      message: `Dear ${borrowerName}, we have received your payment of K${amount.toLocaleString()}. Remaining balance: K${remainingBalance.toLocaleString()}. Thank you! - Phindu Finance`,
      userId,
      title: "Payment Received"
    });
  },

  async sendLoanCompletion(
    phone: string,
    borrowerName: string,
    userId?: string
  ) {
    return this.send({
      to: phone,
      message: `Congratulations ${borrowerName}! You have successfully completed all loan repayments. Your account is now clear. Thank you for banking with Phindu Finance. You're welcome to apply for a new loan anytime!`,
      userId,
      title: "Loan Completed"
    });
  },

  async sendCollectionReminder(
    phone: string,
    borrowerName: string,
    amount: number,
    escalationLevel: number,
    userId?: string
  ) {
    const urgency = escalationLevel >= 3 ? "URGENT: " : "";
    const action = escalationLevel >= 3 
      ? "Failure to respond may result in legal action." 
      : "Please contact us immediately to discuss payment arrangements.";
    
    return this.send({
      to: phone,
      message: `${urgency}Dear ${borrowerName}, your account has an outstanding balance of K${amount.toLocaleString()}. ${action} - Phindu Finance Collections`,
      userId,
      title: `Collection Notice - Level ${escalationLevel}`
    });
  }
};
