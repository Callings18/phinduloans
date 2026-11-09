import { describe, expect, it } from "vitest";
import { getRepaymentOutstandingAmount } from "../houseLoanListCalculations";

describe("getRepaymentOutstandingAmount", () => {
  it("subtracts recorded partial payments from the scheduled amount", () => {
    expect(getRepaymentOutstandingAmount({ amount: 2870.83, principal_paid: 10 })).toBeCloseTo(2860.83);
  });

  it("includes only the unpaid part of a penalty", () => {
    expect(getRepaymentOutstandingAmount({
      amount: 500,
      original_amount: 500,
      principal_paid: 200,
      penalty_amount: 50,
      penalty_paid: 10,
    })).toBe(340);
  });

  it("does not return negative balances when recorded payments exceed a row", () => {
    expect(getRepaymentOutstandingAmount({ amount: 100, principal_paid: 125, penalty_amount: 20, penalty_paid: 25 })).toBe(0);
  });
});
