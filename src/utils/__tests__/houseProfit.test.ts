import { describe, it, expect } from "vitest";
import { format, subMonths } from "date-fns";
import { computeMonthlyProfit } from "../houseProfit";

const monthKey = (offset: number) => format(subMonths(new Date(), offset), "yyyy-MM");
const dayIn = (offset: number) => `${monthKey(offset)}-15`;

describe("computeMonthlyProfit", () => {
  it("returns seeded months even with no data", () => {
    const res = computeMonthlyProfit([], [], [], 6);
    expect(res.rows).toHaveLength(6);
    expect(res.hasData).toBe(false);
    expect(res.totals.netProfit).toBe(0);
  });

  it("computes expected interest by due month and made interest by paid month", () => {
    // Loan: principal 1000, total 1200 => interest ratio = 200/1200 = 0.1667
    const loans = [{ id: "L1", loan_amount: 1000, total_repayment: 1200 }];
    const repayments = [
      // installment 600 due this month, paid this month
      { loan_id: "L1", amount: 600, status: "paid", due_date: dayIn(0), paid_date: dayIn(0) },
      // installment 600 due last month, not yet paid
      { loan_id: "L1", amount: 600, status: "pending", due_date: dayIn(1), paid_date: null },
    ];
    const res = computeMonthlyProfit(loans, repayments, [], 3);
    const thisMonth = res.rows.find((r) => r.monthKey === monthKey(0))!;
    const lastMonth = res.rows.find((r) => r.monthKey === monthKey(1))!;

    // 600 * (200/1200) = 100
    expect(thisMonth.expectedInterest).toBeCloseTo(100, 1);
    expect(thisMonth.interestMade).toBeCloseTo(100, 1);
    expect(lastMonth.expectedInterest).toBeCloseTo(100, 1);
    expect(lastMonth.interestMade).toBe(0);
  });

  it("subtracts expenses to produce net profit", () => {
    const loans = [{ id: "L1", loan_amount: 1000, total_repayment: 1200 }];
    const repayments = [
      { loan_id: "L1", amount: 600, status: "paid", due_date: dayIn(0), paid_date: dayIn(0) },
    ];
    const expenses = [{ loan_id: "L1", amount: 40, expense_date: dayIn(0), status: "pending" }];
    const res = computeMonthlyProfit(loans, repayments, expenses, 2);
    const thisMonth = res.rows.find((r) => r.monthKey === monthKey(0))!;
    expect(thisMonth.interestMade).toBeCloseTo(100, 1);
    expect(thisMonth.expenses).toBe(40);
    expect(thisMonth.netProfit).toBeCloseTo(60, 1);
  });

  it("ignores reversed and cancelled repayments", () => {
    const loans = [{ id: "L1", loan_amount: 1000, total_repayment: 1200 }];
    const repayments = [
      { loan_id: "L1", amount: 600, status: "paid", due_date: dayIn(0), paid_date: dayIn(0), is_reversed: true },
      { loan_id: "L1", amount: 600, status: "cancelled", due_date: dayIn(0), paid_date: dayIn(0) },
    ];
    const res = computeMonthlyProfit(loans, repayments, [], 2);
    expect(res.totals.interestMade).toBe(0);
    expect(res.totals.expectedInterest).toBe(0);
  });

  it("restricts results to an explicit from/to window", () => {
    const loans = [{ id: "L1", loan_amount: 1000, total_repayment: 1200 }];
    const repayments = [
      { loan_id: "L1", amount: 600, status: "paid", due_date: dayIn(0), paid_date: dayIn(0) },
      { loan_id: "L1", amount: 600, status: "paid", due_date: dayIn(3), paid_date: dayIn(3) },
    ];
    // Window covers only the last two months — the 3-months-ago payment is excluded.
    const res = computeMonthlyProfit(loans, repayments, [], {
      from: subMonths(new Date(), 1),
      to: new Date(),
    });
    expect(res.rows).toHaveLength(2);
    expect(res.totals.interestMade).toBeCloseTo(100, 1);
    expect(res.totals.collected).toBeCloseTo(600, 1);
  });

  it("derives the window from data when no range is given (all time)", () => {
    const loans = [{ id: "L1", loan_amount: 1000, total_repayment: 1200 }];
    const repayments = [
      { loan_id: "L1", amount: 600, status: "paid", due_date: dayIn(4), paid_date: dayIn(4) },
      { loan_id: "L1", amount: 600, status: "paid", due_date: dayIn(0), paid_date: dayIn(0) },
    ];
    const res = computeMonthlyProfit(loans, repayments, [], {});
    // From 4 months ago through this month inclusive = 5 buckets.
    expect(res.rows).toHaveLength(5);
    expect(res.totals.interestMade).toBeCloseTo(200, 1);
    expect(res.totals.collected).toBeCloseTo(1200, 1);
  });
});

