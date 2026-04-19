import { describe, expect, it } from "vitest";
import { repaymentRemainingKwacha } from "../repaymentRemaining";

describe("repaymentRemainingKwacha", () => {
  it("uses original_amount when set", () => {
    expect(repaymentRemainingKwacha({ original_amount: 100, amount: 50, principal_paid: 30 })).toBe(70);
  });

  it("falls back to amount", () => {
    expect(repaymentRemainingKwacha({ amount: 200, principal_paid: 50 })).toBe(150);
  });
});
