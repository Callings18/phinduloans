import { describe, expect, it } from "vitest";
import { calculateLoan, generateRepaymentSchedule, type LoanProduct } from "../loanCalculations";

const collateralProduct: LoanProduct = {
  product_name: "Collateral Loan",
  product_code: "COLLATERAL",
  interest_rate: 5,
  interest_period: "monthly",
  interest_type: "flat",
  term_unit: "months",
};

describe("Collateral loan calculations (flat 30% over 6 months)", () => {
  it("P=10,000 -> interest 3,000, total 13,000, monthly 2,166.67", () => {
    const r = calculateLoan(10_000, 6, collateralProduct, "months");
    expect(r.totalInterest).toBe(3000);
    expect(r.totalRepayment).toBe(13_000);
    expect(r.monthlyPayment).toBe(2166.67);
    expect(r.paymentFrequency).toBe("monthly");
  });

  it("P=50,000 -> interest 15,000, total 65,000, monthly 10,833.33", () => {
    const r = calculateLoan(50_000, 6, collateralProduct, "months");
    expect(r.totalInterest).toBe(15_000);
    expect(r.totalRepayment).toBe(65_000);
    expect(r.monthlyPayment).toBe(10_833.33);
  });

  it("generates exactly 6 equal monthly installments with monthly due dates", () => {
    const start = new Date("2026-01-15T12:00:00Z");
    const schedule = generateRepaymentSchedule(50_000, 6, collateralProduct, start, "months");
    expect(schedule).toHaveLength(6);
    for (const item of schedule) {
      expect(item.totalPayment).toBe(10_833.33);
    }
    expect(schedule[0].dueDate.getUTCMonth()).toBe(1); // Feb (start + 1 month)
    expect(schedule[5].dueDate.getUTCMonth()).toBe(6); // Jul (start + 6 months)
  });
});
