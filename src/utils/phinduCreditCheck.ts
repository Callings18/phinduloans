import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceInDays, startOfDay } from "date-fns";

/**
 * Phindu CRB — internal credit-performance check.
 *
 * Scores how a borrower repaid their previous loans and recommends how much
 * they can responsibly receive on a re-loan / top-up, capped at what they
 * requested and gated by their performance score.
 *
 * Factors (per the product decision):
 *  - On-time vs late installment payments
 *  - Days overdue / max delinquency
 *  - Defaults & write-offs (heavy penalty)
 *  - Completed loans & full repayment
 */

export type PhinduRating = "excellent" | "good" | "fair" | "poor" | "new";

export type PhinduDecision = "approve" | "review" | "decline";

export interface PhinduMetrics {
  totalLoans: number;
  completedLoans: number;
  defaultedLoans: number;
  writeOffs: number;
  totalInstallments: number;
  paidInstallments: number;
  onTimePayments: number;
  latePayments: number;
  onTimeRate: number; // 0..1 of paid installments that were on time
  currentlyOverdue: number; // pending installments past due now
  maxDaysLate: number; // worst delinquency (paid late or currently overdue)
  avgDaysLate: number; // average days late across late payments
}

export interface PhinduResult {
  score: number; // 0..100
  rating: PhinduRating;
  decision: PhinduDecision;
  metrics: PhinduMetrics;
  /** Largest principal previously taken (used as the affordability anchor). */
  referencePrincipal: number;
  /** Maximum principal we'd responsibly extend based on performance. */
  eligibleCap: number;
  /** Final recommendation: min(requested, eligibleCap) — null if no request given. */
  recommendedAmount: number | null;
  requestedAmount: number | null;
  reasons: string[];
}

const RATING_MULTIPLIER: Record<PhinduRating, number> = {
  excellent: 1.5,
  good: 1.25,
  fair: 1.0,
  poor: 0.5,
  new: 1.0,
};

export function ratingLabel(rating: PhinduRating): string {
  switch (rating) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
    default:
      return "New borrower";
  }
}

export function scoreToRating(score: number, hasHistory: boolean): PhinduRating {
  if (!hasHistory) return "new";
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "poor";
}

interface LoanRow {
  id: string;
  loan_amount: number | null;
  status: string | null;
}

interface RepaymentRow {
  status: string | null;
  due_date: string | null;
  paid_date: string | null;
  is_reversed: boolean | null;
}

/**
 * Pure scoring function — accepts already-fetched rows so it is easy to test.
 */
export function evaluatePhinduScore(
  loans: LoanRow[],
  repayments: RepaymentRow[],
  writeOffCount: number,
  requestedAmount: number | null,
): PhinduResult {
  const today = startOfDay(new Date());

  const completedLoans = loans.filter((l) => l.status === "completed").length;
  const defaultedLoans = loans.filter((l) => l.status === "defaulted").length;

  const validRepayments = repayments.filter((r) => !r.is_reversed);

  let paidInstallments = 0;
  let onTimePayments = 0;
  let latePayments = 0;
  let currentlyOverdue = 0;
  let maxDaysLate = 0;
  let totalLateDays = 0;

  for (const r of validRepayments) {
    if (!r.due_date) continue;
    const due = startOfDay(new Date(r.due_date));
    if (r.status === "paid") {
      paidInstallments += 1;
      if (r.paid_date) {
        const paid = startOfDay(new Date(r.paid_date));
        const daysLate = differenceInDays(paid, due);
        if (daysLate > 0) {
          latePayments += 1;
          totalLateDays += daysLate;
          if (daysLate > maxDaysLate) maxDaysLate = daysLate;
        } else {
          onTimePayments += 1;
        }
      } else {
        // paid without a recorded date — treat as on time
        onTimePayments += 1;
      }
    } else if (r.status === "pending" || r.status === "overdue") {
      const daysOverdue = differenceInDays(today, due);
      if (daysOverdue > 0) {
        currentlyOverdue += 1;
        if (daysOverdue > maxDaysLate) maxDaysLate = daysOverdue;
      }
    }
  }

  const onTimeRate = paidInstallments > 0 ? onTimePayments / paidInstallments : 0;
  const avgDaysLate = latePayments > 0 ? totalLateDays / latePayments : 0;

  const hasHistory = paidInstallments > 0 || loans.length > 0;

  // ---- Scoring (0..100) ----
  const reasons: string[] = [];
  let score = 100;

  // On-time vs late (up to -45)
  if (paidInstallments > 0) {
    const latePenalty = Math.round((1 - onTimeRate) * 45);
    score -= latePenalty;
    if (latePenalty > 0) {
      reasons.push(
        `${latePayments} of ${paidInstallments} payments were late (${Math.round(onTimeRate * 100)}% on time).`,
      );
    } else {
      reasons.push(`All ${paidInstallments} payments made on time.`);
    }
  } else {
    score -= 10; // unproven repayment behaviour
    reasons.push("No completed installment payments on record yet.");
  }

  // Max delinquency (up to -25)
  if (maxDaysLate > 0) {
    const delinquencyPenalty = Math.min(25, Math.round(maxDaysLate / 2));
    score -= delinquencyPenalty;
    reasons.push(`Worst delinquency: ${maxDaysLate} day(s) past due.`);
  }

  // Currently overdue installments (up to -20)
  if (currentlyOverdue > 0) {
    score -= Math.min(20, currentlyOverdue * 7);
    reasons.push(`${currentlyOverdue} installment(s) currently overdue.`);
  }

  // Defaults & write-offs (heavy)
  if (defaultedLoans > 0) {
    score -= defaultedLoans * 40;
    reasons.push(`${defaultedLoans} previously defaulted loan(s).`);
  }
  if (writeOffCount > 0) {
    score -= writeOffCount * 40;
    reasons.push(`${writeOffCount} written-off loan(s).`);
  }

  // Completed loans reward (up to +15)
  if (completedLoans > 0) {
    const bonus = Math.min(15, completedLoans * 5);
    score += bonus;
    reasons.push(`${completedLoans} loan(s) fully repaid.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const rating = scoreToRating(score, hasHistory);

  // ---- Eligible amount ----
  const referencePrincipal = loans.reduce(
    (max, l) => Math.max(max, Number(l.loan_amount || 0)),
    0,
  );
  const multiplier = RATING_MULTIPLIER[rating];
  // No prior principal to anchor on: fall back to the requested amount.
  const baseAnchor = referencePrincipal > 0 ? referencePrincipal : requestedAmount || 0;
  const eligibleCap = Math.round(baseAnchor * multiplier);

  let decision: PhinduDecision;
  if (rating === "poor" || defaultedLoans > 0 || writeOffCount > 0) {
    decision = "decline";
  } else if (rating === "fair" || rating === "new") {
    decision = "review";
  } else {
    decision = "approve";
  }

  let recommendedAmount: number | null = null;
  if (requestedAmount != null) {
    if (decision === "decline") {
      // Strongly reduce — cap at half of the eligible cap.
      recommendedAmount = Math.round(Math.min(requestedAmount, eligibleCap * 0.5));
    } else {
      recommendedAmount = Math.min(requestedAmount, eligibleCap);
    }
    if (recommendedAmount < requestedAmount) {
      reasons.push(
        `Requested K${requestedAmount.toLocaleString()} exceeds the recommended ceiling — capped at K${recommendedAmount.toLocaleString()}.`,
      );
    }
  }

  return {
    score,
    rating,
    decision,
    metrics: {
      totalLoans: loans.length,
      completedLoans,
      defaultedLoans,
      writeOffs: writeOffCount,
      totalInstallments: validRepayments.length,
      paidInstallments,
      onTimePayments,
      latePayments,
      onTimeRate,
      currentlyOverdue,
      maxDaysLate,
      avgDaysLate,
    },
    referencePrincipal,
    eligibleCap,
    recommendedAmount,
    requestedAmount,
    reasons,
  };
}

/**
 * Fetches a borrower's loan history and computes the Phindu CRB result.
 * Optionally excludes a loan id (e.g. the current open re-loan being created).
 */
export async function fetchPhinduCreditCheck(
  supabase: SupabaseClient,
  params: {
    userId: string;
    requestedAmount?: number | null;
    excludeLoanId?: string | null;
  },
): Promise<PhinduResult> {
  const { userId, requestedAmount = null, excludeLoanId = null } = params;

  let loanQuery = supabase
    .from("loan_applications")
    .select("id, loan_amount, status")
    .eq("user_id", userId);
  if (excludeLoanId) loanQuery = loanQuery.neq("id", excludeLoanId);

  const { data: loans, error: loanErr } = await loanQuery;
  if (loanErr) throw loanErr;

  const loanRows = (loans || []) as LoanRow[];
  const loanIds = loanRows.map((l) => l.id);

  let repaymentRows: RepaymentRow[] = [];
  let writeOffCount = 0;

  if (loanIds.length > 0) {
    const [{ data: reps, error: repErr }, { count: woCount, error: woErr }] =
      await Promise.all([
        supabase
          .from("loan_repayments")
          .select("status, due_date, paid_date, is_reversed")
          .in("loan_id", loanIds),
        supabase
          .from("loan_writeoffs")
          .select("id", { count: "exact", head: true })
          .in("loan_id", loanIds),
      ]);
    if (repErr) throw repErr;
    if (woErr) throw woErr;
    repaymentRows = (reps || []) as RepaymentRow[];
    writeOffCount = woCount ?? 0;
  }

  return evaluatePhinduScore(loanRows, repaymentRows, writeOffCount, requestedAmount);
}
