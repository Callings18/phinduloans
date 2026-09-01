import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth-user";
import { apiFail } from "../common/http";
import { LoansService } from "../loans/loans.service";
import { PrismaService } from "../prisma/prisma.service";

function money(value: { toNumber: () => number } | number | string | null | undefined, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value);
}

function remainingKwacha(rep: {
  amount: { toNumber: () => number } | number;
  original_amount: { toNumber: () => number } | number | null;
  principal_paid: { toNumber: () => number } | number | null;
  status: string | null;
}): number {
  const base = money(rep.original_amount, money(rep.amount));
  const paid = money(rep.principal_paid, rep.status === "paid" ? base : 0);
  return Math.max(0, Math.round((base - paid) * 100) / 100);
}

const REVIEWABLE = new Set(["pending_review", "pending", "needs_more_info"]);

@Injectable()
export class PaymentClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loans: LoansService,
  ) {}

  async submit(repaymentId: string, dto: { amount: number; reference: string; receiptUrl?: string | null }, actor: AuthUser, requestId: string) {
    const repayment = await this.prisma.loanRepayment.findUnique({ where: { id: repaymentId } });
    if (!repayment) {
      apiFail(HttpStatus.NOT_FOUND, "REPAYMENT_NOT_FOUND", "Repayment not found");
    }
    if (repayment.user_id !== actor.userId) {
      apiFail(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot submit claim for another user");
    }

    const maxRemaining = remainingKwacha(repayment);
    const claimAmount = Math.round(dto.amount * 100) / 100;
    if (claimAmount > maxRemaining + 0.009) {
      apiFail(
        HttpStatus.BAD_REQUEST,
        "AMOUNT_EXCEEDS_REMAINING",
        `Claim amount cannot exceed the remaining installment balance (K${maxRemaining.toLocaleString()}).`,
      );
    }

    const existing = await this.prisma.paymentClaim.findFirst({
      where: {
        repayment_id: repaymentId,
        user_id: actor.userId,
        status: { in: ["pending", "pending_review", "needs_more_info"] },
      },
      select: { id: true },
    });
    if (existing) {
      apiFail(HttpStatus.CONFLICT, "DUPLICATE_PENDING_CLAIM", "A pending claim already exists for this repayment");
    }

    const inserted = await this.prisma.paymentClaim.create({
      data: {
        loan_id: repayment.loan_id,
        repayment_id: repaymentId,
        user_id: actor.userId,
        amount: claimAmount,
        reference: dto.reference,
        receipt_url: dto.receiptUrl ?? null,
        status: "pending_review",
      },
    });

    await this.prisma.loanEvent.create({
      data: {
        loan_id: repayment.loan_id,
        event_type: "payment_claim_submitted",
        performed_by: actor.userId,
        visibility: "both",
        previous_values: { requestId } as Prisma.InputJsonValue,
        new_values: {
          claimId: inserted.id,
          amount: claimAmount,
          reference: dto.reference,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ok: true,
      data: {
        id: inserted.id,
        loan_id: inserted.loan_id,
        repayment_id: inserted.repayment_id,
        amount: claimAmount,
        reference: inserted.reference,
        status: inserted.status,
        created_at: inserted.created_at,
      },
    };
  }

  async listAdmin(status: string) {
    const rows = await this.prisma.paymentClaim.findMany({
      where: { status },
      orderBy: { created_at: "desc" },
    });
    return {
      ok: true,
      data: rows.map((r) => ({
        ...r,
        amount: money(r.amount),
        reviewed_at: r.verified_at,
        reviewed_by: r.verified_by,
      })),
    };
  }

  async review(
    claimId: string,
    dto: { decision: "approved" | "rejected" | "needs_more_info"; reviewComment?: string; decisionReasonCode?: string },
    actor: AuthUser,
    requestId: string,
  ) {
    if ((dto.decision === "rejected" || dto.decision === "needs_more_info") && !dto.reviewComment?.trim()) {
      apiFail(HttpStatus.UNPROCESSABLE_ENTITY, "REVIEW_COMMENT_REQUIRED", "Review comment is required for this decision");
    }

    const claim = await this.prisma.paymentClaim.findUnique({ where: { id: claimId } });
    if (!claim) {
      apiFail(HttpStatus.NOT_FOUND, "CLAIM_NOT_FOUND", "Payment claim not found");
    }
    if (!REVIEWABLE.has(claim.status)) {
      apiFail(HttpStatus.CONFLICT, "CLAIM_NOT_REVIEWABLE", `Claim with status ${claim.status} cannot be reviewed`);
    }

    const now = new Date();
    const updated = await this.prisma.paymentClaim.updateMany({
      where: { id: claimId, status: claim.status },
      data: {
        status: dto.decision,
        verified_by: actor.userId,
        verified_at: now,
        review_comment: dto.reviewComment?.trim() || null,
        decision_reason_code: dto.decisionReasonCode ?? null,
      },
    });
    if (updated.count !== 1) {
      apiFail(HttpStatus.CONFLICT, "CLAIM_RACE", "Claim was already reviewed");
    }

    await this.prisma.loanEvent.create({
      data: {
        loan_id: claim.loan_id,
        event_type: "payment_claim_reviewed",
        performed_by: actor.userId,
        reason: dto.reviewComment ?? null,
        visibility: "both",
        previous_values: { status: claim.status, requestId } as Prisma.InputJsonValue,
        new_values: {
          status: dto.decision,
          claimId,
          decisionReasonCode: dto.decisionReasonCode ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    await this.loans.notifyQuietly({
      userId: claim.user_id,
      title: "Payment claim reviewed",
      message: `Your payment claim was marked as ${dto.decision.replaceAll("_", " ")}.`,
      type: "payment_claim",
      metadata: { claimId, loanId: claim.loan_id, requestId },
    });

    return { ok: true, data: { claimId, status: dto.decision, requestId } };
  }
}
