import { describe, expect, it } from "vitest";
import {
  calculateLoan,
  calculatePenalty,
  generateRepaymentSchedule,
  type LoanProduct,
} from "../loanCalculations";

// Collateral loans are a SINGLE 30-day bullet payment at a flat % of principal
// (30% by default). They are NOT split into monthly installments.
const collateralProduct: LoanProduct = {
  product_name: "Collateral Loan",
  product_code: "COLLATERAL",
  interest_rate: 30,
  interest_period: "per_loan",
  interest_type: "flat",
  term_unit: "months",
};

describe("Collateral loan (single 30-day payment, 30% flat)", () => {
  it("P=10,000 -> interest 3,000, total 13,000, single payment 13,000", () => {
    const r = calculateLoan(10_000, 1, collateralProduct, "months");
    expect(r.totalInterest).toBe(3000);
    expect(r.totalRepayment).toBe(13_000);
    expect(r.monthlyPayment).toBe(13_000);
  });

  it("P=50,000 -> interest 15,000, total 65,000, single payment 65,000", () => {
    const r = calculateLoan(50_000, 1, collateralProduct, "months");
    expect(r.totalInterest).toBe(15_000);
    expect(r.totalRepayment).toBe(65_000);
    expect(r.monthlyPayment).toBe(65_000);
  });

  it("interest is always 30% of principal regardless of term passed", () => {
    for (const term of [1, 3, 6, 12]) {
      const r = calculateLoan(20_000, term, collateralProduct, "months");
      expect(r.totalInterest).toBe(6000);
      expect(r.totalRepayment).toBe(26_000);
      expect(r.monthlyPayment).toBe(26_000); // single bullet payment
    }
  });

  it("schedule has a single installment for the full repayment", () => {
    const start = new Date("2026-01-15T12:00:00Z");
    const schedule = generateRepaymentSchedule(50_000, 1, collateralProduct, start, "months");
    expect(schedule).toHaveLength(1);
    expect(schedule[0].totalPayment).toBeCloseTo(65_000, 2);
    expect(schedule[0].remainingBalance).toBe(0);
  });

  it("the single installment is due 30 days after the start date", () => {
    const start = new Date("2026-01-10T12:00:00Z");
    const schedule = generateRepaymentSchedule(60_000, 1, collateralProduct, start, "months");
    const expected = new Date(start);
    expected.setDate(expected.getDate() + 30);
    expect(schedule[0].dueDate.getTime()).toBe(expected.getTime());
    expect(schedule[0].installmentNumber).toBe(1);
  });

  it("penalty calc on overdue collateral principal honors grace period", () => {
    const productWithPenalty: LoanProduct = {
      ...collateralProduct,
      late_payment_penalty_percent: 5,
      penalty_frequency: "monthly",
      grace_period_days: 3,
    };
    expect(calculatePenalty(10_000, 2, productWithPenalty)).toBe(0); // within grace
    expect(calculatePenalty(10_000, 4, productWithPenalty)).toBe(500); // 1 month
    expect(calculatePenalty(10_000, 35, productWithPenalty)).toBe(1000); // ceil(32/30) = 2 months
  });
});
