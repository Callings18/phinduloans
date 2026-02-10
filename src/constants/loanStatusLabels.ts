/**
 * Canonical loan/application status pipeline.
 * Use these labels for both borrower and admin UI so status matches in real time.
 */
export const LOAN_STATUS_LABELS: Record<string, string> = {
  pending: "Submitted",
  under_review: "Under Review",
  crb_failed: "CRB Failed",
  pmic_pending: "PMIC Pending",
  approved: "Approved",
  contract_signing: "Contract Signing",
  awaiting_disbursement: "Awaiting Disbursement",
  disbursed: "Disbursed",
  active: "Active",
  completed: "Completed",
  rejected: "Rejected",
  defaulted: "Defaulted",
};

export const LOAN_STATUS_ORDER = [
  "pending",
  "under_review",
  "approved",
  "contract_signing",
  "awaiting_disbursement",
  "disbursed",
  "active",
  "completed",
] as const;

export function getCanonicalStatusLabel(status: string): string {
  return LOAN_STATUS_LABELS[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
