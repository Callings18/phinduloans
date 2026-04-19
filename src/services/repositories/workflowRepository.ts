import { supabase } from "@/integrations/supabase/client";
import { apiGet, apiPost, getApiBaseUrl } from "@/api/httpClient";
import { apiFeatureFlags } from "@/config/apiMode";
import { repaymentRemainingKwacha } from "@/utils/repaymentRemaining";

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

function assertRpcOk(data: unknown) {
  if (data == null) return;
  if (typeof data === "object" && data !== null && "ok" in data) {
    const result = data as { ok?: boolean; error?: string };
    if (result.ok === false) {
      throw new Error(result.error || "Transition failed");
    }
  }
}

export async function submitPaymentClaim(
  repaymentId: string,
  payload: PaymentClaimInput,
  fallbackData?: { loanId: string; userId: string },
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

  if (fallbackData) {
    const { data: repRow, error: repFetchErr } = await supabase
      .from("loan_repayments")
      .select("amount, original_amount, principal_paid")
      .eq("id", repaymentId)
      .single();
    if (repFetchErr || !repRow) throw new Error("Repayment not found");
    const maxRemaining = repaymentRemainingKwacha(repRow);
    const amt = Math.round(payload.amount * 100) / 100;
    if (amt > maxRemaining + 0.009) {
      throw new Error(
        `Claim amount cannot exceed the remaining installment balance (K${maxRemaining.toLocaleString()}).`,
      );
    }

    const { data, error } = await supabase
      .from("payment_claims")
      .insert({
        repayment_id: repaymentId,
        loan_id: fallbackData.loanId,
        user_id: fallbackData.userId,
        amount: payload.amount,
        reference: payload.reference,
        receipt_url: payload.receiptUrl ?? null,
        // Match apps/api-next POST so admin queues and borrower UI stay aligned
        status: "pending_review",
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  throw new Error(
    `Payment claims: set VITE_API_PHASE1_WORKFLOW=true and VITE_API_URL (API base is ${getApiBaseUrl()}), or set VITE_API_PHASE1_WORKFLOW=false for direct Supabase inserts.`,
  );
}

/** Borrower-visible payment claims (same table whether created via API or Supabase). */
export async function fetchBorrowerPaymentClaims(userId: string) {
  const { data, error } = await supabase
    .from("payment_claims")
    .select("id, repayment_id, amount, reference, status, created_at, verified_at")
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

  const { error } = await supabase
    .from("payment_claims")
    .update({
      status: input.decision,
      review_comment: input.reviewComment ?? null,
      decision_reason_code: input.decisionReasonCode ?? null,
    })
    .eq("id", input.claimId);
  if (error) throw error;
}

export async function transitionLoanStatus(input: {
  loanId: string;
  toStatus: string;
  reasonCode?: string;
  reasonText?: string;
}) {
  if (apiFeatureFlags.phase1Workflow) {
    const res = await apiPost<{ ok?: boolean; error?: { message?: string } }>(
      `/api/v1/loans/${input.loanId}/transitions`,
      {
        toStatus: input.toStatus,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
      },
    );
    if (res && typeof res === "object" && "ok" in res && res.ok === false) {
      throw new Error(res.error?.message ?? "Loan transition failed");
    }
    return;
  }

  if (input.toStatus === "disbursed") {
    const { data, error } = await supabase.rpc("transition_loan_status", {
      p_loan_id: input.loanId,
      p_action: "disburse",
      p_reason: input.reasonText ?? null,
    });
    if (error) throw error;
    assertRpcOk(data);
    return;
  }

  if (input.toStatus === "under_review") {
    const { data: sessionData } = await supabase.auth.getUser();
    const uid = sessionData.user?.id ?? null;
    const { error } = await supabase
      .from("loan_applications")
      .update({
        status: "under_review",
        reviewed_by: uid,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", input.loanId);
    if (error) throw error;
    return;
  }

  throw new Error(
    `transitionLoanStatus: cannot move to "${input.toStatus}" without API workflow (set VITE_API_PHASE1_WORKFLOW=true and VITE_API_URL).`,
  );
}
