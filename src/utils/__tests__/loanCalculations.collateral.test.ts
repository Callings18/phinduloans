import { describe, expect, it } from "vitest";
import { calculateLoan, generateRepaymentSchedule, type LoanProduct } from "../loanCalculations";

const collateralProduct: LoanProduct = {
  product_name: "Collateral Loan",
  product_code: "COLLATERAL",
  interest_rate: 30,
  interest_period: "per_loan",
  interest_type: "flat",
  term_unit: "months",
};

describe("Collateral loan (flat 30% per loan, 1–6 months)", () => {
  it("P=10,000 over 1 month -> interest 3,000, total 13,000, monthly 13,000", () => {
    const r = calculateLoan(10_000, 1, collateralProduct, "months");
    expect(r.totalInterest).toBe(3000);
    expect(r.totalRepayment).toBe(13_000);
    expect(r.monthlyPayment).toBe(13_000);
    expect(r.monthlyInterestRate).toBe(30);
  });

  it("P=10,000 over 3 months -> interest 3,000, total 13,000, monthly 4,333.33", () => {
    const r = calculateLoan(10_000, 3, collateralProduct, "months");
    expect(r.totalInterest).toBe(3000);
    expect(r.totalRepayment).toBe(13_000);
    expect(r.monthlyPayment).toBe(4_333.33);
    expect(r.monthlyInterestRate).toBeCloseTo(10, 5);
  });

  it("P=10,000 over 6 months -> interest 3,000, total 13,000, monthly 2,166.67", () => {
    const r = calculateLoan(10_000, 6, collateralProduct, "months");
    expect(r.totalInterest).toBe(3000);
    expect(r.totalRepayment).toBe(13_000);
    expect(r.monthlyPayment).toBe(2_166.67);
    expect(r.monthlyInterestRate).toBeCloseTo(5, 5);
  });

  it("P=50,000 over 6 months -> interest 15,000, total 65,000, monthly 10,833.33", () => {
    const r = calculateLoan(50_000, 6, collateralProduct, "months");
    expect(r.totalInterest).toBe(15_000);
    expect(r.totalRepayment).toBe(65_000);
    expect(r.monthlyPayment).toBe(10_833.33);
  });

  it("interest is always 30% of principal regardless of term", () => {
    for (const term of [1, 2, 3, 4, 5, 6]) {
      const r = calculateLoan(20_000, term, collateralProduct, "months");
      expect(r.totalInterest).toBe(6000);
      expect(r.totalRepayment).toBe(26_000);
    }
  });

  it("schedule generates N equal installments", () => {
    const start = new Date("2026-01-15T12:00:00Z");
    const schedule = generateRepaymentSchedule(50_000, 3, collateralProduct, start, "months");
    expect(schedule).toHaveLength(3);
    for (const item of schedule) {
      expect(item.totalPayment).toBeCloseTo(21_666.67, 2);
    }
  });
});
