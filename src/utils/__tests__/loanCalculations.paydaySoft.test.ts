import { describe, expect, it } from "vitest";
import { calculateLoan, type LoanProduct } from "../loanCalculations";

// PAYDAY_SOFT: 30-day flat loan @ 30% per loan.
// Stored in DB as: term_unit='days', loan_term_months=30, interest_rate=30,
// interest_period='per_loan', repayment_frequency='bullet', interest_type='flat'.
//
// REGRESSION: The borrower-facing form historically called calculateLoan
// without the 4th `termUnit` argument. With the previous default of 'months'
// the engine treated a 30-day loan as a 30-MONTH loan and quoted 540% interest.
// calculateLoan must fall back to product.term_unit when no explicit unit is
// passed, and must convert 'days' → equivalent months internally.
const paydaySoftProduct: LoanProduct = {
  product_name: "Payday Soft Loan",
  product_code: "PAYDAY_SOFT",
  interest_rate: 30,
  interest_period: "per_loan" as any,
  interest_type: "flat",
  term_unit: "days",
};

describe("PAYDAY_SOFT calculation (regression: termUnit fallback)", () => {
  it("treats a 30-day loan as 1 month equivalent when termUnit is omitted", () => {
    const r = calculateLoan(1000, 30, paydaySoftProduct);
    expect(r.totalInterest).toBe(300); // 1000 × 30% once
    expect(r.totalRepayment).toBe(1300);
    expect(r.monthlyPayment).toBe(1300);
  });

  it("matches when caller passes termUnit explicitly", () => {
    const r = calculateLoan(1000, 30, paydaySoftProduct, "days");
    expect(r.totalInterest).toBe(300);
    expect(r.totalRepayment).toBe(1300);
  });

  it("does NOT regress to 540% interest on a 30-day loan", () => {
    const r = calculateLoan(1000, 30, paydaySoftProduct);
    // Previous bug: monthly rate 18 × 30 months → 5,400 total interest.
    expect(r.totalInterest).not.toBe(5400);
    expect(r.totalInterest).toBeLessThan(500);
  });
});
