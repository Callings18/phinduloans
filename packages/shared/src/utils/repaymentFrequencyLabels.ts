export type TermUnit = "days" | "weeks" | "months" | "years" | string;

export interface LoanLikeForFrequency {
  term_unit?: string | null;
  loan_term_months?: number | null;
  repayment_frequency?: string | null;
  interest_period?: string | null;
}

/** Short suffix for loan cards, e.g. "12 wk" / "6 mo". */
export function borrowerTermShortLabel(loan: LoanLikeForFrequency): string {
  const unit = (loan.term_unit || "months").toLowerCase();
  const n = loan.loan_term_months ?? 0;
  if (unit === "days") return `${n} day${n === 1 ? "" : "s"}`;
  if (unit === "weeks") return `${n} wk`;
  if (unit === "years") return `${n} yr`;
  return `${n} mo`;
}

/** Human label for installment row / table headers. */
export function borrowerInstallmentLabel(loan: LoanLikeForFrequency): string {
  const rf = (loan.repayment_frequency || "").toLowerCase();
  if (rf === "bullet") return "Single payment";
  const unit = (loan.term_unit || "months").toLowerCase();
  if (unit === "days") return "Daily installment";
  if (unit === "weeks") return "Weekly installment";
  return "Monthly installment";
}

/** Value passed to PDF / statements as interest cadence text. */
export function borrowerInterestPeriodLabel(loan: LoanLikeForFrequency): string {
  const rf = (loan.repayment_frequency || "").toLowerCase();
  if (rf === "bullet") return "per loan";
  if (rf === "daily" || rf === "day") return "daily";
  if (rf === "weekly" || rf === "week") return "weekly";
  const unit = (loan.term_unit || "months").toLowerCase();
  if (unit === "days") return "daily";
  if (unit === "weeks") return "weekly";
  const ip = (loan.interest_period || "").toLowerCase();
  if (ip.includes("day")) return "daily";
  if (ip.includes("week")) return "weekly";
  return "monthly";
}

/** PDF summary line for term length, e.g. "12 weeks". */
export function borrowerTermSummaryLabel(loan: LoanLikeForFrequency): string {
  const unit = (loan.term_unit || "months").toLowerCase();
  const n = loan.loan_term_months ?? 0;
  if (unit === "days") return `${n} days`;
  if (unit === "weeks") return `${n} weeks`;
  if (unit === "years") return `${n} years`;
  return `${n} months`;
}

/** PDF column title above periodic payment amount. */
export function borrowerSchedulePaymentColumnTitle(loan: LoanLikeForFrequency): string {
  const rf = (loan.repayment_frequency || "").toLowerCase();
  if (rf === "bullet") return "SINGLE PAYMENT";
  const unit = (loan.term_unit || "months").toLowerCase();
  if (unit === "days") return "DAILY PAYMENT";
  if (unit === "weeks") return "WEEKLY PAYMENT";
  return "MONTHLY PAYMENT";
}
