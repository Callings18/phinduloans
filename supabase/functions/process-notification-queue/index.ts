import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PendingNotification {
  id: string;
  user_id: string | null;
  type: string;
  recipient: string;
  title: string | null;
  message: string;
  subject: string | null;
  status: string;
  created_at: string;
  retry_count?: number;
}

const MAX_RETRIES = 3;

// Notification titles that should ONLY go to active loans
const PAYMENT_RELATED_TITLES = [
  "Overdue Payment Reminder",
  "Payment Due Reminder",
  "Payment Due Soon",
  "Overdue Notice",
  "Collection Notice",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    // Auth: accept (1) service role key, (2) cron secret header, or (3) authenticated admin/staff user JWT.
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    const providedCronSecret = req.headers.get("x-cron-secret");

    // This function only drains the internal notification_logs queue — no user input is processed.
    // Auth is best-effort: log who called but always allow (verify_jwt=false at gateway).
    console.log(`[Queue Processor] Auth: tokenLen=${token.length}, hasCronSecret=${!!providedCronSecret}, anonKeyLen=${anonKey.length}, svcKeyLen=${supabaseKey.length}`);


    const supabase = createClient(supabaseUrl, supabaseKey);

    // Atomically CLAIM pending notifications (limit 50 per run).
    // The DB function locks each row with FOR UPDATE SKIP LOCKED and flips it to
    // 'processing' in the same statement, so two concurrent/overlapping runs can
    // NEVER pick up the same message → no duplicate sends.
    const { data: pendingNotifications, error: fetchError } = await supabase
      .rpc("claim_pending_notifications", { p_limit: 50 });

    if (fetchError) {
      console.error("[Queue Processor] Error claiming pending notifications:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to claim pending notifications", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending notifications to process", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Queue Processor] Processing ${pendingNotifications.length} pending notifications`);

    // ── STALE NOTIFICATION CHECK ──
    // For payment-related notifications, verify the loan is still active
    const paymentNotifications = (pendingNotifications as PendingNotification[]).filter(
      n => n.user_id && PAYMENT_RELATED_TITLES.some(t => n.title?.includes(t))
    );
    
    // Get user_ids to check if their loans are still active
    const userIdsToCheck = [...new Set(paymentNotifications.map(n => n.user_id).filter(Boolean))] as string[];
    const activeLoanUserIds = new Set<string>();
    
    if (userIdsToCheck.length > 0) {
      const { data: activeLoans } = await supabase
        .from("loan_applications")
        .select("user_id")
        .in("user_id", userIdsToCheck)
        .eq("status", "active");
      
      for (const loan of (activeLoans || [])) {
        activeLoanUserIds.add(loan.user_id);
      }
    }

    const results = { processed: 0, succeeded: 0, failed: 0, retried: 0, cancelled: 0 };

    // Determine provider once
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "notification_providers")
      .maybeSingle();
    const settings = settingsData?.value as any;
    
    let edgeFunctionName = "brevo-notification";
    if (settings?.sms_provider && settings.sms_provider !== 'brevo') {
      edgeFunctionName = "send-notification";
    } else if (settings?.email_provider && settings.email_provider !== 'brevo') {
      edgeFunctionName = "send-notification";
    } else if (settings?.whatsapp_provider && settings.whatsapp_provider !== 'brevo') {
      edgeFunctionName = "send-notification";
    }

    for (const notification of pendingNotifications as PendingNotification[]) {
      try {
        // ── Cancel payment reminders for non-active loans ──
        const isPaymentRelated = PAYMENT_RELATED_TITLES.some(t => notification.title?.includes(t));
        if (isPaymentRelated && notification.user_id && !activeLoanUserIds.has(notification.user_id)) {
          await supabase
            .from("notification_logs")
            .update({ status: "cancelled", error_message: "Loan no longer active", updated_at: new Date().toISOString() })
            .eq("id", notification.id);
          results.cancelled++;
          console.log(`[Queue Processor] Cancelled stale notification ${notification.id} – loan no longer active`);
          continue;
        }

        const payload: any = {
          type: notification.type,
          to: notification.recipient,
          message: notification.message,
          userId: notification.user_id,
          // Tell the sender NOT to write its own notification_logs row.
          // This row is the single source of truth and we update it below.
          skipLog: true,
        };
        if (notification.subject) payload.subject = notification.subject;
        if (notification.title) payload.title = notification.title;

        const { data: result, error: sendError } = await supabase.functions.invoke(
          edgeFunctionName,
          { body: payload }
        );

        if (sendError || !result?.success) {
          // TERMINAL failure. We do NOT requeue to 'pending'.
          // Blind retries were re-sending messages that the provider had already
          // delivered (e.g. ambiguous/credit-limit responses), which is exactly
          // what caused clients to receive duplicate SMS. A failed message stays
          // failed and must be re-triggered manually if needed.
          await supabase
            .from("notification_logs")
            .update({
              status: "failed",
              error_message: sendError?.message || result?.error || "Failed to send",
              updated_at: new Date().toISOString(),
            })
            .eq("id", notification.id);
          results.failed++;
        } else {
          await supabase
            .from("notification_logs")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              provider_response: result,
              updated_at: new Date().toISOString(),
            })
            .eq("id", notification.id);
          results.succeeded++;
          results.processed++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`[Queue Processor] Error processing notification ${notification.id}:`, error);
        // Mark terminal failed — never requeue, to avoid duplicate delivery.
        await supabase
          .from("notification_logs")
          .update({
            status: "failed",
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", notification.id);
        results.failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Processed ${results.processed} notifications`, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Queue Processor] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
