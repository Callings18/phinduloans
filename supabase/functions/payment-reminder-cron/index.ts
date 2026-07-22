/**
 * Payment Reminder Cron – Tiered escalation system
 * 
 * Schedule: 3x daily (8am, 1pm, 5pm) via pg_cron.
 * 
 * Escalation timeline per overdue repayment:
 *   Day -3: Gentle reminder
 *   Day -2: Medium reminder
 *   Day -1: Firm/harsh final reminder
 *   Day +1: Auto-default loan + notify
 *   Day +7: Auto-apply 15% penalty (1st) + notify
 *   Day +14: Auto-apply 15% penalty (2nd, final) + notify
 *   Day +15+: Legal referral notice
 * 
 * DEDUP: Max 1 SMS + 1 Email per loan per day per event type.
 * Only processes loans with status = 'active' or 'defaulted'.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// ── Credential helpers ───────────────────────────────────────────────────────

async function getExciteCredentials(supabase: any) {
  const { data: p } = await supabase.from("system_settings").select("value").eq("key", "notification_providers").maybeSingle();
  const { data: c } = await supabase.from("system_settings").select("value").eq("key", "notification_config").maybeSingle();
  const pv = p?.value || {};
  const cv = c?.value || {};
  const clean = (t: string) => (t || "").trim().replace(/^Bearer\s+/i, "").trim();
  const apiUrl = (Deno.env.get("EXCITESMS_API_URL") || pv.excitesms_api_url || cv.excitesms_api_url || "https://gateway.excitesms.com/api/v3")
    .replace("excitesms.tech", "excitesms.com")
    .replace(/\/sms\/send\/?$/i, "")
    .replace(/\/+$/, "");
  return {
    apiUrl,
    apiToken: clean(Deno.env.get("EXCITESMS_API_TOKEN") || "") || clean(pv.excitesms_api_token || cv.excitesms_api_token || ""),
    senderId: (pv.excitesms_sender_id || cv.excitesms_sender_id || Deno.env.get("EXCITESMS_SENDER_ID") || "Phindu").trim(),
  };
}

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

// ── Send helpers ─────────────────────────────────────────────────────────────

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

async function logNotification(supabase: any, userId: string, type: string, recipient: string, title: string, message: string, ok: boolean) {
  await supabase.from("notification_logs").insert({
    user_id: userId,
    type,
    recipient,
    title,
    message,
    status: ok ? "sent" : "failed",
    sent_at: ok ? new Date().toISOString() : null,
  });
}

async function sendBoth(supabase: any, loan: any, title: string, smsMsg: string, emailSubject: string, htmlBody: string, smsCreds: any, emailCreds: any, alreadySent: Set<string>, stats: any) {
  const smsKey = `${loan.phone}|${title}`;
  const emailKey = `${loan.email}|${title}`;

  if (loan.phone && !alreadySent.has(smsKey)) {
    try {
      const ok = await sendSMS(loan.phone, smsMsg, smsCreds);
      if (ok) stats.smsSent++; else stats.failed++;
      await logNotification(supabase, loan.user_id, "sms", loan.phone, title, smsMsg, ok);
      alreadySent.add(smsKey);
    } catch (e) { console.error(`[Cron] SMS fail ${loan.id}:`, e); stats.failed++; }
  }

  if (loan.email && !alreadySent.has(emailKey)) {
    try {
      const ok = await sendEmail(loan.email, emailSubject, smsMsg, htmlBody, emailCreds);
      if (ok) stats.emailSent++; else stats.failed++;
      await logNotification(supabase, loan.user_id, "email", loan.email, title, smsMsg, ok);
      alreadySent.add(emailKey);
    } catch (e) { console.error(`[Cron] Email fail ${loan.id}:`, e); stats.failed++; }
  }
}

// ── HTML builders ────────────────────────────────────────────────────────────

function buildEscalationHtml(name: string, bodyHtml: string, bannerColor: string, bannerText: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#7c1d3e;padding:20px;text-align:center;">
    <h1 style="color:#fff;margin:0;">Phindu Finance</h1>
  </div>
  <div style="padding:24px;">
    <div style="background:${bannerColor};color:#fff;padding:10px 16px;border-radius:6px;text-align:center;font-weight:bold;margin-bottom:16px;">
      ${bannerText}
    </div>
    <p>Dear <strong>${name}</strong>,</p>
    ${bodyHtml}
    <p style="margin-top:20px;">Payment Methods:</p>
    <ul><li>Mobile Money (MTN, Airtel, Zamtel)</li><li>Bank Transfer</li><li>Visit our office</li></ul>
    <p style="color:#666;font-size:13px;margin-top:24px;">If you have already made this payment, please disregard this message. For questions, contact us.</p>
  </div>
  <div style="background:#f9f9f9;padding:12px;text-align:center;font-size:12px;color:#999;">
    © Phindu Finance | Automated notification
  </div>
</div></body></html>`;
}

// ── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // ── DEDUP: load today's sent notifications ──
    const todayStart = new Date(todayStr + "T00:00:00Z").toISOString();
    const todayEnd = new Date(todayStr + "T23:59:59Z").toISOString();
    const { data: sentToday } = await supabase
      .from("notification_logs")
      .select("title, recipient")
      .in("status", ["sent", "pending"])
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd);

    const alreadySent = new Set<string>();
    for (const n of (sentToday || [])) {
      alreadySent.add(`${n.recipient}|${n.title}`);
    }

    const smsCreds = await getExciteCredentials(supabase);
    const emailCreds = await getSendGridCredentials(supabase);
    const stats = { smsSent: 0, emailSent: 0, failed: 0, skipped: 0, defaulted: 0, penalized: 0, legalReferred: 0 };

    // ═══════════════════════════════════════════════════════════════════════
    // PART A: PRE-DUE REMINDERS (Day -3, -2, -1) for ACTIVE loans
    // ═══════════════════════════════════════════════════════════════════════

    const inThreeDays = new Date(today);
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const inThreeDaysStr = inThreeDays.toISOString().split("T")[0];

    const { data: upcomingReps } = await supabase
      .from("loan_repayments")
      .select("id, loan_id, user_id, amount, due_date, installment_number")
      .in("status", ["pending"])
      .gte("due_date", todayStr)
      .lte("due_date", inThreeDaysStr)
      .order("due_date", { ascending: true });

    if (upcomingReps && upcomingReps.length > 0) {
      const loanMap = new Map<string, any>();
      for (const r of upcomingReps) {
        if (!loanMap.has(r.loan_id)) loanMap.set(r.loan_id, r);
      }

      const loanIds = [...loanMap.keys()];
      const { data: loans } = await supabase
        .from("loan_applications")
        .select("id, full_name, phone, email, user_id, total_repayment, loan_amount")
        .in("id", loanIds)
        .eq("status", "active");

      for (const loan of (loans || [])) {
        const rep = loanMap.get(loan.id);
        if (!rep) continue;

        const dueDate = new Date(rep.due_date);
        const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const amtStr = formatCurrency(rep.amount);
        const dueDateStr = formatDate(rep.due_date);
        const name = loan.full_name || "Valued Customer";

        let smsMsg = "";
        let emailSubject = "";
        let bannerColor = "";
        let bannerText = "";
        let bodyHtml = "";
        let title = "";

        if (diffDays === 3 || diffDays === 2) {
          // Day -3 / -2: Gentle
          title = "Payment Due Reminder";
          smsMsg = `Dear ${name}, just a friendly reminder that your payment of ${amtStr} is due on ${dueDateStr}. Please arrange payment to keep your account in good standing. - Phindu Finance`;
          emailSubject = `Friendly Reminder – Payment of ${amtStr} due ${dueDateStr}`;
          bannerColor = "#3b82f6";
          bannerText = `📅 Payment Due in ${diffDays} Day(s)`;
          bodyHtml = `<p>Your loan repayment of <strong>${amtStr}</strong> is due on <strong>${dueDateStr}</strong>.</p>
            <p>Please arrange your payment to keep your account in good standing. Timely payments help maintain your credit profile.</p>`;
        } else if (diffDays === 1) {
          // Day -1: Medium
          title = "Payment Due Tomorrow";
          smsMsg = `Dear ${name}, your payment of ${amtStr} is due TOMORROW (${dueDateStr}). Please ensure payment is made on time to avoid penalties. - Phindu Finance`;
          emailSubject = `⚠️ Payment Due Tomorrow – ${amtStr}`;
          bannerColor = "#f59e0b";
          bannerText = "⚠️ PAYMENT DUE TOMORROW";
          bodyHtml = `<p>Your loan repayment of <strong>${amtStr}</strong> is due <strong>TOMORROW, ${dueDateStr}</strong>.</p>
            <p>Please ensure your payment is made on time. Late payments will attract penalties and may affect your credit record.</p>`;
        } else if (diffDays === 0) {
          // Day 0: Harsh / final
          title = "FINAL Payment Reminder";
          smsMsg = `FINAL REMINDER: Dear ${name}, your payment of ${amtStr} is due TODAY. Failure to pay will result in your loan being DEFAULTED, attracting a 15% penalty and potential LEGAL ACTION. Pay now! - Phindu Finance`;
          emailSubject = `🚨 FINAL REMINDER – Payment of ${amtStr} Due TODAY`;
          bannerColor = "#dc2626";
          bannerText = "🚨 FINAL REMINDER – PAYMENT DUE TODAY";
          bodyHtml = `<p>Your loan repayment of <strong>${amtStr}</strong> is due <strong>TODAY, ${dueDateStr}</strong>.</p>
            <p style="color:#dc2626;font-weight:bold;">This is your FINAL reminder. If payment is not received today:</p>
            <ul style="color:#dc2626;">
              <li>Your loan will be marked as <strong>DEFAULTED</strong> within 24 hours</li>
              <li>A penalty of <strong>15%</strong> will be applied every 7 days</li>
              <li>Your account may be referred for <strong>legal recovery</strong></li>
            </ul>
            <p style="font-weight:bold;">Please make your payment immediately to avoid these consequences.</p>`;
        }

        if (title) {
          await sendBoth(supabase, loan, title, smsMsg, emailSubject, buildEscalationHtml(name, bodyHtml, bannerColor, bannerText), smsCreds, emailCreds, alreadySent, stats);
        }

        await new Promise(r => setTimeout(r, 150));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PART B: OVERDUE – Auto-default, penalties, legal referral
    // ═══════════════════════════════════════════════════════════════════════

    // Get overdue repayments (due_date < today, still pending/overdue)
    const { data: overdueReps } = await supabase
      .from("loan_repayments")
      .select("id, loan_id, user_id, amount, due_date, original_amount")
      .in("status", ["pending", "overdue"])
      .lt("due_date", todayStr)
      .order("due_date", { ascending: true });

    if (overdueReps && overdueReps.length > 0) {
      // Group by loan → earliest overdue
      const overdueLoanMap = new Map<string, any>();
      for (const r of overdueReps) {
        if (!overdueLoanMap.has(r.loan_id)) overdueLoanMap.set(r.loan_id, r);
      }

      const overdueLoanIds = [...overdueLoanMap.keys()];
      const { data: overdueLoans } = await supabase
        .from("loan_applications")
        .select("id, full_name, phone, email, user_id, total_repayment, loan_amount, status, penalty_count, defaulted_at, legal_referred_at")
        .in("id", overdueLoanIds)
        .in("status", ["active", "defaulted"]);

      for (const loan of (overdueLoans || [])) {
        const rep = overdueLoanMap.get(loan.id);
        if (!rep) continue;

        const dueDate = new Date(rep.due_date);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const amtStr = formatCurrency(rep.original_amount || rep.amount);
        const dueDateStr = formatDate(rep.due_date);
        const name = loan.full_name || "Valued Customer";
        const penaltyCount = loan.penalty_count || 0;

        // ── Day +1: Auto-default (if still active) ──
        if (daysOverdue >= 1 && loan.status === "active") {
          console.log(`[Cron] Auto-defaulting loan ${loan.id} (${daysOverdue} days overdue)`);
          await supabase.from("loan_applications").update({
            status: "defaulted",
            defaulted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", loan.id);

          // Mark overdue repayments
          await supabase.from("loan_repayments")
            .update({ status: "overdue" })
            .eq("loan_id", loan.id)
            .eq("status", "pending")
            .lt("due_date", todayStr);

          stats.defaulted++;

          const defaultMsg = `NOTICE: Dear ${name}, your loan has been DEFAULTED due to non-payment. Your payment of ${amtStr} was due on ${dueDateStr}. A penalty of 15% will be applied every 7 days. Please contact us immediately to arrange payment and avoid legal action. - Phindu Finance`;
          const defaultHtml = `<p>Your loan has been <strong style="color:#dc2626;">DEFAULTED</strong> due to non-payment.</p>
            <p>Your payment of <strong>${amtStr}</strong> was due on <strong>${dueDateStr}</strong> and is now <strong>${daysOverdue} day(s) overdue</strong>.</p>
            <p style="color:#dc2626;font-weight:bold;">What happens next:</p>
            <ul>
              <li>A penalty of <strong>15% of the principal</strong> will be applied every 7 days</li>
              <li>Maximum of 2 penalty periods (2 weeks)</li>
              <li>After penalties, your account will be referred to our <strong>legal department</strong></li>
            </ul>
            <p style="font-weight:bold;">Please contact us immediately to arrange payment.</p>`;

          await sendBoth(supabase, loan, "Loan Defaulted Notice", defaultMsg,
            "🚨 LOAN DEFAULTED – Immediate Action Required",
            buildEscalationHtml(name, defaultHtml, "#dc2626", "🚨 LOAN DEFAULTED"),
            smsCreds, emailCreds, alreadySent, stats);
        }

        // ── Day +7: First 15% penalty ──
        if (daysOverdue >= 7 && penaltyCount < 1 && loan.status === "defaulted") {
          const penaltyAmount = Math.round(loan.loan_amount * 0.15 * 100) / 100;
          console.log(`[Cron] Applying 1st penalty K${penaltyAmount} to loan ${loan.id}`);

          await supabase.from("loan_applications").update({
            penalty_count: 1,
            total_penalties: penaltyAmount,
            updated_at: new Date().toISOString(),
          }).eq("id", loan.id);

          stats.penalized++;

          const penaltyStr = formatCurrency(penaltyAmount);
          const penaltyMsg = `PENALTY NOTICE: Dear ${name}, a penalty of ${penaltyStr} (15% of principal) has been applied to your defaulted loan. Your outstanding balance has increased. A second penalty will be applied in 7 days if payment is not received. Please pay immediately. - Phindu Finance`;
          const penaltyHtml = `<p>A penalty of <strong>${penaltyStr}</strong> (15% of principal) has been applied to your defaulted loan.</p>
            <p style="color:#dc2626;font-weight:bold;">⚠️ A second and final penalty will be applied in 7 days if payment is not received.</p>
            <p>After the second penalty, your account will be referred to our legal department for recovery proceedings.</p>
            <p style="font-weight:bold;">Please make payment immediately to avoid further charges.</p>`;

          await sendBoth(supabase, loan, "Penalty Applied Notice", penaltyMsg,
            `⚠️ Penalty of ${penaltyStr} Applied to Your Loan`,
            buildEscalationHtml(name, penaltyHtml, "#ea580c", `⚠️ PENALTY APPLIED – ${penaltyStr}`),
            smsCreds, emailCreds, alreadySent, stats);
        }

        // ── Day +14: Second 15% penalty (final) ──
        if (daysOverdue >= 14 && penaltyCount < 2 && penaltyCount >= 1 && loan.status === "defaulted") {
          const singlePenalty = Math.round(loan.loan_amount * 0.15 * 100) / 100;
          const totalPenalties = Math.round(singlePenalty * 2 * 100) / 100;
          console.log(`[Cron] Applying 2nd penalty K${singlePenalty} to loan ${loan.id}`);

          await supabase.from("loan_applications").update({
            penalty_count: 2,
            total_penalties: totalPenalties,
            updated_at: new Date().toISOString(),
          }).eq("id", loan.id);

          stats.penalized++;

          const penaltyStr = formatCurrency(singlePenalty);
          const totalStr = formatCurrency(totalPenalties);
          const penaltyMsg = `FINAL PENALTY: Dear ${name}, a second and FINAL penalty of ${penaltyStr} has been applied. Total penalties: ${totalStr}. If payment is not received, your account WILL BE REFERRED to our legal department for recovery. This is your last chance to settle. - Phindu Finance`;
          const penaltyHtml = `<p>A second and <strong>FINAL</strong> penalty of <strong>${penaltyStr}</strong> has been applied to your defaulted loan.</p>
            <p>Total penalties: <strong>${totalStr}</strong></p>
            <p style="color:#dc2626;font-weight:bold;">🚨 THIS IS YOUR FINAL PENALTY PERIOD.</p>
            <p>If payment is not received, your account <strong>WILL BE REFERRED to our legal department</strong> for recovery proceedings, which may include:</p>
            <ul style="color:#dc2626;">
              <li>Court summons and legal action</li>
              <li>Asset confiscation proceedings</li>
              <li>Credit bureau blacklisting</li>
            </ul>
            <p style="font-weight:bold;">Please settle your account immediately to avoid legal proceedings.</p>`;

          await sendBoth(supabase, loan, "Final Penalty Notice", penaltyMsg,
            `🚨 FINAL PENALTY – ${penaltyStr} Applied, Legal Action Imminent`,
            buildEscalationHtml(name, penaltyHtml, "#dc2626", `🚨 FINAL PENALTY – ${totalStr} Total`),
            smsCreds, emailCreds, alreadySent, stats);
        }

        // ── Day +15+: Legal referral (after 2 penalties applied) ──
        if (daysOverdue >= 15 && penaltyCount >= 2 && !loan.legal_referred_at && loan.status === "defaulted") {
          console.log(`[Cron] Legal referral for loan ${loan.id}`);

          await supabase.from("loan_applications").update({
            legal_referred_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", loan.id);

          stats.legalReferred++;

          const legalMsg = `LEGAL NOTICE: Dear ${name}, your account has been referred to our legal department for recovery. All penalties have been applied and payment was not received. Legal proceedings including court action and asset confiscation may commence. Contact us immediately to discuss settlement options. - Phindu Finance`;
          const legalHtml = `<p style="color:#dc2626;font-weight:bold;font-size:16px;">YOUR ACCOUNT HAS BEEN REFERRED TO OUR LEGAL DEPARTMENT</p>
            <p>Despite multiple reminders and penalty notices, payment has not been received for your defaulted loan.</p>
            <p>Your account has now been handed over to our legal team. The following actions may be taken:</p>
            <ul style="color:#dc2626;font-weight:bold;">
              <li>Formal demand letter from our lawyers</li>
              <li>Court summons and legal proceedings</li>
              <li>Asset confiscation and enforcement orders</li>
              <li>Credit bureau reporting and blacklisting</li>
            </ul>
            <p>If you wish to discuss settlement options, please contact us <strong>immediately</strong>. Once legal proceedings begin, additional legal costs will be added to your outstanding balance.</p>`;

          await sendBoth(supabase, loan, "Legal Referral Notice", legalMsg,
            "⚖️ LEGAL ACTION – Account Referred for Recovery",
            buildEscalationHtml(name, legalHtml, "#7f1d1d", "⚖️ LEGAL REFERRAL – Account Handed to Legal Team"),
            smsCreds, emailCreds, alreadySent, stats);
        }

        // ── Ongoing overdue reminder (for defaulted loans, once daily) ──
        if (loan.status === "defaulted" && daysOverdue >= 2 && daysOverdue < 15) {
          const overdueTitle = "Overdue Payment Reminder";
          const smsKey = `${loan.phone}|${overdueTitle}`;
          if (!alreadySent.has(smsKey)) {
            const overdueMsg = `OVERDUE: Dear ${name}, your payment of ${amtStr} was due on ${dueDateStr} (${daysOverdue} days ago). Your loan is defaulted. Please pay immediately to avoid further penalties and legal action. - Phindu Finance`;
            const overdueHtml = `<p>Your payment of <strong>${amtStr}</strong> was due on <strong>${dueDateStr}</strong> and is now <strong>${daysOverdue} day(s) overdue</strong>.</p>
              <p style="color:#dc2626;">Your loan is currently in <strong>DEFAULT</strong>. Penalties are being applied. Please make payment immediately.</p>`;
            
            await sendBoth(supabase, loan, overdueTitle, overdueMsg,
              `⚠️ Overdue Payment – ${daysOverdue} Days Past Due`,
              buildEscalationHtml(name, overdueHtml, "#dc2626", `⚠️ ${daysOverdue} DAYS OVERDUE`),
              smsCreds, emailCreds, alreadySent, stats);
          }
        }

        await new Promise(r => setTimeout(r, 150));
      }
    }

    console.log(`[Cron] Done: ${stats.smsSent} SMS, ${stats.emailSent} emails, ${stats.failed} failed, ${stats.defaulted} auto-defaulted, ${stats.penalized} penalties applied, ${stats.legalReferred} legal referrals`);

    return new Response(
      JSON.stringify({ success: true, ...stats }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[Cron] Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
