/**
 * Payment Reminder Cron – sends SMS (ExciteSMS) + Email (SendGrid)
 * for loans due within 3 days or already overdue.
 * 
 * Schedule: 3x daily (8am, 1pm, 5pm) via pg_cron.
 * Keeps sending until repayment is marked 'paid'.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  let f = phone.trim().replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (f.startsWith("+260")) return f;
  if (f.startsWith("260")) return "+" + f;
  if (f.startsWith("0")) return "+260" + f.substring(1);
  if (f.length === 9 && !f.startsWith("+")) return "+260" + f;
  if (f.startsWith("+")) return f;
  return "+260" + f;
}

function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-ZM", { year: "numeric", month: "long", day: "numeric" });
}

// ── ExciteSMS ────────────────────────────────────────────────────────────────

async function getExciteCredentials(supabase: any) {
  const { data: p } = await supabase.from("system_settings").select("value").eq("key", "notification_providers").maybeSingle();
  const { data: c } = await supabase.from("system_settings").select("value").eq("key", "notification_config").maybeSingle();
  const pv = p?.value || {};
  const cv = c?.value || {};
  const apiUrl = (pv.excitesms_api_url || cv.excitesms_api_url || Deno.env.get("EXCITESMS_API_URL") || "https://gateway.excitesms.com/api/v3").replace("excitesms.tech", "excitesms.com");
  return {
    apiUrl,
    apiToken: (pv.excitesms_api_token || cv.excitesms_api_token || Deno.env.get("EXCITESMS_API_TOKEN") || "").trim(),
    senderId: (pv.excitesms_sender_id || cv.excitesms_sender_id || Deno.env.get("EXCITESMS_SENDER_ID") || "Phindu").trim(),
  };
}

async function sendSMS(to: string, message: string, creds: any): Promise<boolean> {
  if (!creds.apiToken) { console.error("[Cron] ExciteSMS token missing"); return false; }
  const phone = formatPhone(to).replace("+", "");
  const url = `${creds.apiUrl.replace(/\/+$/, "")}/sms/send`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.apiToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ recipient: phone, sender_id: creds.senderId, type: "plain", message }),
    });
    const text = await res.text();
    console.log(`[Cron SMS] ${phone} → ${res.status}: ${text.substring(0, 150)}`);
    return res.ok;
  } catch (e) { console.error(`[Cron SMS] Error sending to ${phone}:`, e); return false; }
}

// ── SendGrid Email ───────────────────────────────────────────────────────────

async function getSendGridCredentials(supabase: any) {
  const { data: p } = await supabase.from("system_settings").select("value").eq("key", "notification_providers").maybeSingle();
  const { data: c } = await supabase.from("system_settings").select("value").eq("key", "notification_config").maybeSingle();
  const pv = p?.value || {};
  const cv = c?.value || {};
  return {
    apiKey: (pv.sendgrid_api_key || cv.sendgrid_api_key || Deno.env.get("SENDGRID_API_KEY") || "").trim(),
    fromEmail: (pv.sendgrid_from_email || cv.sendgrid_from_email || Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@phindu.com").trim(),
  };
}

async function sendEmail(to: string, subject: string, textBody: string, htmlBody: string, creds: any): Promise<boolean> {
  if (!creds.apiKey) { console.error("[Cron] SendGrid API key missing"); return false; }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: creds.fromEmail, name: "Phindu Finance" },
        content: [
          { type: "text/plain", value: textBody },
          { type: "text/html", value: htmlBody },
        ],
      }),
    });
    console.log(`[Cron Email] ${to} → ${res.status}`);
    return res.ok || res.status === 202;
  } catch (e) { console.error(`[Cron Email] Error sending to ${to}:`, e); return false; }
}

function buildReminderHtml(name: string, amount: string, dueDate: string, isOverdue: boolean, daysInfo: string): string {
  const urgency = isOverdue ? "#dc2626" : "#f59e0b";
  const statusText = isOverdue ? "OVERDUE" : "DUE SOON";
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#7c1d3e;padding:20px;text-align:center;">
    <h1 style="color:#fff;margin:0;">Phindu Finance</h1>
  </div>
  <div style="padding:24px;">
    <div style="background:${urgency};color:#fff;padding:10px 16px;border-radius:6px;text-align:center;font-weight:bold;margin-bottom:16px;">
      ⚠️ PAYMENT ${statusText} – ${daysInfo}
    </div>
    <p>Dear <strong>${name}</strong>,</p>
    <p>This is a reminder that your loan repayment of <strong>${amount}</strong> ${isOverdue ? "was" : "is"} due on <strong>${dueDate}</strong>.</p>
    ${isOverdue ? "<p style='color:#dc2626;font-weight:bold;'>Your payment is overdue. Late payment penalties may apply. Please make your payment immediately to avoid additional charges.</p>" : "<p>Please ensure your payment is made on time to avoid late payment penalties.</p>"}
    <p style="margin-top:20px;">Payment Methods:</p>
    <ul>
      <li>Mobile Money (MTN, Airtel, Zamtel)</li>
      <li>Bank Transfer</li>
      <li>Visit our office</li>
    </ul>
    <p style="color:#666;font-size:13px;margin-top:24px;">If you have already made this payment, please disregard this message. For any questions, contact us.</p>
  </div>
  <div style="background:#f9f9f9;padding:12px;text-align:center;font-size:12px;color:#999;">
    © Phindu Finance | This is an automated reminder
  </div>
</div>
</body></html>`;
}

// ── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check: require service role key
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token !== supabaseKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];
    const inThreeDays = new Date(today);
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const inThreeDaysStr = inThreeDays.toISOString().split("T")[0];

    // Get ALL pending repayments due within 3 days OR already overdue (no upper bound on overdue)
    const { data: repayments, error: fetchError } = await supabase
      .from("loan_repayments")
      .select("id, loan_id, user_id, amount, due_date, installment_number")
      .eq("status", "pending")
      .lte("due_date", inThreeDaysStr)
      .order("due_date", { ascending: true });

    if (fetchError) {
      console.error("[Cron] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (!repayments || repayments.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No repayments due", sent: 0 }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Group by loan_id → pick earliest due repayment per loan
    const loanMap = new Map<string, any>();
    for (const r of repayments) {
      if (!loanMap.has(r.loan_id)) loanMap.set(r.loan_id, r);
    }

    // Get loan details for all affected loans
    const loanIds = [...loanMap.keys()];
    const { data: loans } = await supabase
      .from("loan_applications")
      .select("id, full_name, phone, email, user_id, total_repayment, status")
      .in("id", loanIds)
      .in("status", ["active", "disbursed"]);

    if (!loans || loans.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active loans found for due repayments", sent: 0 }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Get total paid per loan for balance calculation
    const { data: paidData } = await supabase
      .from("loan_repayments")
      .select("loan_id, amount")
      .in("loan_id", loanIds)
      .eq("status", "paid");

    const paidMap = new Map<string, number>();
    for (const p of (paidData || [])) {
      paidMap.set(p.loan_id, (paidMap.get(p.loan_id) || 0) + (p.amount || 0));
    }

    // Fetch credentials once
    const smsCreds = await getExciteCredentials(supabase);
    const emailCreds = await getSendGridCredentials(supabase);

    let smsSent = 0, emailSent = 0, failed = 0;

    for (const loan of loans) {
      const repayment = loanMap.get(loan.id);
      if (!repayment) continue;

      const dueDate = new Date(repayment.due_date);
      const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays < 0;
      const daysInfo = isOverdue ? `${Math.abs(diffDays)} day(s) overdue` : diffDays === 0 ? "Due TODAY" : `Due in ${diffDays} day(s)`;

      const totalPaid = paidMap.get(loan.id) || 0;
      const remainingBalance = Math.max(0, (loan.total_repayment || 0) - totalPaid);
      const amountStr = formatCurrency(repayment.amount);
      const balanceStr = formatCurrency(remainingBalance);
      const dueDateStr = formatDate(repayment.due_date);
      const borrowerName = loan.full_name || "Valued Customer";

      // SMS message
      const smsMsg = isOverdue
        ? `OVERDUE REMINDER: Dear ${borrowerName}, your payment of ${amountStr} was due on ${dueDateStr} (${Math.abs(diffDays)} days ago). Outstanding balance: ${balanceStr}. Please pay immediately to avoid penalties. - Phindu Finance`
        : `PAYMENT REMINDER: Dear ${borrowerName}, your payment of ${amountStr} is ${diffDays === 0 ? "due TODAY" : `due on ${dueDateStr}`}. Outstanding balance: ${balanceStr}. Please pay on time. - Phindu Finance`;

      // Send SMS
      if (loan.phone) {
        try {
          const ok = await sendSMS(loan.phone, smsMsg, smsCreds);
          if (ok) smsSent++;
          else failed++;

          // Log to notification_logs
          await supabase.from("notification_logs").insert({
            user_id: loan.user_id,
            type: "sms",
            recipient: loan.phone,
            title: isOverdue ? "Overdue Payment Reminder" : "Payment Due Reminder",
            message: smsMsg,
            status: ok ? "sent" : "failed",
            sent_at: ok ? new Date().toISOString() : null,
          }).then(() => {});
        } catch (e) {
          console.error(`[Cron] SMS failed for loan ${loan.id}:`, e);
          failed++;
        }
      }

      // Send Email
      if (loan.email) {
        const subject = isOverdue ? `⚠️ Overdue Payment Reminder – ${amountStr}` : `Payment Reminder – ${amountStr} due ${dueDateStr}`;
        const textBody = smsMsg;
        const htmlBody = buildReminderHtml(borrowerName, amountStr, dueDateStr, isOverdue, daysInfo);

        try {
          const ok = await sendEmail(loan.email, subject, textBody, htmlBody, emailCreds);
          if (ok) emailSent++;
          else failed++;

          await supabase.from("notification_logs").insert({
            user_id: loan.user_id,
            type: "email",
            recipient: loan.email,
            title: subject,
            message: textBody,
            status: ok ? "sent" : "failed",
            sent_at: ok ? new Date().toISOString() : null,
          }).then(() => {});
        } catch (e) {
          console.error(`[Cron] Email failed for loan ${loan.id}:`, e);
          failed++;
        }
      }

      // Small delay between loans to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[Cron] Done: ${smsSent} SMS sent, ${emailSent} emails sent, ${failed} failed out of ${loans.length} loans`);

    return new Response(
      JSON.stringify({ success: true, loansProcessed: loans.length, smsSent, emailSent, failed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[Cron] Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
