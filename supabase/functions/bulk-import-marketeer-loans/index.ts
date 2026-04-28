// Bulk-import 65 net-new Marketeer loans from offline 2026 records.
// - Creates real auth.users + profiles (admins can edit later).
// - Creates loan_application, disbursement (back-dated), 26-day daily schedule, back-dated payments.
// - Posts ledger entries against ZANACO BANK; pre-funds Zanaco with a one-time top-up to cover principal.
// - Idempotent: each row has a stable row_key; re-runs are no-ops for already-imported rows.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MARKETEER_LOANS } from "./loans_data.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MARKETEER_PRODUCT_ID = "48cb3330-77de-42f8-add8-5e154f5f0f86";
const ZANACO_ACCOUNT_ID = "4e89f7c7-691a-4ebb-84be-e152378ff357";
const SCHEDULE_LEN = 26;

type LoanRow = {
  row_key: string;
  seq: number;
  name: string;
  principal: number;
  interest: number;
  total: number;
  daily: number;
  disbursement_date: string; // YYYY-MM-DD
  day_payments: number[];
};

function fmtSeq(n: number, width = 3) {
  return String(n).padStart(width, "0");
}

function nrcFor(seq: number) {
  // 6 digits / 2 digits / 1 digit. Use 9 as the "import" tag in the country digit slot is not allowed
  // (must be 0-9). We use a recognizable pattern: 999XXX/26/9
  return `999${fmtSeq(seq)}/26/9`;
}

function phoneFor(seq: number) {
  // E.164 Zambia: +260 9 7 0 0 0 0 NNN  (sentinel range starting +260970)
  return `+26097000${fmtSeq(seq)}`;
}

function emailFor(seq: number) {
  return `mkt.import.${fmtSeq(seq)}@offline.phindu.zm`;
}

// Generate a 26-installment daily schedule starting at `start` (ISO date),
// skipping Sundays. Returns ISO date strings.
function buildSchedule(start: string, n: number): string[] {
  const dates: string[] = [];
  // Treat as UTC noon to avoid TZ drift
  const d = new Date(start + "T12:00:00Z");
  // First installment is on the start date itself (matches Dorcus pattern)
  // but need to also skip Sundays.
  const cursor = new Date(d.getTime() - 24 * 3600 * 1000);
  while (dates.length < n) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() !== 0) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
      const day = String(cursor.getUTCDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }
  }
  return dates;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- AuthZ: caller must be admin ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const isAdmin = roles?.some((r: { role: string }) =>
      ["admin", "super_admin"].includes(r.role)
    );
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin/super_admin role required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = !!body?.dry_run;

    const report: Array<Record<string, unknown>> = [];
    let createdLoans = 0;
    let skipped = 0;
    let paymentsPosted = 0;
    let totalPrincipalImported = 0;
    let totalCollectedImported = 0;

    // ---- Pre-funding top-up: ensure ZANACO has enough to cover all NEW disbursements ----
    // Compute net principal needed for rows not yet imported
    const { data: existingRefs } = await admin
      .from("disbursements")
      .select("transaction_reference")
      .like("transaction_reference", "OFFLINE-IMPORT-MKT-%");
    const importedKeys = new Set(
      (existingRefs ?? [])
        .map((r) => (r.transaction_reference as string) ?? "")
        .map((s) => s.replace("OFFLINE-IMPORT-", "").replace(/-DISB$/, ""))
    );
    const needed = (MARKETEER_LOANS as readonly LoanRow[])
      .filter((l) => !importedKeys.has(l.row_key))
      .reduce((s, l) => s + l.principal, 0);

    if (!dryRun && needed > 0) {
      const { data: acct } = await admin
        .from("accounts")
        .select("balance")
        .eq("id", ZANACO_ACCOUNT_ID)
        .maybeSingle();
      const balance = Number(acct?.balance ?? 0);
      if (balance < needed) {
        const topUp = needed - balance;
        const newBal = balance + topUp;
        await admin
          .from("accounts")
          .update({ balance: newBal })
          .eq("id", ZANACO_ACCOUNT_ID);
        await admin.from("account_transactions").insert({
          account_id: ZANACO_ACCOUNT_ID,
          transaction_type: "deposit",
          amount: topUp,
          balance_before: balance,
          balance_after: newBal,
          source: "offline_records_funding",
          destination: "ZANACO BANK",
          reference_type: "offline_import_topup",
          notes:
            "Funding top-up for offline 2026 Marketeer records import (one-time)",
          created_by: callerId,
        });
      }
    }

    // ---- Per-loan import ----
    for (const loan of MARKETEER_LOANS as readonly LoanRow[]) {
      const refDisb = `OFFLINE-IMPORT-${loan.row_key}-DISB`;

      // Idempotency: skip if disbursement reference already present
      const { data: existing } = await admin
        .from("disbursements")
        .select("id")
        .eq("transaction_reference", refDisb)
        .maybeSingle();
      if (existing) {
        skipped++;
        report.push({
          row_key: loan.row_key,
          name: loan.name,
          action: "SKIPPED_ALREADY_IMPORTED",
        });
        continue;
      }

      if (dryRun) {
        report.push({
          row_key: loan.row_key,
          name: loan.name,
          principal: loan.principal,
          total: loan.total,
          disbursement_date: loan.disbursement_date,
          day_payments_to_post: loan.day_payments.filter((p) => p > 0).length,
          action: "WOULD_IMPORT",
        });
        continue;
      }

      try {
        // ---- 1. Create real auth.user ----
        const email = emailFor(loan.seq);
        const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
        let userId: string;

        // Check if a previous run already created the user (by email)
        const { data: existingProfile } = await admin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (existingProfile) {
          userId = existingProfile.id;
        } else {
          const { data: created, error: createErr } =
            await admin.auth.admin.createUser({
              email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: {
                full_name: loan.name,
                offline_import: true,
                source_row: loan.row_key,
              },
            });
          if (createErr || !created?.user) {
            throw new Error(
              `auth.createUser failed: ${createErr?.message ?? "unknown"}`
            );
          }
          userId = created.user.id;
        }

        // Profile (real, editable)
        await admin.from("profiles").upsert(
          {
            id: userId,
            email,
            full_name: loan.name,
            phone: phoneFor(loan.seq),
            nrc_number: nrcFor(loan.seq),
            city: "Lusaka",
            address: "To be completed - offline import 2026",
          },
          { onConflict: "id" }
        );

        // Link to MARKETEER product house
        await admin.from("product_house_borrowers").upsert(
          {
            product_code: "MARKETEER",
            borrower_id: userId,
            added_by: callerId,
          },
          { onConflict: "product_code,borrower_id" }
        );

        // Optional: assign 'borrower' role if app uses it
        await admin.from("user_roles").upsert(
          { user_id: userId, role: "borrower" },
          { onConflict: "user_id,role" }
        );

        // ---- 2. Create loan_application (status=pending) ----
        const disbAnchorTs = `${loan.disbursement_date}T12:00:00+00:00`;
        const { data: appRow, error: appErr } = await admin
          .from("loan_applications")
          .insert({
            user_id: userId,
            full_name: loan.name,
            email,
            phone: phoneFor(loan.seq),
            nrc_number: nrcFor(loan.seq),
            city: "Lusaka",
            employment_type: "self_employed",
            monthly_income: 5000, // placeholder - admin to update
            loan_amount: loan.principal,
            loan_purpose: "Marketeer micro-loan (offline import 2026)",
            loan_term_months: SCHEDULE_LEN,
            interest_rate: 30,
            total_repayment: loan.total,
            term_unit: "days",
            loan_product_id: MARKETEER_PRODUCT_ID,
            source: "internal",
            status: "pending",
            admin_notes: `Offline import row ${loan.row_key}`,
            product_specific_data: {
              import_row_key: loan.row_key,
              import_source: "offline_2026_marketeer",
              daily_repayment: loan.daily,
            },
          })
          .select("id")
          .single();
        if (appErr || !appRow) throw new Error(`loan_app insert: ${appErr?.message}`);
        const loanId = appRow.id;

        // Walk status: pending -> approved -> awaiting_disbursement -> disbursed -> active
        for (const s of [
          "approved",
          "awaiting_disbursement",
          "disbursed",
          "active",
        ]) {
          const patch: Record<string, unknown> = {
            status: s,
            updated_at: disbAnchorTs,
          };
          if (s === "approved") {
            patch.approval_stage = "approved";
            patch.approved_at = disbAnchorTs;
            patch.recommended_at = disbAnchorTs;
          }
          if (s === "disbursed") {
            patch.disbursed_at = disbAnchorTs;
          }
          const { error: upErr } = await admin
            .from("loan_applications")
            .update(patch)
            .eq("id", loanId);
          if (upErr) throw new Error(`status->${s}: ${upErr.message}`);
        }

        // ---- 3. Disbursement row (completed, back-dated) ----
        const { data: disbRow, error: disbErr } = await admin
          .from("disbursements")
          .insert({
            loan_id: loanId,
            amount: loan.principal,
            disbursement_method: "bank_transfer",
            status: "completed",
            disbursed_at: disbAnchorTs,
            source_account_id: ZANACO_ACCOUNT_ID,
            transaction_reference: refDisb,
            is_top_up: false,
            created_at: disbAnchorTs,
          })
          .select("id")
          .single();
        if (disbErr || !disbRow) throw new Error(`disbursement: ${disbErr?.message}`);
        const disbId = disbRow.id;

        // Debit ZANACO
        const { data: acct1 } = await admin
          .from("accounts")
          .select("balance")
          .eq("id", ZANACO_ACCOUNT_ID)
          .single();
        const balBefore = Number(acct1!.balance);
        const balAfter = balBefore - loan.principal;
        await admin
          .from("accounts")
          .update({ balance: balAfter })
          .eq("id", ZANACO_ACCOUNT_ID);
        await admin.from("account_transactions").insert({
          account_id: ZANACO_ACCOUNT_ID,
          transaction_type: "disbursement",
          amount: loan.principal,
          balance_before: balBefore,
          balance_after: balAfter,
          source: "ZANACO BANK",
          destination: loan.name,
          reference_type: "disbursement",
          reference_id: disbId,
          notes: `Back-dated offline disbursement (Marketeer) ${loan.row_key}`,
          created_by: callerId,
          created_at: disbAnchorTs,
        });

        // ---- 4. Generate 26-day schedule anchored at disbursement_date, skip Sundays ----
        const dueDates = buildSchedule(loan.disbursement_date, SCHEDULE_LEN);
        const principalPer = Math.round((loan.principal / loan.total) * loan.daily * 100) / 100;
        const interestPer = Math.round((loan.daily - principalPer) * 100) / 100;

        const scheduleRows = dueDates.map((d, idx) => ({
          loan_id: loanId,
          user_id: userId,
          amount: loan.daily,
          original_amount: loan.daily,
          due_date: d,
          status: "pending",
          installment_number: idx + 1,
          created_at: disbAnchorTs,
        }));
        const { data: insSched, error: schedErr } = await admin
          .from("loan_repayments")
          .insert(scheduleRows)
          .select("id, installment_number, due_date");
        if (schedErr) throw new Error(`schedule: ${schedErr.message}`);

        // ---- 5. Post back-dated per-day payments ----
        let postedHere = 0;
        let collectedHere = 0;
        for (let i = 0; i < loan.day_payments.length && i < SCHEDULE_LEN; i++) {
          const amt = loan.day_payments[i];
          if (!amt || amt <= 0) continue;
          const inst = insSched!.find((s) => s.installment_number === i + 1);
          if (!inst) continue;
          // Cap at daily amount
          const paid = Math.min(amt, loan.daily);
          await admin
            .from("loan_repayments")
            .update({
              status: "paid",
              amount: paid,
              principal_paid: Math.round((paid / loan.daily) * principalPer * 100) / 100,
              interest_paid: Math.round((paid / loan.daily) * interestPer * 100) / 100,
              penalty_paid: 0,
              paid_date: inst.due_date,
              payment_method: "cash",
              transaction_reference: `OFFLINE-IMPORT-${loan.row_key}-DAY${i + 1}`,
              updated_at: disbAnchorTs,
            })
            .eq("id", inst.id);

          // Credit ZANACO
          const { data: acctN } = await admin
            .from("accounts")
            .select("balance")
            .eq("id", ZANACO_ACCOUNT_ID)
            .single();
          const bb = Number(acctN!.balance);
          const ba = bb + paid;
          await admin
            .from("accounts")
            .update({ balance: ba })
            .eq("id", ZANACO_ACCOUNT_ID);
          await admin.from("account_transactions").insert({
            account_id: ZANACO_ACCOUNT_ID,
            transaction_type: "repayment",
            amount: paid,
            balance_before: bb,
            balance_after: ba,
            source: loan.name,
            destination: "ZANACO BANK",
            reference_type: "repayment",
            reference_id: inst.id,
            notes: `Back-dated day-${i + 1} cash collection (Marketeer) ${loan.row_key}`,
            created_by: callerId,
            created_at: `${inst.due_date}T12:00:00+00:00`,
          });
          postedHere++;
          collectedHere += paid;
        }

        // ---- 6. Audit log ----
        await admin.from("audit_logs").insert({
          action: "OFFLINE_IMPORT_BACKDATED",
          entity_type: "loan_application",
          entity_id: loanId,
          module: "lending",
          user_id: callerId,
          new_values: {
            borrower: loan.name,
            row_key: loan.row_key,
            product: "MARKETEER",
            principal: loan.principal,
            total_repayment: loan.total,
            disbursement_date: loan.disbursement_date,
            disbursement_id: disbId,
            payments_posted: postedHere,
            amount_collected: collectedHere,
          },
        });

        createdLoans++;
        paymentsPosted += postedHere;
        totalPrincipalImported += loan.principal;
        totalCollectedImported += collectedHere;
        report.push({
          row_key: loan.row_key,
          name: loan.name,
          loan_id: loanId,
          user_id: userId,
          principal: loan.principal,
          payments_posted: postedHere,
          amount_collected: collectedHere,
          action: "IMPORTED",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        report.push({
          row_key: loan.row_key,
          name: loan.name,
          action: "ERROR",
          error: msg,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        summary: {
          total_rows: MARKETEER_LOANS.length,
          imported: createdLoans,
          skipped_already_imported: skipped,
          errors: report.filter((r) => r.action === "ERROR").length,
          payments_posted: paymentsPosted,
          total_principal_imported: totalPrincipalImported,
          total_collected_imported: totalCollectedImported,
        },
        report,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
