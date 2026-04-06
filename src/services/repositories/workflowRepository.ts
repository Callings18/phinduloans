import { apiGet, apiPost } from "@/api/httpClient";
import { apiFeatureFlags } from "@/config/apiMode";

export interface LoanEvent {
  id: string;
  loan_id: string;
  event_type: string;
  reason: string | null;
  created_at: string;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
}

export interface PaymentClaimInput {
  amount: number;
  reference: string;
  receiptUrl?: string | null;
}

function assertWorkflowApiEnabled() {
  if (!apiFeatureFlags.phase1Workflow) {
    throw new Error("Workflow API mode is required for this operation. Enable VITE_API_PHASE1_WORKFLOW.");
  }
}

export async function submitPaymentClaim(
  repaymentId: string,
  payload: PaymentClaimInput,
  fallbackData?: { loanId: string; userId: string },
) {
  void fallbackData;
  assertWorkflowApiEnabled();
  const res = await apiPost<{ ok: true; data: unknown }>(`/api/v1/repayments/${repaymentId}/payment-claims`, payload);
  return res.data;
}

export async function fetchBorrowerLoanEvents(loanId: string): Promise<LoanEvent[]> {
  assertWorkflowApiEnabled();
  const res = await apiGet<{ ok: true; data: LoanEvent[] }>(`/api/v1/loans/${loanId}/events?scope=borrower`);
  return res.data ?? [];
}

export async function fetchAdminPaymentClaims(status = "pending_review") {
  assertWorkflowApiEnabled();
  const res = await apiGet<{ ok: true; data: any[] }>(`/api/v1/admin/payment-claims?status=${encodeURIComponent(status)}`);
  return res.data ?? [];
}

export async function reviewPaymentClaim(input: {
  claimId: string;
  decision: "approved" | "rejected" | "needs_more_info";
  reviewComment?: string;
  decisionReasonCode?: string;
}) {
  assertWorkflowApiEnabled();
  return apiPost(`/api/v1/payment-claims/${input.claimId}/review`, input, {
    headers: { "Idempotency-Key": `${input.claimId}:${input.decision}` },
  });
}

export async function transitionLoanStatus(input: {
  loanId: string;
  toStatus: string;
  reasonCode?: string;
  reasonText?: string;
}) {
  assertWorkflowApiEnabled();
  return apiPost(`/api/v1/loans/${input.loanId}/transitions`, input);
}
