/**
 * Payment reminder cron: finds upcoming (1–3 days) and overdue repayments,
 * then sends reminders via send-due-soon-notification (or send-notification).
 * Schedule daily via Supabase cron or external (e.g. 0 8 * * * = 8am daily).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inThreeDays = new Date(today);
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const inThreeDaysStr = inThreeDays.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    // Pending repayments due today or in next 3 days, or overdue (due_date < today)
    const { data: repayments, error: fetchError } = await supabase
      .from("loan_repayments")
      .select("id, loan_id, user_id, amount, due_date")
      .eq("status", "pending")
      .lte("due_date", inThreeDaysStr)
      .order("due_date", { ascending: true });

    if (fetchError) {
      console.error("[Payment Reminder Cron] Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch repayments", details: fetchError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!repayments || repayments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No repayments due in window", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // One reminder per loan (next due repayment for that loan)
    const loanIds = [...new Set(repayments.map((r: any) => r.loan_id))];
    let sent = 0;
    let failed = 0;

    for (const loanId of loanIds) {
      try {
        const { error } = await supabase.functions.invoke("send-due-soon-notification", {
          body: { loan_id: loanId },
        });
        if (error) {
          console.warn(`[Payment Reminder Cron] Failed for loan ${loanId}:`, error);
          failed++;
        } else {
          sent++;
        }
      } catch (e) {
        console.warn(`[Payment Reminder Cron] Error for loan ${loanId}:`, e);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        repaymentsInWindow: repayments.length,
        loansNotified: sent,
        failed,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[Payment Reminder Cron] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Cron failed" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
