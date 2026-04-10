import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-context";
import { appendLoanEvent } from "@/lib/events";
import { HttpError, toErrorResponse } from "@/lib/http-errors";
import { getIdempotencyKey, getRequestId } from "@/lib/request-meta";
import { triggerInAppNotification } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  decision: z.enum(["approved", "rejected", "needs_more_info"]),
  reviewComment: z.string().optional(),
  decisionReasonCode: z.string().optional(),
});

const idempotencyStore = new Map<string, { status: number; body: unknown }>();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAuth(req);
    requireAdmin(auth);
    const { id: claimId } = await params;
    const body = bodySchema.parse(await req.json());

    if ((body.decision === "rejected" || body.decision === "needs_more_info") && !body.reviewComment?.trim()) {
      throw new HttpError(422, "REVIEW_COMMENT_REQUIRED", "Review comment is required for this decision");
    }

    const idem = getIdempotencyKey(req);
    if (idem && idempotencyStore.has(idem)) {
      const cached = idempotencyStore.get(idem)!;
      return NextResponse.json(cached.body, { status: cached.status });
    }

    const { data: claim, error: claimErr } = await supabaseAdmin
      .from("payment_claims")
      .select("id, loan_id, repayment_id, user_id, status")
      .eq("id", claimId)
      .single();
    if (claimErr || !claim) throw new HttpError(404, "CLAIM_NOT_FOUND", "Payment claim not found");
    if (!["pending_review", "pending", "needs_more_info"].includes(claim.status)) {
      throw new HttpError(409, "CLAIM_NOT_REVIEWABLE", `Claim with status ${claim.status} cannot be reviewed`);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("payment_claims")
      .update({
        status: body.decision,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        review_comment: body.reviewComment?.trim() || null,
        decision_reason_code: body.decisionReasonCode ?? null,
      })
      .eq("id", claimId);
    if (updateErr) throw updateErr;

    await appendLoanEvent({
      loanId: claim.loan_id,
      eventType: "payment_claim_reviewed",
      performedBy: auth.userId,
      reason: body.reviewComment ?? null,
      previousValues: { status: claim.status, requestId },
      newValues: { status: body.decision, claimId, decisionReasonCode: body.decisionReasonCode ?? null },
      visibility: "both",
    });

    await triggerInAppNotification({
      userId: claim.user_id,
      title: "Payment claim reviewed",
      message: `Your payment claim was marked as ${body.decision.replaceAll("_", " ")}.`,
      type: "payment_claim",
      metadata: { claimId, loanId: claim.loan_id, requestId },
    });

    console.info("[phase1][payment_claim_review]", {
      requestId,
      claimId,
      decision: body.decision,
      reviewedBy: auth.userId,
    });

    const responseBody = {
      ok: true,
      data: { claimId, decision: body.decision, reviewedBy: auth.userId, requestId },
    };
    if (idem) idempotencyStore.set(idem, { status: 200, body: responseBody });
    return NextResponse.json(responseBody);
  } catch (error) {
    const out = toErrorResponse(error);
    return NextResponse.json(out.body, { status: out.status });
  }
}
