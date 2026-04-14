import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  houseMarkDisbursementCompleted,
  houseMarkRepaymentPaid,
  houseSetLoanStatus,
  houseStageReview,
} from "./houseWorkflowRepository";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe("houseWorkflowRepository", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("runs the full house workflow RPC chain", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    await houseSetLoanStatus("loan-1", "approved");
    await houseStageReview("loan-1", "manager");
    await houseMarkDisbursementCompleted("disb-1");
    await houseMarkRepaymentPaid("rep-1");

    expect(rpcMock).toHaveBeenCalledTimes(4);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "house_set_loan_status", {
      p_loan_id: "loan-1",
      p_status: "approved",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "house_stage_review", {
      p_loan_id: "loan-1",
      p_stage: "manager",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(3, "house_mark_disbursement_completed", {
      p_disbursement_id: "disb-1",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(4, "house_mark_repayment_paid", {
      p_repayment_id: "rep-1",
    });
  });

  it("throws RPC logical errors from backend", async () => {
    rpcMock.mockResolvedValueOnce({ data: { ok: false, error: "No product access" }, error: null });
    await expect(houseSetLoanStatus("loan-1", "approved")).rejects.toThrow("No product access");
  });

  it("throws transport-level RPC errors", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error("network") });
    await expect(houseStageReview("loan-1", "finance")).rejects.toThrow("network");
  });
});

