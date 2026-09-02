import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/auth-user";
import { SupabaseService } from "../auth/supabase.service";
import { apiFail } from "../common/http";
import { roundZmw } from "../money/as-money";
import { assertValidTransition } from "./loan-status.machine";

const STATUS_TO_ACTION: Record<string, string> = {
  approved: "approve",
  rejected: "reject",
  disbursed: "disburse",
  active: "activate",
  completed: "complete",
  defaulted: "default",
};

function rpcFailed(data: unknown): string | null {
  if (data == null) return "RPC returned no result";
  if (typeof data !== "object") return null;
  const row = data as { ok?: boolean; success?: boolean; error?: string };
  if (row.ok === false || row.success === false) {
    return row.error || "Workflow RPC rejected the request";
  }
  return null;
}

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async transition(
    loanId: string,
    dto: { action?: string; toStatus?: string; reasonCode?: string; reasonText?: string },
    actor: AuthUser,
    requestId: string,
  ) {
    const action = dto.action?.trim() || (dto.toStatus ? STATUS_TO_ACTION[dto.toStatus] : undefined);
    if (action) {
      return this.rpcTransition(loanId, action, dto.reasonText ?? null, actor, requestId);
    }

    if (dto.toStatus !== "under_review") {
      apiFail(
        HttpStatus.BAD_REQUEST,
        "ACTION_REQUIRED",
        "Provide action (approve, reject, verify_documents, …) or toStatus under_review",
      );
    }

    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      select: { id: true, status: true, user_id: true },
    });
    if (!loan) {
      apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan application not found");
    }

    const toStatus = "under_review";
    assertValidTransition(loan.status, toStatus);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.loanApplication.updateMany({
        where: { id: loanId, status: loan.status },
        data: {
          status: toStatus,
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
          to_status: toStatus,
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
          new_values: { status: toStatus } as Prisma.InputJsonValue,
        },
      });
    });

    await this.notifyQuietly({
      userId: loan.user_id,
      title: "Loan status updated",
      message: `Your loan status changed from ${loan.status} to ${toStatus}.`,
      type: "loan_status",
      metadata: { loanId, requestId },
    });

    this.logger.log(`loan_transition ${loanId} ${loan.status} -> ${toStatus} by ${actor.userId}`);

    return {
      ok: true,
      data: { loanId, fromStatus: loan.status, toStatus, requestId },
    };
  }

  private async rpcTransition(
    loanId: string,
    action: string,
    reason: string | null,
    actor: AuthUser,
    requestId: string,
  ) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      select: { id: true, status: true, user_id: true },
    });
    if (!loan) {
      apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan application not found");
    }

    const admin = this.supabase.getAdminClient();
    const run = (withReason: boolean) =>
      admin.rpc("transition_loan_status", {
        p_loan_id: loanId,
        p_action: action,
        ...(withReason ? { p_reason: reason } : {}),
      });

    let { data, error } = await run(true);
    if (
      error &&
      String(error.message || "").toLowerCase().includes("function") &&
      String(error.message || "").includes("transition_loan_status")
    ) {
      ({ data, error } = await run(false));
    }
    if (error) apiFail(HttpStatus.BAD_REQUEST, "TRANSITION_RPC_FAILED", error.message);

    const fail = rpcFailed(data);
    if (fail) apiFail(HttpStatus.CONFLICT, "TRANSITION_REJECTED", fail);

    const fresh = await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      select: { status: true },
    });
    this.logger.log(`loan_rpc ${loanId} action=${action} ${loan.status} -> ${fresh?.status ?? "?"} by ${actor.userId}`);

    await this.notifyQuietly({
      userId: loan.user_id,
      title: "Loan status updated",
      message: `Your loan was updated (${action}).`,
      type: "loan_status",
      metadata: { loanId, requestId, action },
    });

    return {
      ok: true,
      data: {
        loanId,
        action,
        fromStatus: loan.status,
        toStatus: fresh?.status ?? null,
        requestId,
        rpc: data,
      },
    };
  }

  async completeDisbursement(
    disbursementId: string,
    dto: { accountId: string; transactionReference?: string | null },
    actor: AuthUser,
    requestId: string,
  ) {
    const admin = this.supabase.getAdminClient();
    const { data, error } = await admin.rpc("complete_disbursement", {
      p_disbursement_id: disbursementId,
      p_account_id: dto.accountId,
      p_transaction_reference: dto.transactionReference || null,
    });
    if (error) apiFail(HttpStatus.BAD_REQUEST, "DISBURSE_RPC_FAILED", error.message);
    const fail = rpcFailed(data);
    if (fail) apiFail(HttpStatus.CONFLICT, "DISBURSE_REJECTED", fail);

    this.logger.log(`disbursement_complete ${disbursementId} by ${actor.userId} ${requestId}`);
    return { ok: true, data };
  }

  async disburseLoan(
    loanId: string,
    dto: {
      accountId: string;
      amount: number;
      disbursementMethod: string;
      accountNumber?: string | null;
      mobileMoneyNumber?: string | null;
      transactionReference?: string | null;
    },
    actor: AuthUser,
    requestId: string,
  ) {
    const admin = this.supabase.getAdminClient();
    const { data: inserted, error: insertErr } = await admin
      .from("disbursements")
      .insert({
        loan_id: loanId,
        amount: roundZmw(dto.amount),
        disbursement_method: dto.disbursementMethod,
        account_number: dto.accountNumber || null,
        mobile_money_number: dto.mobileMoneyNumber || null,
        transaction_reference: dto.transactionReference || null,
        status: "pending",
        source_account_id: dto.accountId,
      })
      .select("id")
      .single();
    if (insertErr || !inserted?.id) {
      apiFail(HttpStatus.BAD_REQUEST, "DISBURSE_INSERT_FAILED", insertErr?.message || "Could not create disbursement");
    }

    const disbursementId = inserted.id as string;
    try {
      return await this.completeDisbursement(
        disbursementId,
        { accountId: dto.accountId, transactionReference: dto.transactionReference },
        actor,
        requestId,
      );
    } catch (err) {
      await admin.from("disbursements").delete().eq("id", disbursementId);
      throw err;
    }
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
