import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@phinduloans/shared/api/httpClient";
import { apiFeatureFlags } from "@phinduloans/shared/config/apiMode";
import type { PaymentReceiptData } from "@phinduloans/shared/utils/handlePaymentReceipt";

function requireNest(): void {
  if (!apiFeatureFlags.coreWrites) {
    throw new Error("Set VITE_API_URL so writes go through Nest");
  }
}

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
  requireNest();
  return apiPost<{
    ok?: boolean;
    success?: boolean;
    user_id?: string;
    existing?: boolean;
    message?: string;
    error?: { message?: string };
  }>("/api/v1/admin/borrowers", input);
}

export async function createStaffUser(input: {
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
}) {
  requireNest();
  return apiPost<{
    ok?: boolean;
    success?: boolean;
    user_id?: string;
    temp_password?: string;
    message?: string;
  }>("/api/v1/admin/staff", input);
}

export async function createLoanApplication(input: {
  application: Record<string, unknown>;
  borrowers?: Record<string, unknown>[];
  productCode?: string;
}): Promise<{ id: string }> {
  requireNest();
  const res = await apiPost<{ ok?: boolean; data?: { id: string } }>("/api/v1/applications", input);
  const id = res?.data?.id;
  if (!id) throw new Error("Application was not created");
  return { id };
}

export async function updateLoanApplication(
  loanId: string,
  input: {
    application?: Record<string, unknown>;
    borrowers?: Record<string, unknown>[];
    profile?: Record<string, unknown>;
    profileUserId?: string;
  },
) {
  if (apiFeatureFlags.coreWrites) {
    return apiPatch<{ ok?: boolean; data?: { id: string } }>(`/api/v1/loans/${loanId}`, input);
  }
  throw new Error("Set VITE_API_URL to update loans through the API");
}

export type LoanDocumentMeta = {
  borrower_id: string;
  doc_type: string;
  doc_label: string;
  file_url: string;
  file_name: string;
  mime_type?: string | null;
  file_size?: number | null;
  loan_product_id?: string | null;
  saveToVault?: boolean;
};

export async function registerLoanDocuments(loanId: string, documents: LoanDocumentMeta[]) {
  if (!documents.length) return { ok: true, data: { count: 0 } };
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{ ok?: boolean; data?: { count: number } }>(`/api/v1/loans/${loanId}/documents`, { documents });
  }
  throw new Error("Set VITE_API_URL to register documents through the API");
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
  requireNest();
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

function unwrapRpc<T>(res: { ok?: boolean; data?: T }) {
  return res?.data as T;
}

export async function applyLoanPenalties(loanId: string): Promise<number> {
  requireNest();
  const res = await apiPost<{ ok?: boolean; data?: number }>(`/api/v1/loans/${loanId}/penalties`);
  return Number(unwrapRpc(res) || 0);
}

export async function getEarlySettlementQuote(loanId: string) {
  requireNest();
  const res = await apiGet<{ ok?: boolean; data?: Record<string, number> | null }>(
    `/api/v1/loans/${loanId}/early-settlement`,
  );
  return unwrapRpc(res);
}

export async function reconcileLoanCompletion(loanId: string) {
  requireNest();
  const res = await apiPost<{ ok?: boolean; data?: Record<string, unknown> }>(
    `/api/v1/loans/${loanId}/reconcile-completion`,
  );
  return unwrapRpc(res);
}

export async function approveWriteOff(writeOffId: string) {
  requireNest();
  await apiPost(`/api/v1/write-offs/${writeOffId}/approve`);
}

export async function rejectWriteOff(writeOffId: string, reason: string) {
  requireNest();
  await apiPost(`/api/v1/write-offs/${writeOffId}/reject`, { reason });
}

export async function recordWriteOffRecovery(writeOffId: string, amount: number, notes: string) {
  requireNest();
  await apiPost(`/api/v1/write-offs/${writeOffId}/recover`, { amount, notes });
}

export async function setExpenseStatus(expenseId: string, status: string, rejectReason?: string) {
  requireNest();
  await apiPost(`/api/v1/expenses/${expenseId}/status`, { status, rejectReason });
}

export async function shiftPendingRepaymentsToBusinessDays() {
  requireNest();
  const res = await apiPost<{ ok?: boolean; data?: { shifted_count?: number; loans_touched?: number } }>(
    "/api/v1/admin/repayments/shift-business-days",
  );
  return unwrapRpc(res);
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
  requireNest();
  return apiPost<{ ok?: boolean; data?: { id: string } }>("/api/v1/disbursements", input);
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
    newTermMonths?: number;
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

export async function borrowerSignContract(loanId: string, signedContractUrl: string) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{ ok?: boolean; data?: { id: string; status?: string } }>(
      `/api/v1/loans/${loanId}/borrower-sign`,
      { signedContractUrl },
    );
  }
  throw new Error("Set VITE_API_URL to record signed contracts through the API");
}

export async function addLoanNote(loanId: string, note: string, visibleToBorrower = false) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{ ok?: boolean; data?: { id: string } }>(`/api/v1/loans/${loanId}/notes`, {
      note,
      visibleToBorrower,
    });
  }
  throw new Error("Set VITE_API_URL to add loan notes through the API");
}

export async function createWriteOff(loanId: string, amount: number, reason: string) {
  requireNest();
  return apiPost<{ ok?: boolean; data?: { id: string } }>("/api/v1/write-offs", { loanId, amount, reason });
}

export async function generateLoanRepaymentSchedule(loanId: string, regenerateRemaining = false) {
  requireNest();
  return apiPost<{ ok?: boolean; data?: { id: string } }>(`/api/v1/loans/${loanId}/schedule`, {
    regenerateRemaining,
  });
}

export type LoanDraftRow = {
  id: string;
  staff_user_id: string;
  borrower_id: string | null;
  product_code: string;
  form_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export async function listLoanDrafts(filters?: { borrowerId?: string; productCode?: string }) {
  if (!apiFeatureFlags.coreWrites) throw new Error("Set VITE_API_URL to list drafts through the API");
  const q = new URLSearchParams();
  if (filters?.borrowerId) q.set("borrowerId", filters.borrowerId);
  if (filters?.productCode) q.set("productCode", filters.productCode);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const res = await apiGet<{ ok?: boolean; data?: LoanDraftRow[] }>(`/api/v1/loan-drafts${suffix}`);
  return res.data ?? [];
}

export async function getLoanDraft(draftId: string) {
  if (!apiFeatureFlags.coreWrites) throw new Error("Set VITE_API_URL to load drafts through the API");
  const res = await apiGet<{ ok?: boolean; data?: LoanDraftRow }>(`/api/v1/loan-drafts/${draftId}`);
  if (!res.data) throw new Error("Draft not found");
  return res.data;
}

export async function upsertLoanDraft(borrowerId: string, productCode: string, formData: Record<string, unknown>) {
  if (!apiFeatureFlags.coreWrites) throw new Error("Set VITE_API_URL to save drafts through the API");
  const res = await apiPut<{ ok?: boolean; data?: { id: string; updated_at?: string } }>("/api/v1/loan-drafts", {
    borrowerId,
    productCode,
    formData,
  });
  if (!res.data?.id) throw new Error("Draft was not saved");
  return res.data;
}

export async function deleteLoanDraft(draftId: string) {
  if (!apiFeatureFlags.coreWrites) throw new Error("Set VITE_API_URL to delete drafts through the API");
  return apiDelete<{ ok?: boolean; data?: { id: string } }>(`/api/v1/loan-drafts/${draftId}`);
}
