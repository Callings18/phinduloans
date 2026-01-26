// Legacy SMS service - now uses the unified notification service with Twilio
import { notificationService } from "./notificationService";

export interface SMSParams {
  to: string | string[];
  message: string;
  userId?: string;
  title?: string;
}

export const smsService = {
  async send(params: SMSParams) {
    console.log("[SMS Service] Sending SMS via Twilio:", params);
    
    // Handle array of recipients
    if (Array.isArray(params.to)) {
      const results = await Promise.all(
        params.to.map(recipient =>
          notificationService.send({
            type: 'sms',
            to: recipient,
            message: params.message,
            userId: params.userId,
            title: params.title,
          })
        )
      );
      return { success: results.every(r => r.success), results };
    }

    // Single recipient
    return notificationService.send({
      type: 'sms',
      to: params.to,
      message: params.message,
      userId: params.userId,
      title: params.title,
    });
  },

  async sendPaymentReminder(
    phone: string,
    borrowerName: string,
    amount: number,
    dueDate: string,
    userId?: string
  ) {
    return notificationService.sendPaymentReminder(
      userId || '',
      borrowerName,
      amount,
      dueDate,
      phone
    );
  },

  async sendOverdueNotice(
    phone: string,
    borrowerName: string,
    amount: number,
    daysOverdue: number,
    userId?: string
  ) {
    return notificationService.sendOverdueNotice(
      userId || '',
      borrowerName,
      amount,
      daysOverdue,
      phone
    );
  },

  async sendLoanApproval(
    phone: string,
    borrowerName: string,
    amount: number,
    userId?: string
  ) {
    return notificationService.sendLoanApproval(
      userId || '',
      borrowerName,
      amount,
      phone
    );
  },

  async sendLoanRejection(
    phone: string,
    borrowerName: string,
    reason?: string,
    userId?: string
  ) {
    return notificationService.sendLoanRejection(
      userId || '',
      borrowerName,
      phone,
      undefined, // email
      reason
    );
  },

  async sendDisbursementConfirmation(
    phone: string,
    borrowerName: string,
    amount: number,
    reference: string,
    userId?: string
  ) {
    return notificationService.sendDisbursementConfirmation(
      userId || '',
      borrowerName,
      amount,
      reference,
      phone
    );
  },

  async sendPaymentConfirmation(
    phone: string,
    borrowerName: string,
    amount: number,
    remainingBalance: number,
    userId?: string
  ) {
    return notificationService.sendPaymentConfirmation(
      userId || '',
      borrowerName,
      amount,
      remainingBalance,
      phone
    );
  },

  async sendLoanCompletion(
    phone: string,
    borrowerName: string,
    userId?: string
  ) {
    return notificationService.sendLoanCompletion(
      userId || '',
      borrowerName,
      phone
    );
  },

  async sendCollectionReminder(
    phone: string,
    borrowerName: string,
    amount: number,
    escalationLevel: number,
    userId?: string
  ) {
    return notificationService.sendCollectionEscalation(
      userId || '',
      borrowerName,
      amount,
      escalationLevel,
      phone
    );
  }
};
