import { describe, expect, it } from "vitest";
import {
  calculateLoan,
  calculatePenalty,
  generateRepaymentSchedule,
  type LoanProduct,
} from "../loanCalculations";

// Collateral loans are NOT a forced 30-day bullet payment. They follow the
// term and interest the admin enters on the loan form, exactly like any other
// product. A "per_loan" flat interest means the stated % applies once over the
// whole term (e.g. 30% of principal), but the schedule still spreads across the
// chosen number of installments — collateral can run beyond 30 days.
const collateralProduct: LoanProduct = {
  product_name: "Collateral Loan",
  product_code: "COLLATERAL",
  interest_rate: 30,
  interest_period: "per_loan",
  interest_type: "flat",
  term_unit: "months",
};

describe("Collateral loan (admin-driven term & interest)", () => {
  it("per_loan flat: interest is the stated % of principal, once", () => {
    const r = calculateLoan(10_000, 1, collateralProduct, "months");
    expect(r.totalInterest).toBe(3000);
    expect(r.totalRepayment).toBe(13_000);
  });

  it("interest stays a one-time % of principal regardless of term length", () => {
    for (const term of [1, 3, 6, 12]) {
      const r = calculateLoan(20_000, term, collateralProduct, "months");
      expect(r.totalInterest).toBe(6000);
      expect(r.totalRepayment).toBe(26_000);
    }
  });

  it("can run for multiple monthly installments (not forced to a single payment)", () => {
    const start = new Date("2026-01-15T12:00:00Z");
    const schedule = generateRepaymentSchedule(60_000, 6, collateralProduct, start, "months");
    expect(schedule).toHaveLength(6);
    const totalPaid = schedule.reduce((sum, s) => sum + s.totalPayment, 0);
    expect(totalPaid).toBeCloseTo(78_000, 0); // 60,000 + 30% interest
    expect(schedule[schedule.length - 1].remainingBalance).toBe(0);
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
