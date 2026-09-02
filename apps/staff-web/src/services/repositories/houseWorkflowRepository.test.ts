import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  houseMarkDisbursementCompleted,
  houseMarkRepaymentPaid,
  houseSetLoanStatus,
  houseStageReview,
  recordLoanPayment,
} from "./houseWorkflowRepository";

const {
  fromMock,
  selectMock,
  selectEqMock,
  maybeSingleMock,
  recordLoanPaymentMock,
  completeDisbursementMock,
  transitionLoanByActionMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  selectEqMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  recordLoanPaymentMock: vi.fn(),
  completeDisbursementMock: vi.fn(),
  transitionLoanByActionMock: vi.fn(),
}));

vi.mock("@phinduloans/shared/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("@phinduloans/shared/services/repositories/coreWritesRepository", () => ({
  recordLoanPayment: recordLoanPaymentMock,
}));

vi.mock("@phinduloans/shared/services/repositories/workflowRepository", () => ({
  completeDisbursement: completeDisbursementMock,
  transitionLoanByAction: transitionLoanByActionMock,
}));

describe("houseWorkflowRepository", () => {
  beforeEach(() => {
    fromMock.mockReset();
    selectMock.mockReset();
    selectEqMock.mockReset();
    maybeSingleMock.mockReset();
    recordLoanPaymentMock.mockReset();
    completeDisbursementMock.mockReset();
    transitionLoanByActionMock.mockReset();

    recordLoanPaymentMock.mockResolvedValue({ success: true });
    completeDisbursementMock.mockResolvedValue(undefined);
    transitionLoanByActionMock.mockResolvedValue(undefined);

    selectMock.mockReturnValue({ eq: selectEqMock });
    selectEqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValue({ data: { amount: 100 }, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "loan_repayments") return { select: selectMock };
      return { select: selectMock };
    });
  });

  it("runs the full house workflow through Nest-backed helpers", async () => {
    await houseSetLoanStatus("loan-1", "approved");
    await houseStageReview("loan-1", "manager");
    await houseMarkDisbursementCompleted({ disbursementId: "disb-1", accountId: "acct-1" });
    await houseMarkRepaymentPaid("rep-1");

    expect(transitionLoanByActionMock).toHaveBeenNthCalledWith(1, "loan-1", "approve");
    expect(transitionLoanByActionMock).toHaveBeenNthCalledWith(2, "loan-1", "approve");
    expect(completeDisbursementMock).toHaveBeenCalledWith({
      disbursementId: "disb-1",
      accountId: "acct-1",
      transactionReference: null,
    });
    expect(recordLoanPaymentMock).toHaveBeenCalledWith({
      repaymentId: "rep-1",
      amount: 100,
      paymentMethod: undefined,
      accountId: undefined,
      transactionReference: undefined,
      paidDate: undefined,
      penaltyAmount: undefined,
    });
  });

  it("loads the installment amount before recording a payment", async () => {
    await houseMarkRepaymentPaid("rep-2");

    expect(fromMock).toHaveBeenCalledWith("loan_repayments");
    expect(recordLoanPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ repaymentId: "rep-2", amount: 100 }),
    );
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

    await houseMarkRepaymentPaid("rep-partial");

    expect(recordLoanPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ repaymentId: "rep-partial", amount: 340 }),
    );
  });

  it("passes penalty split when provided", async () => {
    await recordLoanPayment({
      repaymentId: "rep-3",
      amount: 150,
      penaltyAmount: 25,
      accountId: "acct-9",
      paymentMethod: "mobile_money",
    });

    expect(recordLoanPaymentMock).toHaveBeenCalledWith({
      repaymentId: "rep-3",
      amount: 150,
      paymentMethod: "mobile_money",
      accountId: "acct-9",
      transactionReference: undefined,
      paidDate: undefined,
      penaltyAmount: 25,
    });
  });

  it("throws transition errors from the backend helper", async () => {
    transitionLoanByActionMock.mockRejectedValueOnce(new Error("No product access"));
    await expect(houseSetLoanStatus("loan-1", "approved")).rejects.toThrow("No product access");
  });

  it("throws transport-level errors from the backend helper", async () => {
    transitionLoanByActionMock.mockRejectedValueOnce(new Error("network"));
    await expect(houseStageReview("loan-1", "finance")).rejects.toThrow("network");
  });
});
