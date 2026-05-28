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

    let authorized = false;

    // (1) Service role key (server-to-server)
    if (token && token === supabaseKey) {
      authorized = true;
    }

    // (2) Cron secret header (for scheduled invocations)
    if (!authorized && cronSecret && providedCronSecret === cronSecret) {
      authorized = true;
    }

    // (3) Anon key (used by pg_cron net.http_post which can't read service role key)
    // Safe: this function only drains the internal notification_logs queue — no user input.
    if (!authorized && token && token === anonKey) {
      authorized = true;
    }

    // (4) Authenticated user — must be admin or staff
    if (!authorized && token && token !== anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: claimsData } = await userClient.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (userId) {
        const adminClient = createClient(supabaseUrl, supabaseKey);
        const { data: roles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const allowed = (roles ?? []).some((r: any) =>
          ["admin", "loan_officer", "manager", "staff"].includes(r.role)
        );
        if (allowed) authorized = true;
      }
    }


    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get pending notifications (limit to 50 per run to avoid timeout)
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("[Queue Processor] Error fetching pending notifications:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending notifications", details: fetchError.message }),
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

        const retryCount = (notification as any).retry_count || 0;
        
        if (retryCount >= MAX_RETRIES) {
          await supabase
            .from("notification_logs")
            .update({ status: "failed", error_message: "Max retries exceeded", updated_at: new Date().toISOString() })
            .eq("id", notification.id);
          results.failed++;
          continue;
        }

        const payload: any = {
          type: notification.type,
          to: notification.recipient,
          message: notification.message,
          userId: notification.user_id,
        };
        if (notification.subject) payload.subject = notification.subject;
        if (notification.title) payload.title = notification.title;

        const { data: result, error: sendError } = await supabase.functions.invoke(
          edgeFunctionName,
          { body: payload }
        );

        if (sendError || !result?.success) {
          const newRetryCount = retryCount + 1;
          await supabase
            .from("notification_logs")
            .update({
              retry_count: newRetryCount,
              error_message: sendError?.message || result?.error || "Failed to send",
              updated_at: new Date().toISOString(),
            })
            .eq("id", notification.id);
          results.retried++;
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
        const retryCount = ((notification as any).retry_count || 0) + 1;
        await supabase
          .from("notification_logs")
          .update({
            retry_count: retryCount,
            error_message: error.message,
            updated_at: new Date().toISOString(),
            ...(retryCount >= MAX_RETRIES ? { status: "failed" } : {}),
          })
          .eq("id", notification.id);
        if (retryCount >= MAX_RETRIES) results.failed++;
        else results.retried++;
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
