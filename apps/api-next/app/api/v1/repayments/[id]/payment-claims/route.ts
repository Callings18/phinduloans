import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-context";
import { appendLoanEvent } from "@/lib/events";
import { HttpError, toErrorResponse } from "@/lib/http-errors";
import { getRequestId } from "@/lib/request-meta";
import { triggerInAppNotification } from "@/lib/notifications";
import { repaymentRemainingKwacha } from "@/lib/repaymentRemaining";
import { supabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  amount: z.number().positive(),
  reference: z.string().min(1),
  receiptUrl: z.string().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAuth(req);
    const { id: repaymentId } = await params;
    const body = bodySchema.parse(await req.json());

    const { data: repayment, error: repErr } = await supabaseAdmin
      .from("loan_repayments")
      .select("id, loan_id, user_id, amount, original_amount, principal_paid")
      .eq("id", repaymentId)
      .single();
    if (repErr || !repayment) throw new HttpError(404, "REPAYMENT_NOT_FOUND", "Repayment not found");
    if (repayment.user_id !== auth.userId) {
      throw new HttpError(403, "FORBIDDEN", "Cannot submit claim for another user");
    }

    const maxRemaining = repaymentRemainingKwacha(repayment);
    const claimAmount = Math.round(body.amount * 100) / 100;
    if (claimAmount > maxRemaining + 0.009) {
      throw new HttpError(
        400,
        "AMOUNT_EXCEEDS_REMAINING",
        `Claim amount cannot exceed the remaining installment balance (K${maxRemaining.toLocaleString()}).`,
      );
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("payment_claims")
      .select("id, status")
      .eq("repayment_id", repaymentId)
      .eq("user_id", auth.userId)
      .in("status", ["pending", "pending_review", "needs_more_info"])
      .limit(1);
    if (existingErr) throw existingErr;
    const openClaim = (existing ?? [])[0];
    if (openClaim && openClaim.status !== "needs_more_info") {
      throw new HttpError(409, "DUPLICATE_PENDING_CLAIM", "A pending claim already exists for this repayment");
    }

    if (openClaim?.status === "needs_more_info") {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("payment_claims")
        .update({
          amount: body.amount,
          reference: body.reference,
          receipt_url: body.receiptUrl ?? null,
          status: "pending_review",
          review_comment: null,
          decision_reason_code: null,
          verified_at: null,
          verified_by: null,
        })
        .eq("id", openClaim.id)
        .select("id, loan_id, repayment_id, amount, reference, status, created_at")
        .single();
      if (updateErr) throw updateErr;

      await appendLoanEvent({
        loanId: repayment.loan_id,
        eventType: "payment_claim_resubmitted",
        performedBy: auth.userId,
        previousValues: { requestId, claimId: openClaim.id },
        newValues: { amount: body.amount, reference: body.reference },
        visibility: "both",
      });

      return NextResponse.json({ ok: true, data: updated });
    }

    const insertPayload = {
      loan_id: repayment.loan_id,
      repayment_id: repaymentId,
      user_id: auth.userId,
      amount: body.amount,
      reference: body.reference,
      receipt_url: body.receiptUrl ?? null,
      status: "pending_review",
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("payment_claims")
      .insert(insertPayload)
      .select("id, loan_id, repayment_id, amount, reference, status, created_at")
      .single();
    if (insertErr) throw insertErr;

    await appendLoanEvent({
      loanId: repayment.loan_id,
      eventType: "payment_claim_submitted",
      performedBy: auth.userId,
      previousValues: { requestId },
      newValues: { claimId: inserted.id, amount: body.amount, reference: body.reference },
      visibility: "both",
    });

    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "super_admin", "finance_officer"]);
    for (const admin of admins ?? []) {
      await triggerInAppNotification({
        userId: admin.user_id,
        title: "New payment claim",
        message: `Borrower submitted a payment claim for repayment ${repaymentId}.`,
        type: "payment_claim",
        metadata: { claimId: inserted.id, loanId: repayment.loan_id, requestId },
      });
    }

    console.info("[phase1][payment_claim_submit]", {
      requestId,
      claimId: inserted.id,
      repaymentId,
      loanId: repayment.loan_id,
      userId: auth.userId,
    });

    return NextResponse.json({ ok: true, data: inserted });
  } catch (error) {
    const out = toErrorResponse(error);
    return NextResponse.json(out.body, { status: out.status });
  }
}
