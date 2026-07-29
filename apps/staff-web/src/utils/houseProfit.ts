import { format, startOfMonth, subMonths } from "date-fns";

export interface ProfitLoanInput {
  id: string;
  loan_amount?: number | null;
  total_repayment?: number | null;
  status?: string | null;
  created_at?: string | null;
  disbursed_at?: string | null;
}

export interface ProfitRepaymentInput {
  loan_id?: string | null;
  status?: string | null;
  amount?: number | null;
  due_date?: string | null;
  paid_date?: string | null;
  is_reversed?: boolean | null;
  principal_paid?: number | null;
  interest_paid?: number | null;
  penalty_paid?: number | null;
}

export interface ProfitExpenseInput {
  loan_id?: string | null;
  amount?: number | null;
  expense_date?: string | null;
  status?: string | null;
}

export interface MonthlyProfitRow {
  monthKey: string; // yyyy-MM
  label: string; // e.g. "May 26"
  expectedInterest: number;
  interestMade: number;
  expenses: number;
  netProfit: number; // interestMade - expenses
}

export interface MonthlyProfitResult {
  rows: MonthlyProfitRow[];
  totals: {
    expectedInterest: number;
    interestMade: number;
    expenses: number;
    netProfit: number;
    collected: number; // total paid amount (principal + interest) in range
  };
  hasData: boolean;
}

export interface ProfitPeriodOptions {
  /** Inclusive start of the reporting window. When omitted it is derived from data (all-time). */
  from?: Date | null;
  /** Inclusive end of the reporting window. Defaults to now. */
  to?: Date | null;
  /** Legacy: number of months to look back from `to`. Used only when `from` is not provided. */
  monthsBack?: number;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Amount actually paid toward the loan (principal + interest) for a repayment.
 * - "paid" installments: the full `amount` was settled.
 * - "partial" installments: only `principal_paid + interest_paid` came in, so the
 *   full installment `amount` would overstate what was really collected.
 * Penalties are excluded — they are not part of loan principal/interest.
 */
function paidTowardLoan(rep: ProfitRepaymentInput): number {
  if (rep.status === "partial") {
    const paid = num(rep.principal_paid) + num(rep.interest_paid);
    return paid > 0 ? paid : num(rep.amount);
  }
  return num(rep.amount);
}

// Hard cap so an "all time" window never explodes the chart axis.
const MAX_MONTHS = 120;

/**
 * Interest baked into a loan as a fraction of the total repayable amount.
 * interestRatio = (total_repayment - loan_amount) / total_repayment
 * Each installment carries a proportional slice of that interest.
 */
function interestRatioFor(loan: ProfitLoanInput | undefined): number {
  if (!loan) return 0;
  const total = num(loan.total_repayment);
  const principal = num(loan.loan_amount);
  if (total <= 0 || total <= principal) return 0;
  return (total - principal) / total;
}

function bookedInterestFor(loan: ProfitLoanInput | undefined): number {
  if (!loan) return 0;
  return Math.max(0, num(loan.total_repayment) - num(loan.loan_amount));
}

function loanExpectedDate(loan: ProfitLoanInput): string | null {
  return loan.disbursed_at || loan.created_at || null;
}

function countsAsBookedLoan(loan: ProfitLoanInput): boolean {
  return ["active", "disbursed", "completed", "defaulted"].includes(loan.status || "");
}

function normalizeOptions(
  options: number | ProfitPeriodOptions | undefined,
): ProfitPeriodOptions {
  if (typeof options === "number") return { monthsBack: options };
  return options ?? {};
}

/** Earliest yyyy-MM appearing in the data, or null when there is nothing. */
function earliestMonthKey(
  loans: ProfitLoanInput[],
  repayments: ProfitRepaymentInput[],
  expenses: ProfitExpenseInput[],
): string | null {
  let earliest: string | null = null;
  const consider = (d?: string | null) => {
    if (!d) return;
    const key = d.slice(0, 7);
    if (!earliest || key < earliest) earliest = key;
  };
  for (const loan of loans) consider(loanExpectedDate(loan));
  for (const r of repayments) {
    consider(r.due_date);
    consider(r.paid_date);
  }
  for (const e of expenses) consider(e.expense_date);
  return earliest;
}

/**
 * Compute month-by-month profit for one or many loan houses.
 * - Expected interest is counted once, in the month a booked loan starts/disburses.
 * - Interest made is counted in the month an installment was PAID.
 * - Expenses (tied to the house's loans) are counted by expense_date month.
 * - Net profit (made) = interest made - expenses.
 *
 * The reporting window is controlled via `options`:
 * - `{ from, to }` for an explicit sub-period (presets / custom range),
 * - `{ monthsBack }` (or a bare number) for a trailing window,
 * - omitted `from` falls back to the earliest data month (all-time).
 */
export function computeMonthlyProfit(
  loans: ProfitLoanInput[] = [],
  repayments: ProfitRepaymentInput[] = [],
  expenses: ProfitExpenseInput[] = [],
  options: number | ProfitPeriodOptions = 12,
): MonthlyProfitResult {
  const opts = normalizeOptions(options);
  const ratioByLoan = new Map<string, number>();
  for (const loan of loans) {
    if (loan?.id) ratioByLoan.set(loan.id, interestRatioFor(loan));
  }

  const to = startOfMonth(opts.to ?? new Date());
  let from: Date;
  if (opts.from) {
    from = startOfMonth(opts.from);
  } else if (typeof opts.monthsBack === "number") {
    from = startOfMonth(subMonths(to, Math.max(0, opts.monthsBack - 1)));
  } else {
    const earliest = earliestMonthKey(loans, repayments, expenses);
    from = earliest ? startOfMonth(new Date(`${earliest}-01T00:00:00`)) : startOfMonth(subMonths(to, 11));
  }
  if (from > to) from = to;

  const fromKey = format(from, "yyyy-MM");
  const toKey = format(to, "yyyy-MM");

  // Seed every month in the window so the chart has a continuous axis.
  const order: string[] = [];
  const bucket = new Map<string, MonthlyProfitRow>();
  let cursor = from;
  while (format(cursor, "yyyy-MM") <= toKey && order.length < MAX_MONTHS) {
    const key = format(cursor, "yyyy-MM");
    order.push(key);
    bucket.set(key, {
      monthKey: key,
      label: format(cursor, "MMM yy"),
      expectedInterest: 0,
      interestMade: 0,
      expenses: 0,
      netProfit: 0,
    });
    cursor = startOfMonth(subMonths(cursor, -1));
  }

  const inRange = (key: string) => key >= fromKey && key <= toKey;
  const ensure = (key: string): MonthlyProfitRow | null => bucket.get(key) ?? null;

  let collected = 0;

  for (const loan of loans) {
    if (!countsAsBookedLoan(loan)) continue;
    const key = loanExpectedDate(loan)?.slice(0, 7);
    if (!key) continue;
    const row = ensure(key);
    if (row) row.expectedInterest += bookedInterestFor(loan);
  }

  for (const rep of repayments) {
    if (rep?.is_reversed) continue;
    if (rep?.status === "cancelled") continue;
    const ratio = rep?.loan_id ? ratioByLoan.get(rep.loan_id) ?? 0 : 0;
    const amount = num(rep.amount);

    // Interest made -> paid month (paid + partial), based on what was actually paid
    const isPaid = rep.status === "paid" || rep.status === "partial";
    if (isPaid && rep.paid_date) {
      const key = rep.paid_date.slice(0, 7);
      const paid = paidTowardLoan(rep);
      const row = ensure(key);
      if (row) row.interestMade += paid * ratio;
      if (inRange(key)) collected += paid;
    }
  }

  for (const exp of expenses) {
    if (exp?.status === "rejected" || exp?.status === "cancelled") continue;
    if (!exp.expense_date) continue;
    const key = exp.expense_date.slice(0, 7);
    const row = ensure(key);
    if (row) row.expenses += num(exp.amount);
  }

  const rows = order.map((key) => {
    const row = bucket.get(key)!;
    row.expectedInterest = Math.round(row.expectedInterest * 100) / 100;
    row.interestMade = Math.round(row.interestMade * 100) / 100;
    row.expenses = Math.round(row.expenses * 100) / 100;
    row.netProfit = Math.round((row.interestMade - row.expenses) * 100) / 100;
    return row;
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.expectedInterest += r.expectedInterest;
      acc.interestMade += r.interestMade;
      acc.expenses += r.expenses;
      acc.netProfit += r.netProfit;
      return acc;
    },
    { expectedInterest: 0, interestMade: 0, expenses: 0, netProfit: 0, collected: 0 },
  );
  totals.collected = Math.round(collected * 100) / 100;

  const hasData = rows.some((r) => r.expectedInterest > 0 || r.interestMade > 0 || r.expenses > 0);

  return { rows, totals, hasData };
}

export interface ProfitContributionRow {
  loanId: string;
  repaymentAmount: number;
  interest: number;
  dueDate?: string | null;
  paidDate?: string | null;
  status?: string | null;
  source?: "loan" | "repayment";
}

export interface MonthContributions {
  monthKey: string;
  expected: ProfitContributionRow[];
  made: ProfitContributionRow[];
  expectedTotal: number;
  madeTotal: number;
}

/**
 * Per-repayment breakdown of what produced a given month's expected vs made interest.
 * - `expected` = loan booked interest for loans started/disbursed in that month.
 * - `made` = installments PAID (or partial) in that month.
 * Interest per row uses the same loan interest-ratio model as computeMonthlyProfit.
 */
export function computeMonthContributions(
  loans: ProfitLoanInput[] = [],
  repayments: ProfitRepaymentInput[] = [],
  monthKey: string,
): MonthContributions {
  const ratioByLoan = new Map<string, number>();
  for (const loan of loans) {
    if (loan?.id) ratioByLoan.set(loan.id, interestRatioFor(loan));
  }

  const expected: ProfitContributionRow[] = [];
  const made: ProfitContributionRow[] = [];

  for (const loan of loans) {
    if (!countsAsBookedLoan(loan)) continue;
    const loanDate = loanExpectedDate(loan);
    if (!loanDate || loanDate.slice(0, 7) !== monthKey) continue;
    expected.push({
      loanId: loan.id,
      repaymentAmount: num(loan.loan_amount),
      interest: Math.round(bookedInterestFor(loan) * 100) / 100,
      dueDate: loanDate,
      status: loan.status,
      source: "loan",
    });
  }

  for (const rep of repayments) {
    if (rep?.is_reversed) continue;
    if (rep?.status === "cancelled") continue;
    const ratio = rep?.loan_id ? ratioByLoan.get(rep.loan_id) ?? 0 : 0;
    const isPaid = rep.status === "paid" || rep.status === "partial";
    if (isPaid && rep.paid_date && rep.paid_date.slice(0, 7) === monthKey) {
      const paid = paidTowardLoan(rep);
      made.push({
        loanId: rep.loan_id ?? "",
        repaymentAmount: paid,
        interest: Math.round(paid * ratio * 100) / 100,
        dueDate: rep.due_date,
        paidDate: rep.paid_date,
        status: rep.status,
        source: "repayment",
      });
    }
  }

  const expectedTotal = Math.round(expected.reduce((s, r) => s + r.interest, 0) * 100) / 100;
  const madeTotal = Math.round(made.reduce((s, r) => s + r.interest, 0) * 100) / 100;

  return { monthKey, expected, made, expectedTotal, madeTotal };
}
