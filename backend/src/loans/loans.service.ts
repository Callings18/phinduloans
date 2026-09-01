import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/auth-user";
import { apiFail } from "../common/http";
import { assertValidTransition } from "./loan-status.machine";

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(private readonly prisma: PrismaService) {}

  async transition(loanId: string, dto: { toStatus: string; reasonCode?: string; reasonText?: string }, actor: AuthUser, requestId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      select: { id: true, status: true, user_id: true },
    });
    if (!loan) {
      apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan application not found");
    }

    assertValidTransition(loan.status, dto.toStatus);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.loanApplication.updateMany({
        where: { id: loanId, status: loan.status },
        data: {
          status: dto.toStatus,
          reviewed_by: actor.userId,
          reviewed_at: now,
        },
      });
      if (updated.count !== 1) {
        apiFail(
          HttpStatus.CONFLICT,
          "STATUS_RACE",
          "Loan status already changed; retry with the current status",
        );
      }

      await tx.loanStatusTransition.create({
        data: {
          loan_id: loanId,
          from_status: loan.status,
          to_status: dto.toStatus,
          actor_type: actor.actorType,
          actor_id: actor.userId,
          reason_code: dto.reasonCode ?? null,
          reason_text: dto.reasonText ?? null,
        },
      });

      await tx.loanEvent.create({
        data: {
          loan_id: loanId,
          event_type: "status_changed",
          performed_by: actor.userId,
          reason: dto.reasonText ?? null,
          visibility: "both",
          previous_values: {
            status: loan.status,
            reasonCode: dto.reasonCode ?? null,
            requestId,
          } as Prisma.InputJsonValue,
          new_values: { status: dto.toStatus } as Prisma.InputJsonValue,
        },
      });
    });

    await this.notifyQuietly({
      userId: loan.user_id,
      title: "Loan status updated",
      message: `Your loan status changed from ${loan.status} to ${dto.toStatus}.`,
      type: "loan_status",
      metadata: { loanId, requestId },
    });

    this.logger.log(`loan_transition ${loanId} ${loan.status} -> ${dto.toStatus} by ${actor.userId}`);

    return {
      ok: true,
      data: { loanId, fromStatus: loan.status, toStatus: dto.toStatus, requestId },
    };
  }

  async listEvents(loanId: string, actor: AuthUser, scope?: string | null) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      select: { id: true, user_id: true },
    });
    if (!loan) {
      apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan application not found");
    }
    if (actor.actorType !== "admin" && loan.user_id !== actor.userId) {
      apiFail(HttpStatus.FORBIDDEN, "FORBIDDEN", "You cannot view events for this loan");
    }

    const events = await this.prisma.loanEvent.findMany({
      where: { loan_id: loanId },
      orderBy: { created_at: "desc" },
    });

    const effectiveScope = scope ?? (actor.actorType === "admin" ? "admin" : "borrower");
    const filtered =
      effectiveScope === "admin" && actor.actorType === "admin"
        ? events
        : events.filter((e) => e.visibility !== "admin");

    return { ok: true, data: filtered };
  }

  async notifyQuietly(input: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          user_id: input.userId,
          title: input.title,
          message: input.message,
          type: input.type ?? "system",
          status: "unread",
          recipient: input.userId,
          provider_response: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`notify failed: ${message}`);
    }
  }

  newRequestId(header?: string): string {
    return header?.trim() || randomUUID();
  }
}
