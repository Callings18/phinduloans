import { supabase } from "@/integrations/supabase/client";
import { smsService } from "./smsService";

export type NotificationType = 'sms' | 'email' | 'push';

interface SendNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    recipient: string;
}

export const notificationService = {
    async send(params: SendNotificationParams) {
        console.log(`[Notification Service] Sending ${params.type} to ${params.recipient}: ${params.title}`);

        // For SMS, use the SMS service
        if (params.type === 'sms') {
            const result = await smsService.send({
                to: params.recipient,
                message: params.message,
                userId: params.userId,
                title: params.title
            });
            return result;
        }

        // For other types, log to notification_logs table
        const { error } = await supabase.from('notification_logs').insert({
            user_id: params.userId,
            type: params.type,
            recipient: params.recipient,
            title: params.title,
            message: params.message,
            status: 'sent',
            sent_at: new Date().toISOString()
        });

        if (error) {
            console.error("[Notification Service] Error logging notification:", error);
            return { success: false, error };
        }

        return { success: true };
    },

    async sendRepaymentReminder(userId: string, borrowerName: string, amount: number, dueDate: string, phone: string) {
        return smsService.sendPaymentReminder(phone, borrowerName, amount, dueDate, userId);
    },

    async sendOverdueNotice(userId: string, borrowerName: string, amount: number, daysOverdue: number, phone: string) {
        return smsService.sendOverdueNotice(phone, borrowerName, amount, daysOverdue, userId);
    },

    async sendLoanApproval(userId: string, borrowerName: string, amount: number, phone: string) {
        return smsService.sendLoanApproval(phone, borrowerName, amount, userId);
    },

    async sendLoanRejection(userId: string, borrowerName: string, phone: string, reason?: string) {
        return smsService.sendLoanRejection(phone, borrowerName, reason, userId);
    },

    async sendDisbursementConfirmation(userId: string, borrowerName: string, amount: number, reference: string, phone: string) {
        return smsService.sendDisbursementConfirmation(phone, borrowerName, amount, reference, userId);
    },

    async sendPaymentConfirmation(userId: string, borrowerName: string, amount: number, remainingBalance: number, phone: string) {
        return smsService.sendPaymentConfirmation(phone, borrowerName, amount, remainingBalance, userId);
    },

    async sendLoanCompletion(userId: string, borrowerName: string, phone: string) {
        return smsService.sendLoanCompletion(phone, borrowerName, userId);
    },

    async sendCollectionReminder(userId: string, borrowerName: string, amount: number, escalationLevel: number, phone: string) {
        return smsService.sendCollectionReminder(phone, borrowerName, amount, escalationLevel, userId);
    }
};
