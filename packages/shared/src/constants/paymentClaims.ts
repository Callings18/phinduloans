/** Statuses meaning "borrower is still waiting on staff" (API + legacy Supabase). */
export const PAYMENT_CLAIM_PENDING_STATUSES = ["pending", "pending_review", "needs_more_info"] as const;

export type PaymentClaimPendingStatus = (typeof PAYMENT_CLAIM_PENDING_STATUSES)[number];

export function isPaymentClaimPendingStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (PAYMENT_CLAIM_PENDING_STATUSES as readonly string[]).includes(status);
}

export function isPaymentClaimApprovedStatus(status: string | null | undefined): boolean {
  return status === "verified" || status === "approved";
}

/** Borrower may open a new claim when none exists or the prior claim was rejected. */
export function canSubmitNewPaymentClaim(status: string | null | undefined): boolean {
  if (!status) return true;
  if (status === "rejected") return true;
  return !isPaymentClaimPendingStatus(status);
}
