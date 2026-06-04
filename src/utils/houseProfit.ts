import { format, startOfMonth, subMonths } from "date-fns";

export interface ProfitLoanInput {
  id: string;
  loan_amount?: number | null;
  total_repayment?: number | null;
  status?: string | null;
}

export interface ProfitRepaymentInput {
  loan_id?: string | null;
  status?: string | null;
  amount?: number | null;
  due_date?: string | null;
  paid_date?: string | null;
  is_reversed?: boolean | null;
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
  };
  hasData: boolean;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

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

/**
 * Compute month-by-month profit for a loan house.
 * - Expected interest is counted in the month an installment is DUE.
 * - Interest made is counted in the month an installment was PAID.
 * - Expenses (tied to the house's loans) are counted by expense_date month.
 * - Net profit (made) = interest made - expenses.
 */
export function computeMonthlyProfit(
  loans: ProfitLoanInput[] = [],
  repayments: ProfitRepaymentInput[] = [],
  expenses: ProfitExpenseInput[] = [],
  monthsBack = 12,
): MonthlyProfitResult {
  const now = new Date();
  const ratioByLoan = new Map<string, number>();
  for (const loan of loans) {
    if (loan?.id) ratioByLoan.set(loan.id, interestRatioFor(loan));
  }

  // Seed the last `monthsBack` months so the chart has a continuous axis.
  const order: string[] = [];
  const bucket = new Map<string, MonthlyProfitRow>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = startOfMonth(subMonths(now, i));
    const key = format(d, "yyyy-MM");
    order.push(key);
    bucket.set(key, {
      monthKey: key,
      label: format(d, "MMM yy"),
      expectedInterest: 0,
      interestMade: 0,
      expenses: 0,
      netProfit: 0,
    });
  }

  const ensure = (key: string): MonthlyProfitRow | null => bucket.get(key) ?? null;

  for (const rep of repayments) {
    if (rep?.is_reversed) continue;
    if (rep?.status === "cancelled") continue;
    const ratio = rep?.loan_id ? ratioByLoan.get(rep.loan_id) ?? 0 : 0;
    const amount = num(rep.amount);

    // Expected interest -> due month
    if (rep.due_date) {
      const key = rep.due_date.slice(0, 7);
      const row = ensure(key);
      if (row) row.expectedInterest += amount * ratio;
    }

    // Interest made -> paid month (paid + partial)
    const isPaid = rep.status === "paid" || rep.status === "partial";
    if (isPaid && rep.paid_date) {
      const key = rep.paid_date.slice(0, 7);
      const row = ensure(key);
      if (row) row.interestMade += amount * ratio;
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
    { expectedInterest: 0, interestMade: 0, expenses: 0, netProfit: 0 },
  );

  const hasData = rows.some((r) => r.expectedInterest > 0 || r.interestMade > 0 || r.expenses > 0);

  return { rows, totals, hasData };
}
