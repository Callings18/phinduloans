import { HttpStatus } from "@nestjs/common";
import { apiFail } from "../common/http";

export const LOAN_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "contract_signing",
  "awaiting_disbursement",
  "disbursed",
  "active",
  "completed",
  "defaulted",
  "rejected",
] as const;

export type LoanStatus = (typeof LOAN_STATUSES)[number];

const allowedTransitions: Record<LoanStatus, LoanStatus[]> = {
  pending: ["under_review", "rejected"],
  under_review: ["approved", "rejected"],
  approved: ["contract_signing"],
  contract_signing: ["awaiting_disbursement", "rejected"],
  awaiting_disbursement: ["disbursed", "rejected"],
  disbursed: ["active"],
  active: ["completed", "defaulted"],
  completed: [],
  defaulted: [],
  rejected: [],
};

export function assertValidTransition(fromStatus: string, toStatus: string): void {
  const from = fromStatus as LoanStatus;
  const to = toStatus as LoanStatus;
  const allowed = allowedTransitions[from] ?? [];
  if (!allowed.includes(to)) {
    apiFail(HttpStatus.CONFLICT, "INVALID_TRANSITION", `Cannot move from ${fromStatus} to ${toStatus}`, {
      fromStatus,
      toStatus,
      allowedNextStatuses: allowed,
    });
  }
}
