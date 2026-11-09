type RepaymentOutstandingInput = {
  amount?: number | string | null;
  original_amount?: number | string | null;
  principal_paid?: number | string | null;
  penalty_amount?: number | string | null;
  penalty_paid?: number | string | null;
};

/** Remaining amount due on one schedule row, including unpaid penalties. */
export function getRepaymentOutstandingAmount(repayment: RepaymentOutstandingInput) {
  const scheduledAmount = Number(repayment.original_amount ?? repayment.amount ?? 0);
  const principalOutstanding = Math.max(0, scheduledAmount - Number(repayment.principal_paid || 0));
  const penaltyOutstanding = Math.max(0, Number(repayment.penalty_amount || 0) - Number(repayment.penalty_paid || 0));
  return principalOutstanding + penaltyOutstanding;
}
