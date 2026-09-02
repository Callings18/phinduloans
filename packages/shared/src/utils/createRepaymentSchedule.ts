/**
 * Shared logic to create loan_repayments and set loan status to active.
 * Used on disbursement (AdminApplications, AdminDisbursements) and in Loan Details "Generate Schedule".
 */
import { format, addDays, addMonths } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessCalendar, nextBusinessDay } from "@phinduloans/shared/lib/businessCalendar";
import { apiFeatureFlags } from "@phinduloans/shared/config/apiMode";

export interface LoanForSchedule {
  id: string;
  user_id: string;
  loan_term_months: number;
  total_repayment: number;
  monthly_payment?: number | null;
  loan_product_id?: string | null;
  term_unit?: string | null;
  repayment_start_date?: string | null;
  disbursed_at?: string | null;
}

/**
 * Build repayment records and insert into loan_repayments, then set loan status to active.
 * Fetches loan_product for term_unit, interest_period, repayment_frequency when loan_product_id is set.
 *
 * When `options.regenerateRemaining` is true (used by Restructure / Top-up), the helper:
 *   - DOES NOT early-exit when previous repayments exist
 *   - Skips installment numbers already taken by paid/partial rows
 *   - Generates only the remaining installments needed to reach the new total term
 * Caller is responsible for cancelling existing pending/overdue rows beforehand.
 */
export async function createRepaymentScheduleForLoan(
  loan: LoanForSchedule,
  supabase: SupabaseClient,
  options: { regenerateRemaining?: boolean } = {}
): Promise<void> {
  if (apiFeatureFlags.coreWrites) {
    throw new Error("Use generateLoanRepaymentSchedule — repayment rows are written by Nest");
  }
  const regenerate = options.regenerateRemaining === true;

  // Find existing rows that must NOT be overwritten (paid/partial keep their installment_number).
  const { data: keepRows, error: keepErr } = await supabase
    .from("loan_repayments")
    .select("id, installment_number, status, amount, original_amount, principal_paid, penalty_amount, penalty_paid")
    .eq("loan_id", loan.id)
    .in("status", ["paid", "partial", "pending", "overdue"]);
  if (keepErr) throw keepErr;

  const normalizedRows = [...(keepRows || [])];
  if (regenerate) {
    for (const row of normalizedRows) {
      if ((row as any).status !== "partial") continue;
      const paid = Number((row as any).principal_paid || 0);
      const unpaidPenalty = Math.max(0, Number((row as any).penalty_amount || 0) - Number((row as any).penalty_paid || 0));
      if (unpaidPenalty > 0.01) {
        throw new Error("Cannot regenerate schedule while a partial installment has unpaid penalties. Clear penalties first.");
      }
      if (paid <= 0.01) continue;
      const { error: normalizeErr } = await supabase
        .from("loan_repayments")
        .update({
          status: "paid",
          amount: paid,
          original_amount: paid,
          principal_paid: paid,
          paid_date: format(new Date(), "yyyy-MM-dd"),
        })
        .eq("id", (row as any).id);
      if (normalizeErr) throw normalizeErr;
      (row as any).status = "paid";
      (row as any).amount = paid;
      (row as any).original_amount = paid;
      (row as any).principal_paid = paid;
    }
  }

  const lockedNumbers = new Set<number>(
    normalizedRows
      .filter((r: any) => r.status === "paid" || r.status === "partial")
      .map((r: any) => Number(r.installment_number))
  );
  const activeRemaining = normalizedRows.filter(
    (r: any) => r.status === "pending" || r.status === "overdue"
  ).length;

  if (!regenerate) {
    // Original guard: if any active/historical rows already exist, just ensure loan is active and return.
    if ((normalizedRows?.length ?? 0) > 0) {
      const { error: ensureActiveError } = await supabase
        .from("loan_applications")
        .update({ status: "active" })
        .eq("id", loan.id)
        .neq("status", "active");
      if (ensureActiveError) throw ensureActiveError;
      return;
    }
  } else if (activeRemaining > 0) {
    // Restructure/top-up callers MUST cancel pending/overdue first; bail loudly if they didn't.
    throw new Error(
      "Cannot regenerate schedule while pending/overdue installments still exist. Cancel them first."
    );
  }

  let termUnit = loan.term_unit ?? "months";
  let interestPeriod = "monthly";
  let repaymentFrequency = "monthly";
  let productCode: string | null = null;

  if (loan.loan_product_id) {
    const { data: product } = await supabase
      .from("loan_products")
      .select("term_unit, interest_period, repayment_frequency, product_code")
      .eq("id", loan.loan_product_id)
      .single();
    if (product) {
      termUnit = (product as any).term_unit ?? termUnit;
      interestPeriod = (product as any).interest_period ?? interestPeriod;
      repaymentFrequency = (product as any).repayment_frequency ?? repaymentFrequency;
      productCode = (product as any).product_code ?? null;
    }
  }
  const isMarketeer = productCode === "MARKETEER";
  const isPaydaySoft = productCode === "PAYDAY_SOFT";
  // Bullet products are a single payment (Payday Soft, or any product whose
  // repayment_frequency is explicitly "bullet"). Collateral is NOT forced to
  // bullet — it follows the admin-entered term & interest like any product.
  const isBullet = isPaydaySoft || repaymentFrequency === "bullet";

  const isDaily =
    !isBullet && (termUnit === "days" ||
    (termUnit === "months" && (interestPeriod === "daily" || repaymentFrequency === "daily")));
  const isWeekly =
    !isBullet && (termUnit === "weeks" ||
    (termUnit === "months" && (interestPeriod === "weekly" || repaymentFrequency === "weekly")));

  let paymentAmount: number;
  let numInstallments: number;

  if (isBullet) {
    numInstallments = 1;
    paymentAmount = loan.total_repayment;
  } else if (isDaily) {
    if (termUnit === "days") {
      numInstallments = loan.loan_term_months;
      paymentAmount = loan.total_repayment / numInstallments;
    } else {
      numInstallments = loan.loan_term_months * 30;
      paymentAmount =
        (loan.monthly_payment ?? loan.total_repayment / loan.loan_term_months) / 30;
    }
  } else if (isWeekly) {
    if (termUnit === "weeks") {
      numInstallments = loan.loan_term_months;
      paymentAmount = loan.total_repayment / numInstallments;
    } else {
      numInstallments = loan.loan_term_months * 4;
      paymentAmount =
        (loan.monthly_payment ?? loan.total_repayment / loan.loan_term_months) / 4.33;
    }
  } else {
    numInstallments = loan.loan_term_months;
    paymentAmount =
      loan.monthly_payment ?? loan.total_repayment / loan.loan_term_months;
  }

  if (regenerate) {
    const alreadyPaidTotal = normalizedRows.reduce((sum, row: any) => {
      if (row.status !== "paid" && row.status !== "partial") return sum;
      const explicitPaid = Number(row.principal_paid || 0);
      return sum + (explicitPaid > 0 ? explicitPaid : Number(row.original_amount ?? row.amount ?? 0));
    }, 0);
    const remainingTotal = Math.max(0, loan.total_repayment - alreadyPaidTotal);
    const remainingInstallments = Array.from({ length: numInstallments }, (_, index) => index + 1)
      .filter((installmentNumber) => !lockedNumbers.has(installmentNumber)).length;

    if (remainingInstallments <= 0) {
      if (remainingTotal > 0.01) {
        throw new Error("Cannot regenerate schedule: no open installment slots remain for the unpaid balance.");
      }
    } else {
      paymentAmount = remainingTotal / remainingInstallments;
    }
  }

  const repaymentRecords: Array<{
    loan_id: string;
    user_id: string;
    amount: number;
    original_amount: number;
    due_date: string;
    installment_number: number;
    status: string;
  }> = [];
  // Use date-only (noon UTC) to prevent timezone-related off-by-one issues.
  // For MARKETEER, installment #1 must be the day AFTER disbursement.
  // For ALL products, no installment may land on a non-working day (Sunday by
  // default — admin-configurable in Settings → Calendar). Holidays are skipped too.
  const calendar = await getBusinessCalendar();

  const startDate =
    loan.repayment_start_date && !Number.isNaN(new Date(loan.repayment_start_date).getTime())
      ? new Date(loan.repayment_start_date)
      : loan.disbursed_at && !Number.isNaN(new Date(loan.disbursed_at).getTime())
      ? new Date(loan.disbursed_at)
      : new Date();
  startDate.setHours(12, 0, 0, 0);

  if (isMarketeer) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    if (startDate.getTime() <= today.getTime()) {
      startDate.setDate(today.getDate() + 1);
    }
  }
  // For daily/weekly cadences, push the anchor off any non-working day.
  if (isDaily || isWeekly) {
    const adjusted = nextBusinessDay(startDate, calendar);
    startDate.setTime(adjusted.getTime());
  }

  const hasExplicitStartDate =
    Boolean(loan.repayment_start_date) && !Number.isNaN(new Date(loan.repayment_start_date as string).getTime());

  // Anchor installment #1 directly on the start date ONLY for cadences where
  // repayment_start_date represents the actual first due date the admin entered
  // (daily / weekly schedules) or for Marketeer (already day-after-disbursement).
  // For monthly/bullet loans, repayment_start_date is the DISBURSEMENT date
  // (e.g. on reloans) — installment #1 must land one period AFTER it, never on
  // the disbursement day itself (which would make a fresh reloan instantly overdue).
  const anchorOnStart = (hasExplicitStartDate && (isDaily || isWeekly)) || isMarketeer;
  for (let i = 1; i <= numInstallments; i++) {
    if (lockedNumbers.has(i)) continue; // skip slots already taken by paid/partial rows
    let dueDate: Date;
    const offset = anchorOnStart ? i - 1 : i;
    if (isBullet) {
      // Bullet loans (Payday Soft or any explicit-bullet product) are always a
      // single payment due one term AFTER the start/disbursement date.
      dueDate = addDays(startDate, isPaydaySoft ? 30 : Number(loan.loan_term_months || 30));
    } else if (isDaily) {
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + offset);
      dueDate = nextBusinessDay(dueDate, calendar);
    } else if (isWeekly) {
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + offset * 7);
      dueDate = nextBusinessDay(dueDate, calendar);
    } else {
      dueDate = addMonths(startDate, offset);
      dueDate = nextBusinessDay(dueDate, calendar);
    }
    repaymentRecords.push({
      loan_id: loan.id,
      user_id: loan.user_id,
      amount: paymentAmount,
      original_amount: paymentAmount,
      due_date: format(dueDate, "yyyy-MM-dd"),
      installment_number: i,
      status: "pending",
    });
  }

  if (repaymentRecords.length > 0) {
    const { error: insertError } = await supabase
      .from("loan_repayments")
      .insert(repaymentRecords);
    if (insertError) throw insertError;
  }

  const { error: updateError } = await supabase
    .from("loan_applications")
    .update({ status: "active" })
    .eq("id", loan.id);
  if (updateError) throw updateError;
}
