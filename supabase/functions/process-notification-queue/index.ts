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
const RETRY_DELAY_MS = 5000; // 5 seconds base delay

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
        JSON.stringify({ 
          success: true, 
          message: "No pending notifications to process",
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Queue Processor] Processing ${pendingNotifications.length} pending notifications`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      retried: 0,
    };

    // Process each notification
    for (const notification of pendingNotifications as PendingNotification[]) {
      try {
        // Check retry count (add column if not exists, default to 0)
        const retryCount = (notification as any).retry_count || 0;
        
        if (retryCount >= MAX_RETRIES) {
          // Mark as failed after max retries
          await supabase
            .from("notification_logs")
            .update({
              status: "failed",
              error_message: "Max retries exceeded",
              updated_at: new Date().toISOString(),
            })
            .eq("id", notification.id);
          
          results.failed++;
          console.log(`[Queue Processor] Notification ${notification.id} exceeded max retries`);
          continue;
        }

        // Determine which edge function to call based on type
        let edgeFunctionName = "brevo-notification";
        
        // For notifications from database triggers, we need to determine the provider
        // Check notification_providers settings to determine which function to use
        const { data: settingsData } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "notification_providers")
          .maybeSingle();

        const settings = settingsData?.value as any;
        
        // Use send-notification for multi-provider support, or brevo-notification for Brevo-specific
        if (settings?.sms_provider && settings.sms_provider !== 'brevo') {
          edgeFunctionName = "send-notification";
        } else if (settings?.email_provider && settings.email_provider !== 'brevo') {
          edgeFunctionName = "send-notification";
        } else if (settings?.whatsapp_provider && settings.whatsapp_provider !== 'brevo') {
          edgeFunctionName = "send-notification";
        }

        // Prepare notification payload
        const payload: any = {
          type: notification.type,
          to: notification.recipient,
          message: notification.message,
          userId: notification.user_id,
        };

        if (notification.subject) {
          payload.subject = notification.subject;
        }
        if (notification.title) {
          payload.title = notification.title;
        }

        // Call the appropriate edge function
        const { data: result, error: sendError } = await supabase.functions.invoke(
          edgeFunctionName,
          {
            body: payload,
          }
        );

        if (sendError || !result?.success) {
          // Increment retry count and reschedule
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
          console.log(`[Queue Processor] Notification ${notification.id} failed, retry ${newRetryCount}/${MAX_RETRIES}`);
        } else {
          // Mark as sent
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
          console.log(`[Queue Processor] Notification ${notification.id} sent successfully`);
        }

        // Small delay between notifications to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`[Queue Processor] Error processing notification ${notification.id}:`, error);
        
        // Increment retry count
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

        if (retryCount >= MAX_RETRIES) {
          results.failed++;
        } else {
          results.retried++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} notifications`,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Queue Processor] Fatal error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
