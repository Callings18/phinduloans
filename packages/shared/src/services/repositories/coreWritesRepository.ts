import { apiGet, apiPost } from "@phinduloans/shared/api/httpClient";
import { apiFeatureFlags } from "@phinduloans/shared/config/apiMode";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import type { PaymentReceiptData } from "@phinduloans/shared/utils/handlePaymentReceipt";
import { callRpc } from "@phinduloans/shared/utils/rpcResult";

export interface CreateBorrowerInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  nrc_number?: string | null;
  address?: string | null;
  city?: string | null;
  product_code?: string;
  gender?: string | null;
  marital_status?: string | null;
}

export async function createBorrower(input: CreateBorrowerInput) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{
      ok?: boolean;
      success?: boolean;
      user_id?: string;
      existing?: boolean;
      message?: string;
      error?: { message?: string };
    }>("/api/v1/admin/borrowers", input);
  }
  const response = await supabase.functions.invoke("create-borrower", { body: input });
  if (response.error) {
    const details = (response.error as { context?: { json?: { error?: string } }; message?: string })?.context?.json?.error
      || (response.error as { message?: string })?.message;
    throw new Error(details || "Borrower creation failed.");
  }
  if (response.data?.error) throw new Error(response.data.error);
  return response.data;
}

export async function createStaffUser(input: {
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
}) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{
      ok?: boolean;
      success?: boolean;
      user_id?: string;
      temp_password?: string;
      message?: string;
    }>("/api/v1/admin/staff", input);
  }
  const res = await supabase.functions.invoke("create-staff-user", { body: input });
  if (res.error) throw new Error(res.error.message || "Failed to create user");
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export async function createLoanApplication(input: {
  application: Record<string, unknown>;
  borrowers?: Record<string, unknown>[];
  productCode?: string;
}): Promise<{ id: string }> {
  if (apiFeatureFlags.coreWrites) {
    const res = await apiPost<{ ok?: boolean; data?: { id: string } }>("/api/v1/applications", input);
    const id = res?.data?.id;
    if (!id) throw new Error("Application was not created");
    return { id };
  }
  const { data, error } = await supabase.from("loan_applications").insert(input.application).select("id").single();
  if (error || !data) throw error ?? new Error("Application was not created");
  if (input.borrowers?.length) {
    await supabase.from("loan_borrowers").insert(
      input.borrowers.map((row) => ({ ...row, loan_application_id: data.id })),
    );
  }
  return { id: data.id };
}

export async function recordLoanPayment(params: {
  repaymentId: string;
  amount: number;
  paymentMethod?: string;
  accountId?: string | null;
  transactionReference?: string | null;
  paidDate?: string | null;
  penaltyAmount?: number;
}): Promise<PaymentReceiptData> {
  if (apiFeatureFlags.coreWrites) {
    const res = await apiPost<{ ok?: boolean; data?: PaymentReceiptData }>(
      `/api/v1/repayments/${params.repaymentId}/record`,
      {
        amount: params.amount,
        paymentMethod: params.paymentMethod || "cash",
        accountId: params.accountId || null,
        transactionReference: params.transactionReference || null,
        paidDate: params.paidDate || null,
        penaltyAmount: params.penaltyAmount,
      },
    );
    const rpc = res?.data;
    if (!rpc || rpc.success === false) {
      throw new Error(rpc?.error || "Payment recording failed");
    }
    return { success: true, ...rpc };
  }

  const rpcArgs: Record<string, unknown> = {
    p_repayment_id: params.repaymentId,
    p_amount: params.amount,
    p_payment_method: params.paymentMethod || "cash",
    p_account_id: params.accountId || null,
    p_transaction_reference: params.transactionReference || null,
    p_paid_date: params.paidDate || null,
  };
  if (params.penaltyAmount !== undefined && params.penaltyAmount > 0) {
    rpcArgs.p_penalty_amount = params.penaltyAmount;
  }
  const res = await callRpc<PaymentReceiptData>("record_loan_payment", rpcArgs, "Payment recording failed");
  if (!res.success) throw new Error(res.error);
  return { success: true, ...res.data } as PaymentReceiptData;
}

function unwrapRpc<T>(res: { ok?: boolean; data?: T }) {
  return res?.data as T;
}

export async function applyLoanPenalties(loanId: string): Promise<number> {
  if (apiFeatureFlags.coreWrites) {
    const res = await apiPost<{ ok?: boolean; data?: number }>(`/api/v1/loans/${loanId}/penalties`);
    return Number(unwrapRpc(res) || 0);
  }
  const { data, error } = await (supabase.rpc as any)("apply_loan_penalties", { p_loan_id: loanId });
  if (error) throw error;
  return Number(data || 0);
}

export async function getEarlySettlementQuote(loanId: string) {
  if (apiFeatureFlags.coreWrites) {
    const res = await apiGet<{ ok?: boolean; data?: Record<string, number> | null }>(
      `/api/v1/loans/${loanId}/early-settlement`,
    );
    return unwrapRpc(res);
  }
  const { data, error } = await (supabase.rpc as any)("calculate_early_settlement", { p_loan_id: loanId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function reconcileLoanCompletion(loanId: string) {
  if (apiFeatureFlags.coreWrites) {
    const res = await apiPost<{ ok?: boolean; data?: Record<string, unknown> }>(
      `/api/v1/loans/${loanId}/reconcile-completion`,
    );
    return unwrapRpc(res);
  }
  const res = await callRpc("admin_reconcile_loan_completion", { p_loan_id: loanId }, "Could not complete loan");
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function approveWriteOff(writeOffId: string) {
  if (apiFeatureFlags.coreWrites) {
    await apiPost(`/api/v1/write-offs/${writeOffId}/approve`);
    return;
  }
  const res = await callRpc("admin_approve_loan_writeoff", { p_writeoff_id: writeOffId }, "Write-off approval failed");
  if (!res.success) throw new Error(res.error);
}

export async function rejectWriteOff(writeOffId: string, reason: string) {
  if (apiFeatureFlags.coreWrites) {
    await apiPost(`/api/v1/write-offs/${writeOffId}/reject`, { reason });
    return;
  }
  const res = await callRpc(
    "admin_reject_loan_writeoff",
    { p_writeoff_id: writeOffId, p_reason: reason },
    "Write-off rejection failed",
  );
  if (!res.success) throw new Error(res.error);
}

export async function recordWriteOffRecovery(writeOffId: string, amount: number, notes: string) {
  if (apiFeatureFlags.coreWrites) {
    await apiPost(`/api/v1/write-offs/${writeOffId}/recover`, { amount, notes });
    return;
  }
  const res = await callRpc(
    "admin_record_writeoff_recovery",
    { p_writeoff_id: writeOffId, p_amount: amount, p_notes: notes },
    "Recovery recording failed",
  );
  if (!res.success) throw new Error(res.error);
}

export async function setExpenseStatus(expenseId: string, status: string, rejectReason?: string) {
  if (apiFeatureFlags.coreWrites) {
    await apiPost(`/api/v1/expenses/${expenseId}/status`, { status, rejectReason });
    return;
  }
  const res = await callRpc(
    "admin_set_expense_status",
    { p_expense_id: expenseId, p_new_status: status, p_reject_reason: rejectReason ?? null },
    "Expense status update failed",
  );
  if (!res.success) throw new Error(res.error);
}

export async function shiftPendingRepaymentsToBusinessDays() {
  if (apiFeatureFlags.coreWrites) {
    const res = await apiPost<{ ok?: boolean; data?: { shifted_count?: number; loans_touched?: number } }>(
      "/api/v1/admin/repayments/shift-business-days",
    );
    return unwrapRpc(res);
  }
  const { data, error } = await (supabase.rpc as any)("shift_pending_repayments_to_business_days");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function reverseLoanPayment(repaymentId: string, reason: string) {
  if (apiFeatureFlags.coreWrites) {
    await apiPost(`/api/v1/repayments/${repaymentId}/reverse`, { reason });
    return;
  }
  throw new Error("Set VITE_API_URL to reverse payments through the API");
}

export async function undoLoanDisbursement(loanId: string) {
  if (apiFeatureFlags.coreWrites) {
    await apiPost(`/api/v1/loans/${loanId}/undo-disbursement`);
    return;
  }
  throw new Error("Set VITE_API_URL to undo disbursement through the API");
}

export async function deleteLoanApplication(loanId: string, reason?: string) {
  if (apiFeatureFlags.coreWrites) {
    await apiPost(`/api/v1/loans/${loanId}/delete`, { reason });
    return;
  }
  throw new Error("Set VITE_API_URL to delete loans through the API");
}

export async function createPendingDisbursement(input: {
  loanId: string;
  amount: number;
  disbursementMethod: string;
  sourceAccountId: string;
  mobileMoneyNumber?: string | null;
  accountNumber?: string | null;
}) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{ ok?: boolean; data?: { id: string } }>("/api/v1/disbursements", input);
  }
  const { data, error } = await supabase
    .from("disbursements")
    .insert({
      loan_id: input.loanId,
      amount: input.amount,
      disbursement_method: input.disbursementMethod,
      mobile_money_number: input.mobileMoneyNumber || null,
      account_number: input.accountNumber || null,
      status: "pending",
      source_account_id: input.sourceAccountId,
    })
    .select("id")
    .single();
  if (error || !data?.id) throw error ?? new Error("Could not create disbursement");
  return { ok: true, data: { id: data.id } };
}

export async function reloanLoan(
  loanId: string,
  input: {
    newPrincipal: number;
    newTermMonths: number;
    interestRate: number;
    monthlyPayment: number;
    totalRepayment: number;
    reloanDate: string;
    parentNotes: string;
    childNotes: string;
    termUnit?: string;
    optionalTopUpAmount?: number;
    topUpNetDisbursement?: number;
    topUpFees?: number;
    sourceAccountId?: string;
    parentEventReason?: string;
    childEventReason?: string;
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{ ok?: boolean; data?: { id: string; newPrincipal: number } }>(
      `/api/v1/loans/${loanId}/reloan`,
      input,
    );
  }
  throw new Error("Set VITE_API_URL to reloan through the API");
}

export async function topUpLoan(
  loanId: string,
  input: {
    additionalAmount: number;
    netDisbursement: number;
    totalFees: number;
    newPrincipal: number;
    newTotalRepayment: number;
    newMonthlyPayment: number;
    notes: string;
    sourceAccountId: string;
    reason?: string;
    termUnit?: string;
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{ ok?: boolean; data?: { additionalAmount: number; netDisbursement: number } }>(
      `/api/v1/loans/${loanId}/top-up`,
      input,
    );
  }
  throw new Error("Set VITE_API_URL to top-up through the API");
}

export async function restructureLoan(
  loanId: string,
  input: {
    principal: number;
    newTermMonths: number;
    newInterestRate: number;
    newTotalRepayment: number;
    newMonthlyPayment: number;
    notes: string;
    reason?: string;
    termUnit?: string;
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{ ok?: boolean; data?: { loanId: string } }>(`/api/v1/loans/${loanId}/restructure`, input);
  }
  throw new Error("Set VITE_API_URL to restructure through the API");
}
