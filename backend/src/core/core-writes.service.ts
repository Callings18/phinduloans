import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth-user";
import { SupabaseService } from "../auth/supabase.service";
import { apiFail } from "../common/http";

function normalizePhoneForAuth(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("260") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `260${digits.slice(1)}`;
  if (digits.length >= 9) return `260${digits}`;
  return digits;
}

function looksLikeDuplicateUserError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    message.includes("already been registered") ||
    message.includes("already registered") ||
    code === "email_exists" ||
    code === "phone_exists" ||
    code === "user_already_exists"
  );
}

@Injectable()
export class CoreWritesService {
  private readonly logger = new Logger(CoreWritesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async createBorrower(dto: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    nrc_number?: string;
    address?: string;
    city?: string;
    product_code?: string;
    gender?: string;
    marital_status?: string;
  }, actor: AuthUser) {
    const admin = this.supabase.getAdminClient();
    const full_name = dto.full_name.trim();
    if (!full_name) apiFail(HttpStatus.BAD_REQUEST, "NAME_REQUIRED", "Full name is required");

    const normalizedPhone = normalizePhoneForAuth(dto.phone);
    let email = dto.email?.trim() || null;

    const nameSlug =
      full_name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "borrower";
    const syntheticEmail = !email
      ? normalizedPhone
        ? `${normalizedPhone}@phone.phindu.local`
        : `${nameSlug}.${Date.now()}@borrower.phindu.local`
      : null;
    const authEmail = email || syntheticEmail!;
    const profileEmail = email;

    const tempPassword = `${randomUUID().slice(0, 10)}Aa1!`;
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      ...(normalizedPhone ? { phone: normalizedPhone, phone_confirm: true } : {}),
      user_metadata: { full_name },
    });

    const upsertProfile = async (userId: string) => {
      const { error } = await admin.from("profiles").upsert(
        {
          id: userId,
          email: profileEmail,
          full_name,
          phone: normalizedPhone || null,
          nrc_number: dto.nrc_number || null,
          address: dto.address || null,
          city: dto.city || null,
          gender: dto.gender || null,
          marital_status: dto.marital_status || null,
        },
        { onConflict: "id" },
      );
      if (error) apiFail(HttpStatus.BAD_REQUEST, "PROFILE_FAILED", error.message);
    };

    const linkHouse = async (userId: string) => {
      if (!dto.product_code) return;
      const { error } = await admin.from("product_house_borrowers").upsert(
        { product_code: dto.product_code, borrower_id: userId, added_by: actor.userId },
        { onConflict: "product_code,borrower_id" },
      );
      if (error) apiFail(HttpStatus.BAD_REQUEST, "HOUSE_LINK_FAILED", error.message);
    };

    if (createError) {
      if (!looksLikeDuplicateUserError(createError)) {
        apiFail(HttpStatus.BAD_REQUEST, "CREATE_USER_FAILED", createError.message);
      }

      const profileFilters: string[] = [];
      if (authEmail) profileFilters.push(`email.eq.${authEmail}`);
      if (normalizedPhone) profileFilters.push(`phone.eq.${normalizedPhone}`);
      let foundId: string | null = null;
      if (profileFilters.length) {
        const { data: profileMatches } = await admin
          .from("profiles")
          .select("id")
          .or(profileFilters.join(","))
          .limit(1);
        foundId = profileMatches?.[0]?.id ?? null;
      }
      if (!foundId) {
        let page = 1;
        while (!foundId && page <= 20) {
          const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 100 });
          if (listError || !listData.users.length) break;
          const match = listData.users.find(
            (u) => u.email === authEmail || (normalizedPhone ? u.phone === normalizedPhone : false),
          );
          if (match) foundId = match.id;
          if (listData.users.length < 100) break;
          page += 1;
        }
      }
      if (!foundId) {
        apiFail(HttpStatus.BAD_REQUEST, "DUPLICATE_UNRESOLVED", createError.message);
      }
      await upsertProfile(foundId);
      await linkHouse(foundId);
      return {
        ok: true,
        success: true,
        user_id: foundId,
        existing: true,
        message: profileEmail
          ? `Borrower profile updated. This email (${profileEmail}) was already registered.`
          : "Borrower profile updated. This phone number was already registered.",
      };
    }

    const userId = newUser.user!.id;
    await upsertProfile(userId);
    await admin.from("user_roles").insert({ user_id: userId, role: "user" });
    await linkHouse(userId);
    return {
      ok: true,
      success: true,
      user_id: userId,
      existing: false,
      message: "Borrower created successfully",
    };
  }

  async createApplication(
    dto: { application: Record<string, unknown>; borrowers?: Record<string, unknown>[]; productCode?: string },
    actor: AuthUser,
  ) {
    const admin = this.supabase.getAdminClient();
    const application = {
      ...dto.application,
      user_id: actor.actorType === "admin" ? (dto.application.user_id as string) : actor.userId,
    };
    if (!application.user_id) {
      apiFail(HttpStatus.BAD_REQUEST, "USER_REQUIRED", "Application is missing user_id");
    }
    if (actor.actorType !== "admin" && application.user_id !== actor.userId) {
      apiFail(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot create an application for another user");
    }

    const { data: inserted, error } = await admin
      .from("loan_applications")
      .insert(application)
      .select("id")
      .single();
    if (error || !inserted) {
      apiFail(HttpStatus.BAD_REQUEST, "APPLICATION_INSERT_FAILED", error?.message ?? "Insert failed");
    }

    if (dto.borrowers?.length) {
      const rows = dto.borrowers.map((row) => ({
        ...row,
        loan_application_id: inserted.id,
        created_by: actor.userId,
      }));
      const { error: borrowersErr } = await admin.from("loan_borrowers").insert(rows);
      if (borrowersErr) this.logger.warn(`loan_borrowers insert: ${borrowersErr.message}`);
    }

    if (dto.productCode) {
      const { error: houseErr } = await admin.from("product_house_borrowers").upsert(
        { product_code: dto.productCode, borrower_id: application.user_id as string, added_by: actor.userId },
        { onConflict: "product_code,borrower_id" },
      );
      if (houseErr) this.logger.warn(`house roster: ${houseErr.message}`);
    }

    return { ok: true, data: { id: inserted.id } };
  }

  async recordPayment(
    repaymentId: string,
    dto: {
      amount: number;
      paymentMethod?: string;
      accountId?: string | null;
      transactionReference?: string;
      paidDate?: string;
      penaltyAmount?: number;
    },
  ) {
    const admin = this.supabase.getAdminClient();
    const args: Record<string, unknown> = {
      p_repayment_id: repaymentId,
      p_amount: dto.amount,
      p_payment_method: dto.paymentMethod || "cash",
      p_account_id: dto.accountId || null,
      p_transaction_reference: dto.transactionReference || `PAY-${Date.now()}`,
      p_paid_date: dto.paidDate || new Date().toISOString().slice(0, 10),
    };
    if (dto.penaltyAmount !== undefined && dto.penaltyAmount > 0) {
      args.p_penalty_amount = dto.penaltyAmount;
    }
    const { data, error } = await admin.rpc("record_loan_payment", args);
    if (error) apiFail(HttpStatus.BAD_REQUEST, "PAYMENT_RPC_FAILED", error.message);
    const rpc = data as { success?: boolean; error?: string } | null;
    if (rpc && rpc.success === false) {
      apiFail(HttpStatus.CONFLICT, "PAYMENT_REJECTED", rpc.error || "Failed to record payment");
    }
    return { ok: true, data: rpc };
  }

  async createStaff(
    dto: { email: string; full_name: string; role: string; phone?: string | null },
    actor: AuthUser,
  ) {
    const isAdmin = actor.roles.includes("admin") || actor.roles.includes("super_admin");
    if (!isAdmin) apiFail(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "Only admins can create staff users");

    const validRoles = [
      "super_admin",
      "admin",
      "loan_officer",
      "credit_officer",
      "finance_officer",
      "collections_officer",
      "auditor",
      "support",
    ];
    if (!validRoles.includes(dto.role)) {
      apiFail(HttpStatus.BAD_REQUEST, "INVALID_ROLE", `Invalid role: ${dto.role}`);
    }

    const email = dto.email.trim().toLowerCase();
    const full_name = dto.full_name.trim();
    if (!email || !full_name) apiFail(HttpStatus.BAD_REQUEST, "FIELDS_REQUIRED", "email and full_name are required");

    const admin = this.supabase.getAdminClient();
    const tempPassword = `${randomUUID().slice(0, 12)}A1!`;
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createError || !newUser.user) {
      apiFail(HttpStatus.BAD_REQUEST, "CREATE_STAFF_FAILED", createError?.message || "Failed to create staff user");
    }

    const userId = newUser.user.id;
    await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      phone: dto.phone || null,
    });
    const { error: roleErr } = await admin.from("user_roles").upsert(
      { user_id: userId, role: dto.role },
      { onConflict: "user_id,role" },
    );
    if (roleErr) this.logger.warn(`staff role upsert: ${roleErr.message}`);

    return {
      ok: true,
      success: true,
      user_id: userId,
      temp_password: tempPassword,
      message: "Staff user created. Share the temporary password with them securely.",
    };
  }

  async applyPenalties(loanId: string) {
    const data = await this.rpc("apply_loan_penalties", { p_loan_id: loanId }, "PENALTY_RPC_FAILED");
    return { ok: true, data: Number(data || 0) };
  }

  async earlySettlementQuote(loanId: string) {
    const data = await this.rpc("calculate_early_settlement", { p_loan_id: loanId }, "SETTLEMENT_RPC_FAILED");
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true, data: row ?? null };
  }

  async reconcileCompletion(loanId: string) {
    const data = await this.rpcEnvelope(
      "admin_reconcile_loan_completion",
      { p_loan_id: loanId },
      "RECONCILE_RPC_FAILED",
    );
    return { ok: true, data };
  }

  async approveWriteOff(writeOffId: string) {
    const data = await this.rpcEnvelope(
      "admin_approve_loan_writeoff",
      { p_writeoff_id: writeOffId },
      "WRITEOFF_APPROVE_FAILED",
    );
    return { ok: true, data };
  }

  async rejectWriteOff(writeOffId: string, reason: string) {
    if (!reason?.trim()) apiFail(HttpStatus.BAD_REQUEST, "REASON_REQUIRED", "Rejection reason is required");
    const data = await this.rpcEnvelope(
      "admin_reject_loan_writeoff",
      { p_writeoff_id: writeOffId, p_reason: reason.trim() },
      "WRITEOFF_REJECT_FAILED",
    );
    return { ok: true, data };
  }

  async recoverWriteOff(writeOffId: string, amount: number, notes?: string) {
    const data = await this.rpcEnvelope(
      "admin_record_writeoff_recovery",
      { p_writeoff_id: writeOffId, p_amount: amount, p_notes: notes || "" },
      "WRITEOFF_RECOVERY_FAILED",
    );
    return { ok: true, data };
  }

  async setExpenseStatus(expenseId: string, status: string, rejectReason?: string) {
    const data = await this.rpcEnvelope(
      "admin_set_expense_status",
      {
        p_expense_id: expenseId,
        p_new_status: status,
        p_reject_reason: rejectReason ?? null,
      },
      "EXPENSE_STATUS_FAILED",
    );
    return { ok: true, data };
  }

  async shiftPendingRepayments() {
    const admin = this.supabase.getAdminClient();
    const { data, error } = await admin.rpc("shift_pending_repayments_to_business_days");
    if (error) apiFail(HttpStatus.BAD_REQUEST, "SHIFT_REPAYMENTS_FAILED", error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true, data: row ?? data };
  }

  async reversePayment(repaymentId: string, reason: string, actor: AuthUser) {
    const why = reason.trim();
    if (!why) apiFail(HttpStatus.BAD_REQUEST, "REASON_REQUIRED", "Reversal reason is required");
    const admin = this.supabase.getAdminClient();

    const { data: repayment, error: repErr } = await admin
      .from("loan_repayments")
      .select("id, loan_id, amount, original_amount, principal_paid, installment_number, status")
      .eq("id", repaymentId)
      .maybeSingle();
    if (repErr) apiFail(HttpStatus.BAD_REQUEST, "REPAYMENT_LOOKUP_FAILED", repErr.message);
    if (!repayment) apiFail(HttpStatus.NOT_FOUND, "REPAYMENT_NOT_FOUND", "Repayment not found");
    if (repayment.status !== "paid" && repayment.status !== "partial") {
      apiFail(HttpStatus.CONFLICT, "NOT_REVERSIBLE", "Only paid or partial installments can be reversed");
    }

    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id, status, full_name")
      .eq("id", repayment.loan_id)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");

    const refundAmount = Number(repayment.principal_paid || repayment.amount || 0);
    const { data: tx } = await admin
      .from("account_transactions")
      .select("id, account_id, amount")
      .eq("reference_type", "repayment")
      .eq("reference_id", repaymentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tx?.account_id && refundAmount > 0) {
      const { data: account, error: accErr } = await admin
        .from("accounts")
        .select("id, balance")
        .eq("id", tx.account_id)
        .maybeSingle();
      if (accErr) apiFail(HttpStatus.BAD_REQUEST, "ACCOUNT_LOOKUP_FAILED", accErr.message);
      if (account) {
        const balanceBefore = Number(account.balance);
        const balanceAfter = balanceBefore - refundAmount;
        if (balanceAfter < 0) {
          apiFail(
            HttpStatus.CONFLICT,
            "INSUFFICIENT_BALANCE",
            `Cannot reverse: account balance (K${balanceBefore.toLocaleString()}) is less than the refund (K${refundAmount.toLocaleString()}).`,
          );
        }
        const { error: balErr } = await admin
          .from("accounts")
          .update({ balance: balanceAfter, updated_at: new Date().toISOString() })
          .eq("id", account.id);
        if (balErr) apiFail(HttpStatus.BAD_REQUEST, "ACCOUNT_UPDATE_FAILED", balErr.message);
        const { error: txErr } = await admin.from("account_transactions").insert({
          account_id: account.id,
          transaction_type: "adjustment_debit",
          amount: refundAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          destination: "Payment reversal",
          reference_type: "repayment_reversal",
          reference_id: repaymentId,
          notes: `Reversal of installment #${repayment.installment_number ?? "?"} for ${loan.full_name}: ${why}`,
          created_by: actor.userId,
        });
        if (txErr) apiFail(HttpStatus.BAD_REQUEST, "LEDGER_INSERT_FAILED", txErr.message);
      }
    }

    const { error: updErr } = await admin
      .from("loan_repayments")
      .update({
        status: "pending",
        paid_date: null,
        payment_method: null,
        transaction_reference: null,
        is_reversed: true,
        reversed_at: new Date().toISOString(),
        reversed_by: actor.userId,
        reversal_reason: why,
        principal_paid: 0,
        interest_paid: 0,
        penalty_paid: 0,
        amount: repayment.original_amount || repayment.amount,
      })
      .eq("id", repaymentId);
    if (updErr) apiFail(HttpStatus.BAD_REQUEST, "REPAYMENT_UPDATE_FAILED", updErr.message);

    if (loan.status === "completed") {
      const { error: statusErr } = await admin
        .from("loan_applications")
        .update({ status: "active" })
        .eq("id", loan.id);
      if (statusErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_STATUS_FAILED", statusErr.message);
    }

    await admin.from("collection_activities").insert({
      loan_id: loan.id,
      activity_type: "payment_reversal",
      notes: `Payment of K${refundAmount.toLocaleString()} reversed. Reason: ${why}`,
      outcome: tx ? "Payment reverted; account debited" : "Payment reverted (no source account on record)",
    });

    return { ok: true, data: { repaymentId, refundAmount, loanId: loan.id } };
  }

  async undoDisbursement(loanId: string, actor: AuthUser) {
    const admin = this.supabase.getAdminClient();
    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id, status, full_name")
      .eq("id", loanId)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");

    const { count } = await admin
      .from("loan_repayments")
      .select("id", { count: "exact", head: true })
      .eq("loan_id", loanId)
      .in("status", ["paid", "partial"]);
    if ((count || 0) > 0) {
      apiFail(HttpStatus.CONFLICT, "HAS_PAYMENTS", "Cannot undo disbursement after payments have been recorded");
    }

    const { data: disbursement } = await admin
      .from("disbursements")
      .select("id, source_account_id, amount")
      .eq("loan_id", loanId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (disbursement?.source_account_id) {
      const { data: sourceAccount, error: accErr } = await admin
        .from("accounts")
        .select("id, balance, account_name")
        .eq("id", disbursement.source_account_id)
        .maybeSingle();
      if (accErr) apiFail(HttpStatus.BAD_REQUEST, "ACCOUNT_LOOKUP_FAILED", accErr.message);
      if (sourceAccount) {
        const refundAmount = Number(disbursement.amount);
        const newBalance = Number(sourceAccount.balance) + refundAmount;
        const { error: undoAccErr } = await admin
          .from("accounts")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("id", sourceAccount.id);
        if (undoAccErr) apiFail(HttpStatus.BAD_REQUEST, "ACCOUNT_UPDATE_FAILED", undoAccErr.message);
        const { error: undoTxErr } = await admin.from("account_transactions").insert({
          account_id: sourceAccount.id,
          transaction_type: "refund",
          amount: refundAmount,
          balance_before: Number(sourceAccount.balance),
          balance_after: newBalance,
          reference_type: "disbursement_reversal",
          reference_id: loanId,
          source: "Disbursement Reversal",
          destination: sourceAccount.account_name,
          notes: `Undo disbursement for ${loan.full_name} — K${refundAmount.toLocaleString()} refunded`,
          created_by: actor.userId,
        });
        if (undoTxErr) apiFail(HttpStatus.BAD_REQUEST, "LEDGER_INSERT_FAILED", undoTxErr.message);
      }
    }

    const { error: delDisbErr } = await admin.from("disbursements").delete().eq("loan_id", loanId);
    if (delDisbErr) apiFail(HttpStatus.BAD_REQUEST, "DISBURSE_DELETE_FAILED", delDisbErr.message);
    const { error: delRepErr } = await admin.from("loan_repayments").delete().eq("loan_id", loanId);
    if (delRepErr) apiFail(HttpStatus.BAD_REQUEST, "SCHEDULE_DELETE_FAILED", delRepErr.message);
    const { error: statusErr } = await admin.from("loan_applications").update({ status: "approved" }).eq("id", loanId);
    if (statusErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_STATUS_FAILED", statusErr.message);

    return { ok: true, data: { loanId, refunded_amount: disbursement?.amount ?? null } };
  }

  async deleteLoan(loanId: string, reason: string | undefined, actor: AuthUser) {
    const deletable = new Set([
      "pending",
      "under_review",
      "approved",
      "contract_signing",
      "awaiting_disbursement",
      "rejected",
      "crb_failed",
      "pmic_pending",
    ]);
    const admin = this.supabase.getAdminClient();
    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id, status")
      .eq("id", loanId)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");
    if (!deletable.has(loan.status)) {
      apiFail(
        HttpStatus.CONFLICT,
        "NOT_DELETABLE",
        `Cannot delete a loan in status "${loan.status}". Undo disbursement first.`,
      );
    }

    await admin.from("loan_repayments").delete().eq("loan_id", loanId);
    await admin.from("disbursements").delete().eq("loan_id", loanId);
    await admin.from("loan_status_transitions").delete().eq("loan_id", loanId);
    await admin.from("loan_events").delete().eq("loan_id", loanId);
    const { error } = await admin.from("loan_applications").delete().eq("id", loanId);
    if (error) apiFail(HttpStatus.BAD_REQUEST, "LOAN_DELETE_FAILED", error.message);

    this.logger.log(`loan_deleted ${loanId} by ${actor.userId} reason=${reason || ""}`);
    return { ok: true, data: { loanId, previous_status: loan.status } };
  }

  async createPendingDisbursement(
    dto: {
      loanId: string;
      amount: number;
      disbursementMethod: string;
      sourceAccountId: string;
      mobileMoneyNumber?: string | null;
      accountNumber?: string | null;
    },
  ) {
    const admin = this.supabase.getAdminClient();
    const { data: inserted, error } = await admin
      .from("disbursements")
      .insert({
        loan_id: dto.loanId,
        amount: dto.amount,
        disbursement_method: dto.disbursementMethod,
        mobile_money_number: dto.mobileMoneyNumber || null,
        account_number: dto.accountNumber || null,
        status: "pending",
        source_account_id: dto.sourceAccountId,
      })
      .select("id")
      .single();
    if (error || !inserted?.id) {
      apiFail(HttpStatus.BAD_REQUEST, "DISBURSE_INSERT_FAILED", error?.message || "Could not create disbursement");
    }
    return { ok: true, data: { id: inserted.id } };
  }

  private async rpc(fn: string, args: Record<string, unknown>, failCode: string) {
    const admin = this.supabase.getAdminClient();
    const { data, error } = await admin.rpc(fn, args);
    if (error) apiFail(HttpStatus.BAD_REQUEST, failCode, error.message);
    return data;
  }

  private async rpcEnvelope(fn: string, args: Record<string, unknown>, failCode: string) {
    const data = await this.rpc(fn, args, failCode);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const row = data as { success?: boolean; ok?: boolean; error?: string };
      if (row.success === false || row.ok === false) {
        apiFail(HttpStatus.CONFLICT, `${failCode}_REJECTED`, row.error || "Operation failed");
      }
    }
    return data;
  }
}
