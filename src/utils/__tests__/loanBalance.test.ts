import { describe, expect, it } from "vitest";
import { calculateLoanBalanceSnapshot } from "../loanBalance";

describe("calculateLoanBalanceSnapshot", () => {
  it("zeros reloan carry-forward for a fully paid completed loan", () => {
    const snapshot = calculateLoanBalanceSnapshot(
      { loan_amount: 8495, total_repayment: 9344.5, status: "completed" },
      [{ amount: 9344.5, original_amount: 9344.5, status: "paid", principal_paid: 9344.5 }],
    );

    expect(snapshot.interestCarriedForward).toBe(0);
    expect(snapshot.reloanCarryForwardPrincipal).toBe(0);
    expect(snapshot.schedulePrincipalOutstanding).toBe(0);
  });

  it("zeros early-settled loans even when old rows look open", () => {
    const snapshot = calculateLoanBalanceSnapshot(
      { loan_amount: 8495, total_repayment: 9344.5, status: "completed", settlement_type: "early" },
      [{ amount: 9344.5, original_amount: 9344.5, status: "pending", principal_paid: 0 }],
    );

    expect(snapshot.interestCarriedForward).toBe(0);
    expect(snapshot.reloanCarryForwardPrincipal).toBe(0);
  });

  it("carries only unpaid principal and never carries old interest", () => {
    const snapshot = calculateLoanBalanceSnapshot(
      { loan_amount: 10000, total_repayment: 12000, status: "active" },
      [{ amount: 6000, original_amount: 6000, status: "paid", principal_paid: 6000 }],
    );

    expect(snapshot.interestCarriedForward).toBe(0);
    expect(snapshot.reloanCarryForwardPrincipal).toBe(6000);
  });
});