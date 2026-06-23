const OPEN_REPAYMENT_STATUSES = new Set(["pending", "overdue", "partial"]);
const CLOSED_LOAN_STATUSES = new Set(["completed", "settled", "closed"]);

export type RepaymentBalanceLike = {
  amount?: number | string | null;
  original_amount?: number | string | null;
  principal_paid?: number | string | null;
  penalty_amount?: number | string | null;
  penalty_paid?: number | string | null;
  status?: string | null;
  is_reversed?: boolean | null;
};

export type LoanBalanceLike = {
  loan_amount?: number | string | null;
  total_repayment?: number | string | null;
  status?: string | null;
  settlement_date?: string | null;
  settlement_type?: string | null;
};

export const money = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export const repaymentBaseAmount = (repayment: RepaymentBalanceLike) =>
  Number(repayment.original_amount ?? repayment.amount ?? 0);

export const repaymentPaidAmount = (repayment: RepaymentBalanceLike) => {
  const explicitPaid = Number(repayment.principal_paid || 0);
  if (explicitPaid > 0) return explicitPaid;
  if (repayment.status === "paid") return repaymentBaseAmount(repayment);
  return 0;
};

export const repaymentOpenPrincipal = (repayment: RepaymentBalanceLike) => {
  if (!OPEN_REPAYMENT_STATUSES.has(repayment.status || "")) return 0;
  return Math.max(0, repaymentBaseAmount(repayment) - Number(repayment.principal_paid || 0));
};

export const repaymentPenaltyOutstanding = (repayment: RepaymentBalanceLike) => {
  if (!OPEN_REPAYMENT_STATUSES.has(repayment.status || "")) return 0;
  return Math.max(0, Number(repayment.penalty_amount || 0) - Number(repayment.penalty_paid || 0));
};

export function calculateLoanBalanceSnapshot(loan: LoanBalanceLike, repayments: RepaymentBalanceLike[] = []) {
  const liveRepayments = repayments.filter((repayment) => !repayment.is_reversed);
  const principalAmount = Number(loan.loan_amount || 0);
  const totalRepayment = Number(loan.total_repayment || principalAmount);
  const totalInterestDue = Math.max(0, totalRepayment - principalAmount);
  const totalPaid = money(liveRepayments.reduce((sum, repayment) => sum + repaymentPaidAmount(repayment), 0));
  const totalPenalties = money(liveRepayments.reduce((sum, repayment) => sum + repaymentPenaltyOutstanding(repayment), 0));
  const schedulePrincipalOutstanding = money(
    liveRepayments.reduce((sum, repayment) => sum + repaymentOpenPrincipal(repayment), 0),
  );
  const closedByStatus = CLOSED_LOAN_STATUSES.has(loan.status || "");
  const closedBySettlement = Boolean(loan.settlement_date || loan.settlement_type === "early");
  const fullyPaidByLifecycle = totalPaid >= totalRepayment - 0.01 && schedulePrincipalOutstanding <= 0.01;
  const isClosedAndClear = (closedByStatus || closedBySettlement || fullyPaidByLifecycle) && totalPenalties <= 0.01;

  if (isClosedAndClear) {
    return {
      principalAmount: money(principalAmount),
      totalRepayment: money(totalRepayment),
      totalInterestDue: money(totalInterestDue),
      totalPaid,
      totalPenalties,
      schedulePrincipalOutstanding: 0,
      lifecycleOutstanding: 0,
      interestPaidSoFar: money(Math.min(totalInterestDue, totalPaid)),
      interestCarriedForward: 0,
      reloanCarryForwardPrincipal: 0,
      isClosedAndClear: true,
    };
  }

  // Business rule: old-loan interest is never carried into a reloan principal.
  // Payments satisfy booked interest first; only remaining principal can carry forward.
  const principalPaidAfterInterest = Math.max(0, totalPaid - totalInterestDue);
  const reloanCarryForwardPrincipal = money(Math.max(0, principalAmount - principalPaidAfterInterest));

  return {
    principalAmount: money(principalAmount),
    totalRepayment: money(totalRepayment),
    totalInterestDue: money(totalInterestDue),
    totalPaid,
    totalPenalties,
    schedulePrincipalOutstanding,
    lifecycleOutstanding: money(Math.max(0, totalRepayment - totalPaid)),
    interestPaidSoFar: money(Math.min(totalInterestDue, totalPaid)),
    interestCarriedForward: 0,
    reloanCarryForwardPrincipal,
    isClosedAndClear: false,
  };
}