import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-context";
import { appendLoanEvent } from "@/lib/events";
import { HttpError, toErrorResponse } from "@/lib/http-errors";
import { getRequestId } from "@/lib/request-meta";
import { assertValidTransition } from "@/lib/state-machine";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { triggerInAppNotification } from "@/lib/notifications";

const bodySchema = z.object({
  toStatus: z.string().min(1),
  reasonCode: z.string().optional(),
  reasonText: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAuth(req);
    if (auth.actorType !== "admin") {
      throw new HttpError(403, "FORBIDDEN", "Only admin/staff can transition loan status");
    }

    const { id: loanId } = await params;
    const json = bodySchema.parse(await req.json());

    const { data: loan, error: loanErr } = await supabaseAdmin
      .from("loan_applications")
      .select("id, status, user_id")
      .eq("id", loanId)
      .single();
    if (loanErr || !loan) throw new HttpError(404, "LOAN_NOT_FOUND", "Loan application not found");

    assertValidTransition(loan.status, json.toStatus);

    const { error: updateErr } = await supabaseAdmin
      .from("loan_applications")
      .update({
        status: json.toStatus,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", loanId);
    if (updateErr) throw updateErr;

    const { error: transitionErr } = await supabaseAdmin.from("loan_status_transitions").insert({
      loan_id: loanId,
      from_status: loan.status,
      to_status: json.toStatus,
      actor_type: auth.actorType,
      actor_id: auth.userId,
      reason_code: json.reasonCode ?? null,
      reason_text: json.reasonText ?? null,
    });
    if (transitionErr) throw transitionErr;

    await appendLoanEvent({
      loanId,
      eventType: "status_changed",
      performedBy: auth.userId,
      reason: json.reasonText ?? null,
      previousValues: { status: loan.status, reasonCode: json.reasonCode ?? null, requestId },
      newValues: { status: json.toStatus },
      visibility: "both",
    });

    if (loan.user_id) {
      await triggerInAppNotification({
        userId: loan.user_id,
        title: "Loan status updated",
        message: `Your loan status changed from ${loan.status} to ${json.toStatus}.`,
        type: "loan_status",
        metadata: { loanId, requestId },
      });
    }

    console.info("[phase1][loan_transition]", { requestId, loanId, actor: auth.userId, fromStatus: loan.status, toStatus: json.toStatus });

    return NextResponse.json({
      ok: true,
      data: { loanId, fromStatus: loan.status, toStatus: json.toStatus, requestId },
    });
  } catch (error) {
    const out = toErrorResponse(error);
    return NextResponse.json(out.body, { status: out.status });
  }
}
