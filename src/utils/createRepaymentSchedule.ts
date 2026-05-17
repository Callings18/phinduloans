/**
 * Shared logic to create loan_repayments and set loan status to active.
 * Used on disbursement (AdminApplications, AdminDisbursements) and in Loan Details "Generate Schedule".
 */
import { format, addDays, addMonths } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessCalendar, nextBusinessDay } from "@/lib/businessCalendar";

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
  const regenerate = options.regenerateRemaining === true;

  // Find existing rows that must NOT be overwritten (paid/partial keep their installment_number).
  const { data: keepRows, error: keepErr } = await supabase
    .from("loan_repayments")
    .select("installment_number, status")
    .eq("loan_id", loan.id)
    .in("status", ["paid", "partial", "pending", "overdue"]);
  if (keepErr) throw keepErr;

  const lockedNumbers = new Set<number>(
    (keepRows || [])
      .filter((r: any) => r.status === "paid" || r.status === "partial")
      .map((r: any) => Number(r.installment_number))
  );
  const activeRemaining = (keepRows || []).filter(
    (r: any) => r.status === "pending" || r.status === "overdue"
  ).length;

  if (!regenerate) {
    // Original guard: if any active/historical rows already exist, just ensure loan is active and return.
    if ((keepRows?.length ?? 0) > 0) {
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

  // For Marketeer we always anchor installment #1 on startDate (which is
  // already the day-after-disbursement, business-day adjusted).
  const anchorOnStart = hasExplicitStartDate || isMarketeer;
  for (let i = 1; i <= numInstallments; i++) {
    if (lockedNumbers.has(i)) continue; // skip slots already taken by paid/partial rows
    let dueDate: Date;
    const offset = anchorOnStart ? i - 1 : i;
    if (isBullet) {
      dueDate = isPaydaySoft || !hasExplicitStartDate
        ? addDays(startDate, Number(loan.loan_term_months || 30))
        : new Date(startDate);
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
