import { supabase } from "@/integrations/supabase/client";

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

        // Log to notification_logs table (Safe to auto-create if missing check?)
        // Assuming notification_logs table exists from previous migrations
        const { error } = await supabase.from('notification_logs' as any).insert({
            user_id: params.userId,
            type: params.type,
            recipient: params.recipient,
            title: params.title,
            message: params.message,
            status: 'sent', // Mocking success for now
            sent_at: new Date().toISOString()
        });

        if (error) {
            console.error("[Notification Service] Error logging notification:", error);
            return { success: false, error };
        }

        return { success: true };
    },

    async sendRepaymentReminder(userId: string, borrowerName: string, amount: number, dueDate: string, phone: string) {
        return this.send({
            userId,
            type: 'sms',
            recipient: phone,
            title: 'Repayment Reminder',
            message: `Hello ${borrowerName}, this is a reminder that your loan repayment of K${amount.toLocaleString()} is due on ${dueDate}. Please ensure your account is funded.`
        });
    },

    async sendLoanApproval(userId: string, borrowerName: string, amount: number, email: string) {
        return this.send({
            userId,
            type: 'email',
            recipient: email,
            title: 'Loan Approved!',
            message: `Congratulations ${borrowerName}! Your loan application for K${amount.toLocaleString()} has been approved. The funds will be disbursed shortly.`
        });
    }
};
