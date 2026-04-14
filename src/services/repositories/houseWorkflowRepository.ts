import { supabase } from "@/integrations/supabase/client";

type HouseReviewStage = "loan_officer" | "finance" | "manager";

function assertRpcOk(data: unknown, fallbackMessage: string) {
  if (typeof data === "object" && data !== null && "ok" in data) {
    const result = data as { ok?: boolean; error?: string };
    if (result.ok === false) {
      throw new Error(result.error || fallbackMessage);
    }
  }
}

export async function houseSetLoanStatus(loanId: string, status: string) {
  const { data, error } = await (supabase.rpc as any)("house_set_loan_status", {
    p_loan_id: loanId,
    p_status: status,
  });
  if (error) throw error;
  assertRpcOk(data, "Unable to update loan status");
}

export async function houseStageReview(loanId: string, stage: HouseReviewStage) {
  const { data, error } = await (supabase.rpc as any)("house_stage_review", {
    p_loan_id: loanId,
    p_stage: stage,
  });
  if (error) throw error;
  assertRpcOk(data, "Review action failed");
}

export async function houseMarkDisbursementCompleted(disbursementId: string) {
  const { data, error } = await (supabase.rpc as any)("house_mark_disbursement_completed", {
    p_disbursement_id: disbursementId,
  });
  if (error) throw error;
  assertRpcOk(data, "Disbursement action failed");
}

export async function houseMarkRepaymentPaid(repaymentId: string) {
  const { data, error } = await (supabase.rpc as any)("house_mark_repayment_paid", {
    p_repayment_id: repaymentId,
  });
  if (error) throw error;
  assertRpcOk(data, "Collection action failed");
}

