import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  houseMarkDisbursementCompleted,
  houseMarkRepaymentPaid,
  houseSetLoanStatus,
  houseStageReview,
  recordLoanPayment,
} from "./houseWorkflowRepository";

const { rpcMock, fromMock, updateMock, updateEqMock, selectMock, selectEqMock, maybeSingleMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  selectMock: vi.fn(),
  selectEqMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

describe("houseWorkflowRepository", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    selectMock.mockReset();
    selectEqMock.mockReset();
    maybeSingleMock.mockReset();

    updateMock.mockReturnValue({ eq: updateEqMock });
    updateEqMock.mockResolvedValue({ error: null });
    selectMock.mockReturnValue({ eq: selectEqMock });
    selectEqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValue({ data: { amount: 100 }, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "disbursements") return { update: updateMock };
      if (table === "loan_repayments") return { select: selectMock };
      return { update: updateMock, select: selectMock };
    });
  });

  it("runs the full house workflow RPC chain", async () => {
    rpcMock.mockResolvedValue({ data: { success: true }, error: null });

    await houseSetLoanStatus("loan-1", "approved");
    await houseStageReview("loan-1", "manager");
    await houseMarkDisbursementCompleted({ disbursementId: "disb-1", accountId: "acct-1" });
    await houseMarkRepaymentPaid("rep-1");

    expect(rpcMock).toHaveBeenCalledTimes(4);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "transition_loan_status", {
      p_loan_id: "loan-1",
      p_action: "approve",
      p_reason: null,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "transition_loan_status", {
      p_loan_id: "loan-1",
      p_action: "approve",
      p_reason: null,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(3, "complete_disbursement", {
      p_disbursement_id: "disb-1",
      p_account_id: "acct-1",
      p_transaction_reference: null,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(4, "record_loan_payment", {
      p_repayment_id: "rep-1",
      p_amount: 100,
      p_payment_method: "cash",
      p_account_id: null,
      p_transaction_reference: null,
      p_paid_date: null,
    });
  });

  it("loads the installment amount before calling record_loan_payment", async () => {
    rpcMock.mockResolvedValueOnce({ data: { success: true }, error: null });

    await houseMarkRepaymentPaid("rep-2");

    expect(fromMock).toHaveBeenCalledWith("loan_repayments");
    expect(rpcMock).toHaveBeenCalledWith("record_loan_payment", {
      p_repayment_id: "rep-2",
      p_amount: 100,
      p_payment_method: "cash",
      p_account_id: null,
      p_transaction_reference: null,
      p_paid_date: null,
    });
  });

  it("uses remaining principal+penalty for partially paid installments", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        amount: 500,
        original_amount: 500,
        principal_paid: 200,
        penalty_amount: 50,
        penalty_paid: 10,
      },
      error: null,
    });
    rpcMock.mockResolvedValueOnce({ data: { success: true, receipt_no: "R-1" }, error: null });

    await houseMarkRepaymentPaid("rep-partial");

    expect(rpcMock).toHaveBeenCalledWith("record_loan_payment", {
      p_repayment_id: "rep-partial",
      p_amount: 340,
      p_payment_method: "cash",
      p_account_id: null,
      p_transaction_reference: null,
      p_paid_date: null,
    });
  });

  it("passes penalty split to record_loan_payment when provided", async () => {
    rpcMock.mockResolvedValueOnce({ data: { success: true, receipt_no: "R-2" }, error: null });

    await recordLoanPayment({
      repaymentId: "rep-3",
      amount: 150,
      penaltyAmount: 25,
      accountId: "acct-9",
      paymentMethod: "mobile_money",
    });

    expect(rpcMock).toHaveBeenCalledWith("record_loan_payment", {
      p_repayment_id: "rep-3",
      p_amount: 150,
      p_payment_method: "mobile_money",
      p_account_id: "acct-9",
      p_transaction_reference: null,
      p_paid_date: null,
      p_penalty_amount: 25,
    });
  });

  it("throws RPC logical errors from backend", async () => {
    rpcMock.mockResolvedValueOnce({ data: { success: false, error: "No product access" }, error: null });
    await expect(houseSetLoanStatus("loan-1", "approved")).rejects.toThrow("No product access");
  });

  it("throws transport-level RPC errors", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error("network") });
    await expect(houseStageReview("loan-1", "finance")).rejects.toThrow("network");
  });
});

