/**
 * Canonical loan/application status pipeline.
 *
 * Single source of truth for status labels and badge styling shared between
 * borrower-facing screens (dashboard) and admin screens (applications, loans,
 * disbursements). Use `getCanonicalStatusLabel(status)` everywhere instead of
 * ad-hoc maps so wording stays in lock-step.
 */
export const LOAN_STATUS_LABELS: Record<string, string> = {
  pending: "Submitted",
  under_review: "Under Review",
  crb_failed: "CRB Failed",
  pmic_pending: "PMIC Pending",
  approved: "Approved",
  awaiting_disbursement: "Awaiting Disbursement",
  contract_signing: "Contract Signing",
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

/**
 * Semantic Tailwind class set for status badges. Uses design-system tokens
 * (success, warning, info, primary, accent, destructive, muted) so badges
 * automatically follow theme + light/dark mode.
 */
export const LOAN_STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: "bg-warning/20 text-warning border-warning/30",
  under_review: "bg-info/20 text-info border-info/30",
  crb_failed: "bg-destructive/20 text-destructive border-destructive/30",
  pmic_pending: "bg-warning/20 text-warning border-warning/30",
  approved: "bg-success/20 text-success border-success/30",
  contract_signing: "bg-accent/20 text-accent border-accent/30",
  awaiting_disbursement: "bg-primary/20 text-primary border-primary/30",
  disbursed: "bg-primary/20 text-primary border-primary/30",
  active: "bg-success/20 text-success border-success/30",
  completed: "bg-muted/50 text-muted-foreground border-border",
  rejected: "bg-destructive/20 text-destructive border-destructive/30",
  defaulted: "bg-destructive/20 text-destructive border-destructive/30",
};

export function getCanonicalStatusBadgeClasses(status: string): string {
  return LOAN_STATUS_BADGE_CLASSES[status] ?? "bg-muted/30 text-muted-foreground border-border";
}
