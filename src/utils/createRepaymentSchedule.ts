/**
 * Shared logic to create loan_repayments and set loan status to active.
 * Used on disbursement (AdminApplications, AdminDisbursements) and in Loan Details "Generate Schedule".
 */
import { format, addMonths } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { skipSundays } from "@/lib/marketeerCalculations";

export interface LoanForSchedule {
  id: string;
  user_id: string;
  loan_term_months: number;
  total_repayment: number;
  monthly_payment?: number | null;
  loan_product_id?: string | null;
  term_unit?: string | null;
  repayment_start_date?: string | null;
}

/**
 * Build repayment records and insert into loan_repayments, then set loan status to active.
 * Fetches loan_product for term_unit, interest_period, repayment_frequency when loan_product_id is set.
 */
export async function createRepaymentScheduleForLoan(
  loan: LoanForSchedule,
  supabase: SupabaseClient
): Promise<void> {
  const { count: existingRepaymentsCount, error: existingRepaymentsError } = await supabase
    .from("loan_repayments")
    .select("id", { count: "exact", head: true })
    .eq("loan_id", loan.id);

  if (existingRepaymentsError) throw existingRepaymentsError;

  if ((existingRepaymentsCount ?? 0) > 0) {
    const { error: ensureActiveError } = await supabase
      .from("loan_applications")
      .update({ status: "active" })
      .eq("id", loan.id)
      .neq("status", "active");
    if (ensureActiveError) throw ensureActiveError;
    return;
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

  const isDaily =
    termUnit === "days" ||
    (termUnit === "months" && (interestPeriod === "daily" || repaymentFrequency === "daily"));
  const isWeekly =
    termUnit === "weeks" ||
    (termUnit === "months" && (interestPeriod === "weekly" || repaymentFrequency === "weekly"));

  let paymentAmount: number;
  let numInstallments: number;

  if (isDaily) {
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
    due_date: string;
    installment_number: number;
    status: string;
  }> = [];
  // Use date-only (noon UTC) to prevent timezone-related off-by-one issues.
  // If a repayment_start_date is provided, that date becomes installment #1 due date.
  const startDate =
    loan.repayment_start_date && !Number.isNaN(new Date(loan.repayment_start_date).getTime())
      ? new Date(loan.repayment_start_date)
      : new Date();
  startDate.setHours(12, 0, 0, 0);
  const hasExplicitStartDate =
    Boolean(loan.repayment_start_date) && !Number.isNaN(new Date(loan.repayment_start_date as string).getTime());

  for (let i = 1; i <= numInstallments; i++) {
    let dueDate: Date;
    const offset = hasExplicitStartDate ? i - 1 : i;
    if (isDaily) {
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + offset);
      // No collections on Sundays — push to Monday
      dueDate = skipSundays(dueDate);
    } else if (isWeekly) {
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + offset * 7);
    } else {
      dueDate = addMonths(startDate, offset);
    }
    repaymentRecords.push({
      loan_id: loan.id,
      user_id: loan.user_id,
      amount: paymentAmount,
      due_date: format(dueDate, "yyyy-MM-dd"),
      installment_number: i,
      status: "pending",
    });
  }

  const { error: insertError } = await supabase
    .from("loan_repayments")
    .insert(repaymentRecords);
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("loan_applications")
    .update({ status: "active" })
    .eq("id", loan.id);
  if (updateError) throw updateError;
}
