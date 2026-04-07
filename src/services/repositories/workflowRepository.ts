import { apiGet } from "@/api/httpClient";
import { supabase } from "@/integrations/supabase/client";

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
  fallbackData?: { loanId: string; userId: string },
) {
  if (fallbackData) {
    const { data, error } = await supabase.from("payment_claims").insert({
      repayment_id: repaymentId,
      loan_id: fallbackData.loanId,
      user_id: fallbackData.userId,
      amount: payload.amount,
      reference: payload.reference,
      receipt_url: payload.receiptUrl ?? null,
      status: "pending",
    }).select().single();
    if (error) throw error;
    return data;
  }
  throw new Error("Workflow API mode is not available. Provide fallbackData.");
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
  const { error } = await supabase.from("loan_status_transitions").insert({
    loan_id: input.loanId,
    from_status: "",
    to_status: input.toStatus,
    actor_type: "admin",
    actor_id: (await supabase.auth.getUser()).data.user?.id,
    reason_code: input.reasonCode ?? null,
    reason_text: input.reasonText ?? null,
  });
  if (error) throw error;
}
