import { HttpError } from "@/lib/http-errors";

export type LoanStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "contract_signing"
  | "awaiting_disbursement"
  | "disbursed"
  | "active"
  | "completed"
  | "defaulted"
  | "rejected";

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

export function assertValidTransition(fromStatus: string, toStatus: string) {
  const from = fromStatus as LoanStatus;
  const to = toStatus as LoanStatus;
  const allowed = allowedTransitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw new HttpError(409, "INVALID_TRANSITION", `Cannot move from ${fromStatus} to ${toStatus}`, {
      fromStatus,
      toStatus,
      allowedNextStatuses: allowed,
    });
  }
}
