import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { apiGet, apiPost } from "@phinduloans/shared/api/httpClient";
import { apiFeatureFlags } from "@phinduloans/shared/config/apiMode";

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

export async function submitPaymentClaim(
  repaymentId: string,
  payload: PaymentClaimInput,
  _fallbackData?: { loanId: string; userId: string },
) {
  if (apiFeatureFlags.phase1Workflow) {
    const res = await apiPost<{
      ok?: boolean;
      data?: unknown;
      error?: string | { message?: string; code?: string };
      message?: string;
    }>(`/api/v1/repayments/${repaymentId}/payment-claims`, {
      amount: payload.amount,
      reference: payload.reference,
      receiptUrl: payload.receiptUrl ?? null,
    });
    if (res && typeof res === "object" && "ok" in res && res.ok === false) {
      const errPart = res.error;
      const msg =
        typeof errPart === "string"
          ? errPart
          : errPart && typeof errPart === "object"
            ? errPart.message || errPart.code
            : res.message;
      throw new Error(msg || "Failed to submit payment claim");
    }
    return (res as { data?: unknown })?.data;
  }

  throw new Error("Set VITE_API_URL so payment claims go through Nest");
}

/** Borrower-visible payment claims (same table whether created via API or Supabase). */
export async function fetchBorrowerPaymentClaims(userId: string) {
  const { data, error } = await supabase
    .from("payment_claims")
    .select("id, repayment_id, amount, reference, status, created_at, verified_at, review_comment, decision_reason_code")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchBorrowerLoanEvents(loanId: string): Promise<LoanEvent[]> {
  const { data, error } = await supabase
    .from("loan_events")
    .select("*")
    .eq("loan_id", loanId)
    .in("visibility", ["borrower", "both"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as LoanEvent[]) ?? [];
}

export async function fetchAdminPaymentClaims(status = "pending_review") {
  if (apiFeatureFlags.phase1Workflow) {
    const res = await apiGet<{ ok?: boolean; data?: unknown[] }>(
      `/api/v1/admin/payment-claims?status=${encodeURIComponent(status)}`,
    );
    return (res?.data ?? []) as Record<string, unknown>[];
  }

  const { data, error } = await supabase
    .from("payment_claims")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function reviewPaymentClaim(input: {
  claimId: string;
  decision: "approved" | "rejected" | "needs_more_info";
  reviewComment?: string;
  decisionReasonCode?: string;
}) {
  if (apiFeatureFlags.phase1Workflow) {
    const res = await apiPost<{ ok?: boolean }>(`/api/v1/payment-claims/${input.claimId}/review`, {
      decision: input.decision,
      reviewComment: input.reviewComment ?? null,
      decisionReasonCode: input.decisionReasonCode ?? null,
    });
    if (res && typeof res === "object" && "ok" in res && res.ok === false) {
      throw new Error("Failed to review payment claim");
    }
    return;
  }

  // Safety: claim review should go through API workflow to avoid direct-write divergence
  // from canonical repayment posting and audit side-effects.
  throw new Error(
    "Payment claim review requires API workflow. Enable VITE_API_PHASE1_WORKFLOW=true and VITE_API_URL.",
  );
}

export async function transitionLoanStatus(input: {
  loanId: string;
  toStatus: string;
  reasonCode?: string;
  reasonText?: string;
}) {
  if (input.toStatus === "under_review") {
    if (apiFeatureFlags.phase1Workflow) {
      const res = await apiPost<{ ok?: boolean; error?: { message?: string } }>(
        `/api/v1/loans/${input.loanId}/transitions`,
        {
          toStatus: "under_review",
          reasonCode: input.reasonCode,
          reasonText: input.reasonText,
        },
      );
      if (res && typeof res === "object" && "ok" in res && res.ok === false) {
        throw new Error(res.error?.message ?? "Loan transition failed");
      }
      return;
    }
    throw new Error("Set VITE_API_URL to move loans to under review through the API");
  }

  const actionMap: Record<string, string> = {
    approved: "approve",
    rejected: "reject",
    disbursed: "disburse",
    active: "activate",
    completed: "complete",
    defaulted: "default",
  };
  const action = actionMap[input.toStatus];
  if (!action) {
    throw new Error(`transitionLoanStatus: unknown target "${input.toStatus}"`);
  }
  await transitionLoanByAction(input.loanId, action, input.reasonText);
}

export async function transitionLoanByAction(loanId: string, action: string, reason?: string | null) {
  if (apiFeatureFlags.phase1Workflow) {
    const res = await apiPost<{ ok?: boolean; error?: { message?: string } }>(
      `/api/v1/loans/${loanId}/transitions`,
      { action, reasonText: reason ?? undefined },
    );
    if (res && typeof res === "object" && "ok" in res && res.ok === false) {
      throw new Error(res.error?.message ?? "Loan transition failed");
    }
    return;
  }

  throw new Error("Set VITE_API_URL so loan transitions go through Nest");
}

export async function completeDisbursement(params: {
  disbursementId: string;
  accountId: string;
  transactionReference?: string | null;
}) {
  if (apiFeatureFlags.phase1Workflow) {
    const res = await apiPost<{ ok?: boolean; error?: { message?: string } }>(
      `/api/v1/disbursements/${params.disbursementId}/complete`,
      {
        accountId: params.accountId,
        transactionReference: params.transactionReference ?? null,
      },
    );
    if (res && typeof res === "object" && "ok" in res && res.ok === false) {
      throw new Error(res.error?.message ?? "Disbursement completion failed");
    }
    return;
  }

  throw new Error("Set VITE_API_URL so disbursement completion goes through Nest");
}

export async function disburseLoan(params: {
  loanId: string;
  accountId: string;
  amount: number;
  disbursementMethod: string;
  accountNumber?: string | null;
  mobileMoneyNumber?: string | null;
  transactionReference?: string | null;
}) {
  if (apiFeatureFlags.phase1Workflow) {
    const res = await apiPost<{ ok?: boolean; error?: { message?: string } }>(
      `/api/v1/loans/${params.loanId}/disburse`,
      {
        accountId: params.accountId,
        amount: params.amount,
        disbursementMethod: params.disbursementMethod,
        accountNumber: params.accountNumber ?? null,
        mobileMoneyNumber: params.mobileMoneyNumber ?? null,
        transactionReference: params.transactionReference ?? null,
      },
    );
    if (res && typeof res === "object" && "ok" in res && res.ok === false) {
      throw new Error(res.error?.message ?? "Disbursement failed");
    }
    return;
  }

  throw new Error("Set VITE_API_URL so disbursements go through Nest");
}
