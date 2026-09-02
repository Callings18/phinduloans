import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import {
  applyLoanPenalties,
  createLoanApplication,
  getEarlySettlementQuote,
  recordLoanPayment as recordLoanPaymentFromApi,
  restructureLoan,
  reverseLoanPayment,
  topUpLoan,
} from "@phinduloans/shared/services/repositories/coreWritesRepository";
import {
  completeDisbursement,
  transitionLoanByAction,
} from "@phinduloans/shared/services/repositories/workflowRepository";
import type { PaymentReceiptData } from "@phinduloans/shared/utils/handlePaymentReceipt";

type HouseReviewStage = "loan_officer" | "finance" | "manager";

export interface RecordPaymentParams {
  repaymentId: string;
  amount: number;
  paymentMethod?: string;
  accountId?: string | null;
  transactionReference?: string | null;
  paidDate?: string | null; // ISO date "yyyy-MM-dd"
  /**
   * Optional split: portion of `amount` allocated to the unpaid penalty on
   * the installment. The principal portion is `amount - penaltyAmount`.
   * Server-side `record_loan_payment` validates that both portions fit
   * the outstanding amounts on the installment.
   */
  penaltyAmount?: number;
}

export type { PaymentReceiptData };

export interface CompleteDisbursementParams {
  disbursementId: string;
  accountId: string;
  transactionReference?: string | null;
}

/**
 * Record a loan payment via the atomic RPC function.
 * This handles: marking repayment paid, crediting the account, auto-completing loan, audit logging.
 */
export async function recordLoanPayment(params: RecordPaymentParams): Promise<PaymentReceiptData> {
  return recordLoanPaymentFromApi({
    repaymentId: params.repaymentId,
    amount: params.amount,
    paymentMethod: params.paymentMethod,
    accountId: params.accountId,
    transactionReference: params.transactionReference,
    paidDate: params.paidDate,
    penaltyAmount: params.penaltyAmount,
  });
}

export async function houseSetLoanStatus(loanId: string, status: string) {
  const actionMap: Record<string, string> = {
    approved: "approve",
    disbursed: "disburse",
    rejected: "reject",
    active: "activate",
    completed: "complete",
    defaulted: "default",
  };
  const action = actionMap[status] || status;
  await transitionLoanByAction(loanId, action);
}

export async function houseStageReview(loanId: string, stage: HouseReviewStage) {
  const actionMap: Record<string, string> = {
    loan_officer: "verify_documents",
    finance: "finance_approve",
    manager: "approve",
  };
  const action = actionMap[stage] || stage;
  await transitionLoanByAction(loanId, action);
}

export async function houseMarkDisbursementCompleted(params: CompleteDisbursementParams) {
  await completeDisbursement({
    disbursementId: params.disbursementId,
    accountId: params.accountId,
    transactionReference: params.transactionReference || null,
  });
}

export async function houseMarkRepaymentPaid(repaymentId: string) {
  const { data, error } = await supabase
    .from("loan_repayments")
    .select("amount, original_amount, principal_paid, penalty_amount, penalty_paid")
    .eq("id", repaymentId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Could not load repayment");
  if (!data) throw new Error("Could not determine repayment amount");

  const principalBase = Number(data.original_amount ?? data.amount ?? 0);
  const principalPaid = Number(data.principal_paid ?? 0);
  const penaltyBase = Number(data.penalty_amount ?? 0);
  const penaltyPaid = Number(data.penalty_paid ?? 0);
  const remaining =
    Math.max(0, principalBase - principalPaid) + Math.max(0, penaltyBase - penaltyPaid);
  const amount = remaining > 0 ? remaining : Number(data.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Could not determine repayment amount");
  }
  return recordLoanPayment({ repaymentId, amount });
}

/* ============================================================
 * Legacy parity actions for House loans
 * ========================================================== */

export async function houseApplyPenalties(loanId: string): Promise<number> {
  return applyLoanPenalties(loanId);
}

export async function houseEarlySettlementQuote(loanId: string) {
  const row = await getEarlySettlementQuote(loanId);
  return {
    outstanding_principal: Number(row?.outstanding_principal || 0),
    outstanding_interest: Number(row?.outstanding_interest || 0),
    total_penalties: Number(row?.total_penalties || 0),
    early_settlement_fee: Number(row?.early_settlement_fee || 0),
    total_payoff_amount: Number(row?.total_payoff_amount || 0),
  };
}

export interface EarlySettlementParams {
  loanId: string;
  accountId: string;
  paymentMethod?: string;
}

export async function houseEarlySettlement(params: EarlySettlementParams) {
  if (!params.accountId) throw new Error("Select the account to credit settlement funds to");
  const { data: rows, error } = await supabase
    .from("loan_repayments")
    .select("id, amount, principal_paid, status")
    .eq("loan_id", params.loanId)
    .in("status", ["pending", "overdue"])
    .order("installment_number", { ascending: true });
  if (error) throw error;
  let last: PaymentReceiptData | null = null;
  for (const r of rows || []) {
    last = await recordLoanPayment({
      repaymentId: r.id,
      amount: Number(r.amount || 0),
      paymentMethod: params.paymentMethod || "cash",
      accountId: params.accountId,
      transactionReference: "EARLY-SETTLEMENT",
    });
  }
  return last;
}

export async function houseMarkDefaulted(loanId: string, reason: string) {
  await transitionLoanByAction(loanId, "default", reason);
}

export interface RestructureParams {
  loanId: string;
  newTermMonths: number;
  newInterestRate: number;
  newMonthlyPayment: number;
  newTotalRepayment: number;
  termUnit?: string;
  loanProductId?: string | null;
  userId: string;
  reason: string;
}

export async function houseRestructureLoan(params: RestructureParams) {
  const { data: loan, error } = await supabase
    .from("loan_applications")
    .select("loan_amount, admin_notes")
    .eq("id", params.loanId)
    .maybeSingle();
  if (error) throw error;
  const principal = Number(loan?.loan_amount || 0);
  if (principal <= 0.01) throw new Error("Cannot restructure a loan with no principal");
  await restructureLoan(params.loanId, {
    principal,
    newTermMonths: params.newTermMonths,
    newInterestRate: params.newInterestRate,
    newTotalRepayment: params.newTotalRepayment,
    newMonthlyPayment: params.newMonthlyPayment,
    notes: `${loan?.admin_notes || ""}\n\n[RESTRUCTURED]: ${params.reason}`.trim(),
    reason: params.reason,
    termUnit: params.termUnit,
  });
}

export interface TopUpParams {
  loanId: string;
  additionalPrincipal: number;
  newTotalRepayment: number;
  newMonthlyPayment: number;
  newTermMonths: number;
  termUnit?: string;
  loanProductId?: string | null;
  userId: string;
  fundingAccountId: string;
  reason: string;
}

export async function houseTopUpLoan(params: TopUpParams) {
  if (!params.fundingAccountId) throw new Error("Funding account is required for top-up");

  const { data: existing, error: fetchErr } = await supabase
    .from("loan_applications")
    .select("loan_amount, admin_notes")
    .eq("id", params.loanId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const newPrincipal = Number(existing?.loan_amount || 0) + params.additionalPrincipal;
  await topUpLoan(params.loanId, {
    additionalAmount: params.additionalPrincipal,
    netDisbursement: params.additionalPrincipal,
    totalFees: 0,
    newPrincipal,
    newTotalRepayment: params.newTotalRepayment,
    newMonthlyPayment: params.newMonthlyPayment,
    notes: `${existing?.admin_notes || ""}\n\n[TOP-UP]: ${params.reason}`.trim(),
    sourceAccountId: params.fundingAccountId,
    reason: params.reason,
    termUnit: params.termUnit,
    newTermMonths: params.newTermMonths,
  });
}

export interface ReloanParams {
  parentLoanId: string;
  newPrincipal: number;
  newTermMonths: number;
  newMonthlyPayment: number;
  newTotalRepayment: number;
  termUnit?: string;
  reason: string;
}

export async function houseReloanFromCompleted(params: ReloanParams): Promise<string> {
  const { data: parent, error: parentErr } = await supabase
    .from("loan_applications")
    .select("*")
    .eq("id", params.parentLoanId)
    .maybeSingle();
  if (parentErr) throw parentErr;
  if (!parent) throw new Error("Parent loan not found");

  const insertPayload: any = {
    user_id: parent.user_id,
    full_name: parent.full_name,
    email: parent.email,
    phone: parent.phone,
    nrc_number: parent.nrc_number,
    employment_type: parent.employment_type,
    employer_name: parent.employer_name,
    employer_id: parent.employer_id,
    job_title: parent.job_title,
    monthly_income: parent.monthly_income,
    loan_purpose: parent.loan_purpose || "Re-loan",
    loan_product_id: parent.loan_product_id,
    loan_amount: params.newPrincipal,
    loan_term_months: params.newTermMonths,
    monthly_payment: params.newMonthlyPayment,
    total_repayment: params.newTotalRepayment,
    term_unit: params.termUnit || parent.term_unit || "months",
    interest_rate: parent.interest_rate,
    parent_loan_id: parent.id,
    status: "pending",
    address: parent.address,
    city: parent.city,
    source: "reloan",
  };

  const { id } = await createLoanApplication({
    application: insertPayload,
  });

  return id;
}

export interface ReversePaymentParams {
  repaymentId: string;
  accountId: string;
  reason: string;
}

export async function houseReverseLastPayment(params: ReversePaymentParams) {
  await reverseLoanPayment(params.repaymentId, params.reason);
}
