import { describe, expect, it } from "vitest";
import {
  calculateLoan,
  calculatePenalty,
  generateRepaymentSchedule,
  type LoanProduct,
} from "../loanCalculations";

// Collateral product is now FIXED at 6 months / 30% total interest
// (5% per month equivalent for display). Enforced in the DB by:
//   supabase/migrations/20260429140500_collateral_fixed_flat_6_months.sql
const collateralProduct: LoanProduct = {
  product_name: "Collateral Loan",
  product_code: "COLLATERAL",
  interest_rate: 5,
  interest_period: "monthly",
  interest_type: "flat",
  term_unit: "months",
};

describe("Collateral loan (fixed 6 months, 30% total)", () => {
  it("P=10,000 -> interest 3,000, total 13,000, monthly 2,166.67", () => {
    const r = calculateLoan(10_000, 6, collateralProduct, "months");
    expect(r.totalInterest).toBe(3000);
    expect(r.totalRepayment).toBe(13_000);
    expect(r.monthlyPayment).toBe(2_166.67);
  });

  it("P=50,000 -> interest 15,000, total 65,000, monthly 10,833.33", () => {
    const r = calculateLoan(50_000, 6, collateralProduct, "months");
    expect(r.totalInterest).toBe(15_000);
    expect(r.totalRepayment).toBe(65_000);
    expect(r.monthlyPayment).toBe(10_833.33);
  });

  it("interest is always 30% of principal (collateral term is fixed)", () => {
    // Even if a caller passes a different term, calculation engine forces
    // 6 monthly installments of 30% total — matching DB constraint.
    for (const term of [1, 3, 6, 12]) {
      const r = calculateLoan(20_000, term, collateralProduct, "months");
      expect(r.totalInterest).toBe(6000);
      expect(r.totalRepayment).toBe(26_000);
      expect(r.monthlyPayment).toBe(4_333.33); // 26,000 / 6
    }
  });

  it("schedule always has 6 equal monthly installments", () => {
    const start = new Date("2026-01-15T12:00:00Z");
    const schedule = generateRepaymentSchedule(50_000, 6, collateralProduct, start, "months");
    expect(schedule).toHaveLength(6);
    for (const item of schedule) {
      expect(item.totalPayment).toBeCloseTo(10_833.33, 2);
    }
    // Last installment fully amortizes the principal.
    expect(schedule[5].remainingBalance).toBe(0);
  });

  it("schedule due dates step by 1 month from the start date", () => {
    const start = new Date("2026-01-10T12:00:00Z");
    const schedule = generateRepaymentSchedule(60_000, 6, collateralProduct, start, "months");
    for (let i = 0; i < schedule.length; i += 1) {
      const expectedMonth = (start.getMonth() + i + 1) % 12;
      expect(schedule[i].dueDate.getMonth()).toBe(expectedMonth);
      expect(schedule[i].installmentNumber).toBe(i + 1);
    }
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
