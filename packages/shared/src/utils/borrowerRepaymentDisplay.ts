import { differenceInDays, isAfter, startOfDay } from "date-fns";
import { repaymentRemainingKwacha } from "./repaymentRemaining";

export type BorrowerRepaymentRow = {
  id?: string;
  due_date: string;
  status?: string | null;
  amount?: number | string | null;
  original_amount?: number | string | null;
  principal_paid?: number | string | null;
  penalty_amount?: number | string | null;
  penalty_paid?: number | string | null;
};

export function borrowerRepaymentPenaltyDue(rep: BorrowerRepaymentRow): number {
  const penalty = Number(rep.penalty_amount ?? 0);
  const paid = Number(rep.penalty_paid ?? 0);
  return Math.max(0, Math.round((penalty - paid) * 100) / 100);
}

export function borrowerRepaymentRemaining(rep: BorrowerRepaymentRow): number {
  return repaymentRemainingKwacha(rep);
}

/** Principal + unpaid penalty still due on this installment. */
export function borrowerRepaymentTotalDue(rep: BorrowerRepaymentRow): number {
  return Math.round((borrowerRepaymentRemaining(rep) + borrowerRepaymentPenaltyDue(rep)) * 100) / 100;
}

export function borrowerCanSubmitPaymentClaim(rep: BorrowerRepaymentRow): boolean {
  const status = (rep.status || "").toLowerCase();
  if (status === "paid" || status === "cancelled") return false;
  return borrowerRepaymentRemaining(rep) > 0;
}

export function borrowerRepaymentStatusDisplay(rep: BorrowerRepaymentRow): {
  label: string;
  color: string;
  isOverdue: boolean;
} {
  const today = startOfDay(new Date());
  const dueDate = startOfDay(new Date(rep.due_date));
  const status = (rep.status || "").toLowerCase();
  const remaining = borrowerRepaymentRemaining(rep);
  const isOverdue =
    ["pending", "overdue", "partial"].includes(status) && isAfter(today, dueDate) && remaining > 0;
  const daysOverdue = isOverdue ? differenceInDays(today, dueDate) : 0;

  if (status === "paid") {
    return { label: "Paid", color: "bg-success/20 text-success border-success/30", isOverdue: false };
  }
  if (status === "cancelled") {
    return { label: "Cancelled", color: "bg-muted/20 text-muted-foreground border-muted/30", isOverdue: false };
  }
  if (status === "partial" && remaining > 0) {
    if (isOverdue) {
      return {
        label: `Partial · ${daysOverdue}d overdue`,
        color: "bg-destructive/20 text-destructive border-destructive/30",
        isOverdue: true,
      };
    }
    return {
      label: `Partial · K${remaining.toLocaleString()} left`,
      color: "bg-warning/20 text-warning border-warning/30",
      isOverdue: false,
    };
  }
  if (isOverdue || status === "overdue") {
    return {
      label: `${daysOverdue}d overdue`,
      color: "bg-destructive/20 text-destructive border-destructive/30",
      isOverdue: true,
    };
  }
  return { label: "Pending", color: "bg-warning/20 text-warning border-warning/30", isOverdue: false };
}

export function borrowerRepaymentIsActionable(rep: BorrowerRepaymentRow): boolean {
  const status = (rep.status || "").toLowerCase();
  return ["pending", "overdue", "partial"].includes(status) && borrowerCanSubmitPaymentClaim(rep);
}
