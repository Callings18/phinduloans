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
    // Fallback: get amount and retry
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
