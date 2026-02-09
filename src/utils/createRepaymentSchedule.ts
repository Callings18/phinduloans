/**
 * Shared logic to create loan_repayments and set loan status to active.
 * Used on disbursement (AdminApplications, AdminDisbursements) and in Loan Details "Generate Schedule".
 */
import { format, addMonths } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface LoanForSchedule {
  id: string;
  user_id: string;
  loan_term_months: number;
  total_repayment: number;
  monthly_payment?: number | null;
  loan_product_id?: string | null;
  term_unit?: string | null;
}

/**
 * Build repayment records and insert into loan_repayments, then set loan status to active.
 * Fetches loan_product for term_unit, interest_period, repayment_frequency when loan_product_id is set.
 */
export async function createRepaymentScheduleForLoan(
  loan: LoanForSchedule,
  supabase: SupabaseClient
): Promise<void> {
  let termUnit = loan.term_unit ?? "months";
  let interestPeriod = "monthly";
  let repaymentFrequency = "monthly";

  if (loan.loan_product_id) {
    const { data: product } = await supabase
      .from("loan_products")
      .select("term_unit, interest_period, repayment_frequency")
      .eq("id", loan.loan_product_id)
      .single();
    if (product) {
      termUnit = (product as any).term_unit ?? termUnit;
      interestPeriod = (product as any).interest_period ?? interestPeriod;
      repaymentFrequency = (product as any).repayment_frequency ?? repaymentFrequency;
    }
  }

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
  const startDate = new Date();

  for (let i = 1; i <= numInstallments; i++) {
    let dueDate: Date;
    if (isDaily) {
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + i);
    } else if (isWeekly) {
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + i * 7);
    } else {
      dueDate = addMonths(startDate, i);
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
