import { describe, expect, it } from "vitest";
import { calculateLoan, type LoanProduct } from "../loanCalculations";

const marketeerProduct: LoanProduct = {
  product_name: "Marketeer Loan",
  product_code: "MARKETEER",
  interest_rate: 30,
  interest_period: "per_loan",
  interest_type: "flat",
  term_unit: "days",
  min_amount: 1000,
  max_amount: 10000,
  processing_fee_percent: 5,
};

describe("MARKETEER calculateLoan", () => {
  it("uses 26-day tier math and deducts processing fee from principal", () => {
    const r = calculateLoan(5000, 26, marketeerProduct, "days");
    expect(r.totalInterest).toBe(1500);
    expect(r.totalRepayment).toBe(6500);
    expect(r.processingFee).toBe(250);
    expect(r.netToBorrower).toBe(4750);
    expect(r.dailyPayment).toBe(250);
  });
});
