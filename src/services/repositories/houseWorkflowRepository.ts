import { supabase } from "@/integrations/supabase/client";

type HouseReviewStage = "loan_officer" | "finance" | "manager";

function assertRpcOk(data: unknown, fallbackMessage: string) {
  if (typeof data === "object" && data !== null && "ok" in data) {
    const result = data as { ok?: boolean; error?: string };
    if (result.ok === false) {
      throw new Error(result.error || fallbackMessage);
    }
  }
}

export interface RecordPaymentParams {
  repaymentId: string;
  amount: number;
  paymentMethod?: string;
  accountId?: string | null;
  transactionReference?: string | null;
}

export interface PaymentReceiptData {
  success: boolean;
  error?: string;
  receipt_no?: string;
  borrower_name?: string;
  borrower_phone?: string;
  borrower_email?: string;
  loan_id?: string;
  loan_amount?: number;
  repayment_amount?: number;
  payment_method?: string;
  installment_number?: number;
  total_installments?: number;
  total_paid?: number;
  outstanding_balance?: number;
  loan_completed?: boolean;
}

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
  const { data, error } = await (supabase.rpc as any)("record_loan_payment", {
    p_repayment_id: params.repaymentId,
    p_amount: params.amount,
    p_payment_method: params.paymentMethod || "cash",
    p_account_id: params.accountId || null,
    p_transaction_reference: params.transactionReference || null,
  });
  if (error) throw error;
  if (data && typeof data === "object" && !data.success) {
    throw new Error(data.error || "Payment recording failed");
  }
  return data as PaymentReceiptData;
}

export async function houseSetLoanStatus(loanId: string, status: string) {
  // Use the existing transition_loan_status RPC
  const actionMap: Record<string, string> = {
    approved: "approve",
    disbursed: "disburse",
    rejected: "reject",
    active: "activate",
    completed: "complete",
    defaulted: "default",
  };
  const action = actionMap[status] || status;
  const { data, error } = await (supabase.rpc as any)("transition_loan_status", {
    p_loan_id: loanId,
    p_action: action,
    p_reason: null,
  });
  if (error) throw error;
  if (data && typeof data === "object" && !data.success && !data.ok) {
    throw new Error(data.error || "Status transition failed");
  }
}

export async function houseStageReview(loanId: string, stage: HouseReviewStage) {
  const actionMap: Record<string, string> = {
    loan_officer: "verify_documents",
    finance: "finance_approve",
    manager: "approve",
  };
  const action = actionMap[stage] || stage;
  const { data, error } = await (supabase.rpc as any)("transition_loan_status", {
    p_loan_id: loanId,
    p_action: action,
    p_reason: null,
  });
  if (error) throw error;
  if (data && typeof data === "object" && !data.success && !data.ok) {
    throw new Error(data.error || "Review action failed");
  }
}

export async function houseMarkDisbursementCompleted(params: CompleteDisbursementParams) {
  const { data, error } = await (supabase.rpc as any)("complete_disbursement", {
    p_disbursement_id: params.disbursementId,
    p_account_id: params.accountId,
    p_transaction_reference: params.transactionReference || null,
  });
  if (error) throw error;
  assertRpcOk(data, "Disbursement completion failed");
}

export async function houseMarkRepaymentPaid(repaymentId: string) {
  return recordLoanPayment({ repaymentId, amount: 0 }).catch(async () => {
    const { data } = await supabase
      .from("loan_repayments")
      .select("amount")
      .eq("id", repaymentId)
      .maybeSingle();
    if (data) {
      return recordLoanPayment({ repaymentId, amount: Number(data.amount) });
    }
    throw new Error("Could not determine repayment amount");
  });
}

/* ============================================================
 * Legacy parity actions for House loans
 * ========================================================== */

export async function houseApplyPenalties(loanId: string): Promise<number> {
  const { data, error } = await (supabase.rpc as any)("apply_loan_penalties", { p_loan_id: loanId });
  if (error) throw error;
  return Number(data || 0);
}

export async function houseEarlySettlementQuote(loanId: string) {
  const { data, error } = await (supabase.rpc as any)("calculate_early_settlement", { p_loan_id: loanId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
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
  const { data, error } = await (supabase.rpc as any)("admin_mark_loan_defaulted", {
    p_loan_id: loanId,
    p_reason: reason,
  });
  if (error) throw error;
  if (data && typeof data === "object" && data.success === false) {
    throw new Error(data.error || "Failed to mark loan defaulted");
  }
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
  const { error: updateErr } = await supabase
    .from("loan_applications")
    .update({
      loan_term_months: params.newTermMonths,
      interest_rate: params.newInterestRate,
      monthly_payment: params.newMonthlyPayment,
      total_repayment: params.newTotalRepayment,
      term_unit: params.termUnit || "months",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.loanId);
  if (updateErr) throw updateErr;

  // Cancel pending repayments before regenerating
  const { error: cancelErr } = await supabase
    .from("loan_repayments")
    .update({ status: "cancelled" })
    .eq("loan_id", params.loanId)
    .in("status", ["pending", "overdue"]);
  if (cancelErr) throw cancelErr;

  const { createRepaymentScheduleForLoan } = await import("@/utils/createRepaymentSchedule");
  await createRepaymentScheduleForLoan(
    {
      id: params.loanId,
      user_id: params.userId,
      loan_term_months: params.newTermMonths,
      total_repayment: params.newTotalRepayment,
      monthly_payment: params.newMonthlyPayment,
      loan_product_id: params.loanProductId || null,
      term_unit: params.termUnit || "months",
    },
    supabase,
  );

  await supabase.from("audit_logs").insert({
    action: "LOAN_RESTRUCTURED",
    entity_type: "loan_application",
    entity_id: params.loanId,
    module: "loans",
    new_values: {
      term_months: params.newTermMonths,
      interest_rate: params.newInterestRate,
      total_repayment: params.newTotalRepayment,
      reason: params.reason,
    },
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

  // Update loan to new principal/term
  const { data: existing, error: fetchErr } = await supabase
    .from("loan_applications")
    .select("loan_amount")
    .eq("id", params.loanId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const newPrincipal = Number(existing?.loan_amount || 0) + params.additionalPrincipal;

  const { error: updateErr } = await supabase
    .from("loan_applications")
    .update({
      loan_amount: newPrincipal,
      loan_term_months: params.newTermMonths,
      monthly_payment: params.newMonthlyPayment,
      total_repayment: params.newTotalRepayment,
      term_unit: params.termUnit || "months",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.loanId);
  if (updateErr) throw updateErr;

  // Create + complete a disbursement for the additional amount
  const { data: disb, error: disbErr } = await supabase
    .from("disbursements")
    .insert({
      loan_id: params.loanId,
      amount: params.additionalPrincipal,
      disbursement_method: "cash",
      status: "pending",
      source_account_id: params.fundingAccountId,
    })
    .select("id")
    .single();
  if (disbErr) throw disbErr;

  await houseMarkDisbursementCompleted({
    disbursementId: disb.id,
    accountId: params.fundingAccountId,
    transactionReference: "TOP-UP",
  });

  // Cancel existing pending repayments and regenerate
  await supabase
    .from("loan_repayments")
    .update({ status: "cancelled" })
    .eq("loan_id", params.loanId)
    .in("status", ["pending", "overdue"]);

  const { createRepaymentScheduleForLoan } = await import("@/utils/createRepaymentSchedule");
  await createRepaymentScheduleForLoan(
    {
      id: params.loanId,
      user_id: params.userId,
      loan_term_months: params.newTermMonths,
      total_repayment: params.newTotalRepayment,
      monthly_payment: params.newMonthlyPayment,
      loan_product_id: params.loanProductId || null,
      term_unit: params.termUnit || "months",
    },
    supabase,
  );

  await supabase.from("audit_logs").insert({
    action: "LOAN_TOPUP",
    entity_type: "loan_application",
    entity_id: params.loanId,
    module: "loans",
    new_values: {
      additional_principal: params.additionalPrincipal,
      new_principal: newPrincipal,
      funding_account_id: params.fundingAccountId,
      reason: params.reason,
    },
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

  const { data: newLoan, error: insertErr } = await supabase
    .from("loan_applications")
    .insert(insertPayload)
    .select("id")
    .single();
  if (insertErr) throw insertErr;

  await supabase.from("audit_logs").insert({
    action: "LOAN_RELOAN_CREATED",
    entity_type: "loan_application",
    entity_id: newLoan.id,
    module: "loans",
    new_values: { parent_loan_id: parent.id, new_principal: params.newPrincipal, reason: params.reason },
  });

  return newLoan.id;
}

export interface ReversePaymentParams {
  repaymentId: string;
  accountId: string;
  reason: string;
}

export async function houseReverseLastPayment(params: ReversePaymentParams) {
  if (!params.accountId) throw new Error("Select the account to debit the reversal from");

  const { data: rep, error: repErr } = await supabase
    .from("loan_repayments")
    .select("id, loan_id, amount, principal_paid, status, installment_number")
    .eq("id", params.repaymentId)
    .maybeSingle();
  if (repErr) throw repErr;
  if (!rep) throw new Error("Repayment not found");
  if (rep.status !== "paid") throw new Error("Only paid repayments can be reversed");

  const amount = Number(rep.principal_paid || rep.amount || 0);

  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("id, balance")
    .eq("id", params.accountId)
    .maybeSingle();
  if (accErr) throw accErr;
  if (!account) throw new Error("Account not found");
  if (Number(account.balance) < amount) throw new Error("Account balance insufficient to reverse");

  const newBalance = Number(account.balance) - amount;

  // Debit the account
  const { error: updErr } = await supabase
    .from("accounts")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("id", params.accountId);
  if (updErr) throw updErr;

  await supabase.from("account_transactions").insert({
    account_id: params.accountId,
    transaction_type: "adjustment_debit",
    amount,
    balance_before: Number(account.balance),
    balance_after: newBalance,
    destination: "Payment reversal",
    reference_type: "repayment_reversal",
    reference_id: rep.id,
    notes: `Reversal of installment #${rep.installment_number}: ${params.reason}`,
  });

  // Flip repayment back to pending
  const { error: revErr } = await supabase
    .from("loan_repayments")
    .update({
      status: "pending",
      paid_date: null,
      principal_paid: null,
      payment_method: null,
      transaction_reference: null,
    })
    .eq("id", rep.id);
  if (revErr) throw revErr;

  // If the loan was completed, reopen to active
  await supabase
    .from("loan_applications")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", rep.loan_id)
    .eq("status", "completed");

  await supabase.from("audit_logs").insert({
    action: "PAYMENT_REVERSED",
    entity_type: "repayment",
    entity_id: rep.id,
    module: "collections",
    new_values: { amount, account_id: params.accountId, reason: params.reason, loan_id: rep.loan_id },
  });
}
