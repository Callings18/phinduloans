import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth-user";
import { SupabaseService } from "../auth/supabase.service";
import { apiFail } from "../common/http";
import { roundZmw } from "../money/as-money";
import { insertRepaymentSchedule } from "./repayment-schedule";
import type { ReloanDto, RestructureLoanDto, TopUpLoanDto } from "./dto/core-writes.dto";

const PRE_MONEY_STATUSES = new Set([
  "pending",
  "under_review",
  "approved",
  "contract_signing",
  "awaiting_disbursement",
  "rejected",
  "crb_failed",
  "pmic_pending",
]);

const MONEY_STATUSES = new Set(["disbursed", "active", "completed", "defaulted"]);

const SAFE_ON_ACTIVE_KEYS = new Set([
  "admin_notes",
  "contract_url",
  "approval_stage",
  "document_verified_by",
  "document_verified_at",
  "recommended_by",
  "recommended_at",
  "approved_by",
  "approved_at",
  "reviewed_by",
  "reviewed_at",
  "updated_at",
  "assigned_to",
]);

const LOAN_PATCH_KEYS = new Set([
  "loan_amount",
  "loan_term_months",
  "loan_purpose",
  "collateral_description",
  "collateral_value",
  "full_name",
  "email",
  "phone",
  "nrc_number",
  "address",
  "city",
  "monthly_income",
  "employer_name",
  "job_title",
  "employment_type",
  "employment_duration",
  "admin_notes",
  "total_repayment",
  "monthly_payment",
  "interest_rate",
  "repayment_start_date",
  "product_specific_data",
  "status",
  "term_unit",
  "contract_url",
  "signed_contract_url",
  "borrower_signed",
  "borrower_signed_at",
  "admin_signed",
  "admin_signed_at",
  "admin_signed_by",
  "signed_contract_uploaded_at",
  "assigned_to",
  "document_verified_by",
  "document_verified_at",
  "recommended_by",
  "recommended_at",
  "approval_stage",
  "approved_by",
  "approved_at",
  "reviewed_by",
  "reviewed_at",
  "updated_at",
  "rejection_reason",
]);

const PROFILE_PATCH_KEYS = new Set([
  "full_name",
  "email",
  "phone",
  "nrc_number",
  "address",
  "city",
  "employer_name",
  "job_title",
  "employment_type",
  "net_income",
  "gender",
  "marital_status",
]);

function pickLoanPatch(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (LOAN_PATCH_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function pickProfilePatch(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (PROFILE_PATCH_KEYS.has(key)) out[key] = value;
  }
  return out;
}

const LEGACY_DOC_COLUMNS: Record<string, string> = {
  payslip_1: "payslip_url",
  payslip_2: "payslip_2_url",
  payslip_3: "payslip_3_url",
  bank_statement_1: "bank_statement_url",
  nrc_front: "nrc_front_url",
  nrc_back: "nrc_back_url",
  selfie_holding_nrc: "selfie_url",
  selfie: "selfie_url",
  collateral_image_1: "collateral_image_url",
  collateral_image_2: "collateral_image_2_url",
  collateral_image_3: "collateral_image_3_url",
};

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

  async updateLoan(
    loanId: string,
    dto: {
      application?: Record<string, unknown>;
      borrowers?: Record<string, unknown>[];
      profile?: Record<string, unknown>;
      profileUserId?: string;
    },
    actor: AuthUser,
  ) {
    const admin = this.supabase.getAdminClient();
    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id, status, user_id, loan_product_id")
      .eq("id", loanId)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");

    const patch = pickLoanPatch(dto.application || {});
    this.assertLoanPatchAllowed(loan.status, patch);

    if (Object.keys(patch).length > 0) {
      const { error: updErr } = await admin.from("loan_applications").update(patch).eq("id", loanId);
      if (updErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_UPDATE_FAILED", updErr.message);
    }

    if (dto.borrowers) {
      if (!PRE_MONEY_STATUSES.has(loan.status)) {
        apiFail(HttpStatus.CONFLICT, "NOT_EDITABLE", "Borrowers can only be changed before disbursement");
      }
      const { error: delErr } = await admin.from("loan_borrowers").delete().eq("loan_application_id", loanId);
      if (delErr) apiFail(HttpStatus.BAD_REQUEST, "BORROWERS_DELETE_FAILED", delErr.message);
      if (dto.borrowers.length > 0) {
        const rows = dto.borrowers.map((row) => ({
          ...row,
          loan_application_id: loanId,
          created_by: actor.userId,
        }));
        const { error: insErr } = await admin.from("loan_borrowers").insert(rows);
        if (insErr) apiFail(HttpStatus.BAD_REQUEST, "BORROWERS_INSERT_FAILED", insErr.message);
      }
    }

    if (dto.profile) {
      const profileId = dto.profileUserId || loan.user_id;
      if (!profileId) apiFail(HttpStatus.BAD_REQUEST, "PROFILE_USER_REQUIRED", "No borrower id for profile update");
      const profilePatch = pickProfilePatch(dto.profile);
      if (Object.keys(profilePatch).length > 0) {
        const { error: profErr } = await admin.from("profiles").update(profilePatch).eq("id", profileId);
        if (profErr) apiFail(HttpStatus.BAD_REQUEST, "PROFILE_UPDATE_FAILED", profErr.message);
      }
    }

    return { ok: true, data: { id: loanId } };
  }

  async registerLoanDocuments(
    loanId: string,
    documents: Array<{
      borrower_id: string;
      doc_type: string;
      doc_label: string;
      file_url: string;
      file_name: string;
      mime_type?: string | null;
      file_size?: number | null;
      loan_product_id?: string | null;
      saveToVault?: boolean;
    }>,
    actor: AuthUser,
  ) {
    if (!documents?.length) apiFail(HttpStatus.BAD_REQUEST, "DOCS_REQUIRED", "No documents to register");
    const admin = this.supabase.getAdminClient();
    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id, user_id, loan_product_id")
      .eq("id", loanId)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");
    if (actor.actorType !== "admin" && loan.user_id !== actor.userId) {
      apiFail(HttpStatus.FORBIDDEN, "FORBIDDEN", "You can only attach documents to your own application");
    }

    const rows = documents.map((doc) => ({
      application_id: loanId,
      borrower_id: doc.borrower_id,
      doc_type: doc.doc_type,
      doc_label: doc.doc_label,
      file_url: doc.file_url,
      file_name: doc.file_name,
      mime_type: doc.mime_type || null,
      file_size: doc.file_size ?? null,
      loan_product_id: doc.loan_product_id ?? loan.loan_product_id,
      uploaded_by: actor.userId,
      status: "uploaded",
    }));
    const { error: docErr } = await admin.from("application_documents").insert(rows);
    if (docErr) apiFail(HttpStatus.BAD_REQUEST, "DOCUMENT_INSERT_FAILED", docErr.message);

    const vaultRows = documents
      .filter((d) => d.saveToVault !== false)
      .map((doc) => ({
        borrower_id: doc.borrower_id,
        doc_type: doc.doc_type,
        doc_label: doc.doc_label,
        file_url: doc.file_url,
        file_name: doc.file_name,
        mime_type: doc.mime_type || null,
        file_size: doc.file_size ?? null,
      }));
    if (vaultRows.length > 0) {
      const { error: vaultErr } = await admin.from("borrower_document_vault").insert(vaultRows);
      if (vaultErr) this.logger.warn(`vault insert: ${vaultErr.message}`);
    }

    const legacyPatch: Record<string, string> = {};
    for (const doc of documents) {
      const col = LEGACY_DOC_COLUMNS[doc.doc_type];
      if (col) legacyPatch[col] = doc.file_url;
    }
    if (Object.keys(legacyPatch).length > 0) {
      const { error: legacyErr } = await admin.from("loan_applications").update(legacyPatch).eq("id", loanId);
      if (legacyErr) this.logger.warn(`legacy doc columns: ${legacyErr.message}`);
    }

    return { ok: true, data: { count: rows.length } };
  }

  async addLoanNote(
    loanId: string,
    dto: { note: string; visibleToBorrower?: boolean },
    actor: AuthUser,
  ) {
    const text = dto.note.trim();
    if (!text) apiFail(HttpStatus.BAD_REQUEST, "NOTE_REQUIRED", "Note text is required");
    const admin = this.supabase.getAdminClient();
    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id")
      .eq("id", loanId)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");
    const visible = Boolean(dto.visibleToBorrower);
    const { data: inserted, error } = await admin
      .from("loan_notes")
      .insert({
        loan_id: loanId,
        user_id: actor.userId,
        note: text,
        note_type: visible ? "visible_to_borrower" : "internal",
        is_internal: !visible,
      })
      .select("id")
      .single();
    if (error || !inserted) apiFail(HttpStatus.BAD_REQUEST, "NOTE_INSERT_FAILED", error?.message ?? "Could not add note");
    return { ok: true, data: { id: inserted.id } };
  }

  async listLoanDrafts(filters: { borrowerId?: string; productCode?: string }) {
    const admin = this.supabase.getAdminClient();
    let q = admin
      .from("loan_application_drafts")
      .select("id, staff_user_id, borrower_id, product_code, form_data, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (filters.borrowerId) q = q.eq("borrower_id", filters.borrowerId);
    if (filters.productCode) q = q.eq("product_code", filters.productCode);
    const { data, error } = await q;
    if (error) apiFail(HttpStatus.BAD_REQUEST, "DRAFT_LIST_FAILED", error.message);
    return { ok: true, data: data ?? [] };
  }

  async getLoanDraft(draftId: string) {
    const admin = this.supabase.getAdminClient();
    const { data, error } = await admin
      .from("loan_application_drafts")
      .select("id, staff_user_id, borrower_id, product_code, form_data, created_at, updated_at")
      .eq("id", draftId)
      .maybeSingle();
    if (error) apiFail(HttpStatus.BAD_REQUEST, "DRAFT_LOOKUP_FAILED", error.message);
    if (!data) apiFail(HttpStatus.NOT_FOUND, "DRAFT_NOT_FOUND", "Draft not found");
    return { ok: true, data };
  }

  async upsertLoanDraft(
    dto: { borrowerId: string; productCode: string; formData: Record<string, unknown> },
    actor: AuthUser,
  ) {
    if (!dto.borrowerId) apiFail(HttpStatus.BAD_REQUEST, "BORROWER_REQUIRED", "Select a borrower before saving a draft");
    if (!dto.productCode) apiFail(HttpStatus.BAD_REQUEST, "PRODUCT_REQUIRED", "Product code is required");
    const admin = this.supabase.getAdminClient();
    const { data, error } = await admin
      .from("loan_application_drafts")
      .upsert(
        {
          staff_user_id: actor.userId,
          borrower_id: dto.borrowerId,
          product_code: dto.productCode,
          form_data: dto.formData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "staff_user_id,borrower_id,product_code" },
      )
      .select("id, updated_at")
      .single();
    if (error || !data) apiFail(HttpStatus.BAD_REQUEST, "DRAFT_SAVE_FAILED", error?.message ?? "Could not save draft");
    return { ok: true, data };
  }

  async deleteLoanDraft(draftId: string) {
    const admin = this.supabase.getAdminClient();
    const { error } = await admin.from("loan_application_drafts").delete().eq("id", draftId);
    if (error) apiFail(HttpStatus.BAD_REQUEST, "DRAFT_DELETE_FAILED", error.message);
    return { ok: true, data: { id: draftId } };
  }

  async createWriteOff(dto: { loanId: string; amount: number; reason: string }, actor: AuthUser) {
    const reason = dto.reason.trim();
    if (!reason) apiFail(HttpStatus.BAD_REQUEST, "REASON_REQUIRED", "Write-off reason is required");
    const admin = this.supabase.getAdminClient();
    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id, status")
      .eq("id", dto.loanId)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");
    const amount = roundZmw(dto.amount);
    const { data: inserted, error } = await admin
      .from("loan_writeoffs")
      .insert({
        loan_id: dto.loanId,
        writeoff_amount: amount,
        reason,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !inserted) apiFail(HttpStatus.BAD_REQUEST, "WRITEOFF_INSERT_FAILED", error?.message ?? "Could not create write-off");
    await admin.from("collection_activities").insert({
      loan_id: dto.loanId,
      activity_type: "writeoff_initiated",
      notes: `Write-off initiated for K${amount.toLocaleString()}. Reason: ${reason}`,
      outcome: "Pending approval",
      staff_id: actor.userId,
    });
    this.logger.log(`writeoff_created ${inserted.id} loan=${dto.loanId} by ${actor.userId}`);
    return { ok: true, data: { id: inserted.id } };
  }

  async borrowerSignContract(loanId: string, signedContractUrl: string, actor: AuthUser) {
    const path = signedContractUrl.trim();
    if (!path) apiFail(HttpStatus.BAD_REQUEST, "CONTRACT_REQUIRED", "Signed contract path is required");
    const admin = this.supabase.getAdminClient();
    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id, user_id, status")
      .eq("id", loanId)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");
    if (actor.actorType !== "admin" && loan.user_id !== actor.userId) {
      apiFail(HttpStatus.FORBIDDEN, "FORBIDDEN", "You can only sign your own loan contract");
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      signed_contract_url: path,
      signed_contract_uploaded_at: now,
      borrower_signed: true,
      borrower_signed_at: now,
    };
    if (loan.status === "approved" || loan.status === "contract_signing") {
      patch.status = "awaiting_disbursement";
      patch.updated_at = now;
    }
    const { error: updErr } = await admin.from("loan_applications").update(patch).eq("id", loanId);
    if (updErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_UPDATE_FAILED", updErr.message);
    return { ok: true, data: { id: loanId, status: patch.status || loan.status } };
  }

  private assertLoanPatchAllowed(currentStatus: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch);
    if (keys.length === 0) return;
    const statusTarget = typeof patch.status === "string" ? patch.status : null;
    if (statusTarget && statusTarget !== currentStatus) {
      const allowed =
        PRE_MONEY_STATUSES.has(currentStatus) ||
        (currentStatus === "disbursed" && (statusTarget === "active" || statusTarget === "approved"));
      if (!allowed) {
        apiFail(
          HttpStatus.CONFLICT,
          "STATUS_LOCKED",
          `Cannot move a ${currentStatus} loan to ${statusTarget} from this endpoint.`,
        );
      }
    }
    const onlySafe = keys.every((k) => SAFE_ON_ACTIVE_KEYS.has(k));
    const onlyStatusAndSafe = keys.every((k) => k === "status" || SAFE_ON_ACTIVE_KEYS.has(k));
    if (MONEY_STATUSES.has(currentStatus) && !onlySafe) {
      if (!(currentStatus === "disbursed" && onlyStatusAndSafe)) {
        apiFail(
          HttpStatus.CONFLICT,
          "NOT_EDITABLE",
          "Active or completed loans can only receive notes, contract, or workflow metadata here.",
        );
      }
    }
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
      p_amount: roundZmw(dto.amount),
      p_payment_method: dto.paymentMethod || "cash",
      p_account_id: dto.accountId || null,
      p_transaction_reference: dto.transactionReference || `PAY-${Date.now()}`,
      p_paid_date: dto.paidDate || new Date().toISOString().slice(0, 10),
    };
    if (dto.penaltyAmount !== undefined && dto.penaltyAmount > 0) {
      args.p_penalty_amount = roundZmw(dto.penaltyAmount);
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
        amount: roundZmw(dto.amount),
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

  async generateSchedule(loanId: string, regenerateRemaining: boolean) {
    const admin = this.supabase.getAdminClient();
    const { data: loan, error } = await admin
      .from("loan_applications")
      .select(
        "id, user_id, loan_term_months, total_repayment, monthly_payment, loan_product_id, term_unit, repayment_start_date, disbursed_at",
      )
      .eq("id", loanId)
      .maybeSingle();
    if (error) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", error.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");
    try {
      await insertRepaymentSchedule(admin, loan, { regenerateRemaining });
    } catch (err) {
      apiFail(HttpStatus.BAD_REQUEST, "SCHEDULE_FAILED", err instanceof Error ? err.message : "Could not generate schedule");
    }
    return { ok: true, data: { id: loanId } };
  }

  async reloan(loanId: string, dto: ReloanDto, actor: AuthUser) {
    const admin = this.supabase.getAdminClient();
    await this.assertNoUnpaidPenalties(admin, loanId);

    const { data: parent, error: parentErr } = await admin.from("loan_applications").select("*").eq("id", loanId).maybeSingle();
    if (parentErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", parentErr.message);
    if (!parent) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");

    const optionalTopUp = Number(dto.optionalTopUpAmount || 0);
    const topUpNet = Number(dto.topUpNetDisbursement || 0);
    const topUpFees = Number(dto.topUpFees || 0);
    if (optionalTopUp > 0) {
      if (!dto.sourceAccountId) apiFail(HttpStatus.BAD_REQUEST, "ACCOUNT_REQUIRED", "Select a source account for the optional top-up");
      if (topUpNet <= 0) apiFail(HttpStatus.BAD_REQUEST, "TOPUP_TOO_SMALL", "Optional top-up is too small after fees");
    }

    const reloanIso = new Date(`${dto.reloanDate}T12:00:00Z`).toISOString();
    const { error: closeError } = await admin
      .from("loan_applications")
      .update({ status: "completed", admin_notes: dto.parentNotes })
      .eq("id", loanId);
    if (closeError) apiFail(HttpStatus.BAD_REQUEST, "PARENT_CLOSE_FAILED", closeError.message);

    // Insert as approved first so the active-status trigger does not generate a CURRENT_DATE schedule.
    const { data: newLoan, error: insertError } = await admin
      .from("loan_applications")
      .insert({
        user_id: parent.user_id,
        full_name: parent.full_name,
        email: parent.email,
        phone: parent.phone,
        nrc_number: parent.nrc_number,
        address: parent.address || null,
        city: parent.city || null,
        date_of_birth: parent.date_of_birth || null,
        employer_name: parent.employer_name || null,
        employer_id: parent.employer_id || null,
        job_title: parent.job_title || null,
        employment_type: parent.employment_type,
        employment_duration: parent.employment_duration || null,
        monthly_income: parent.monthly_income || 0,
        loan_amount: dto.newPrincipal,
        loan_term_months: dto.newTermMonths,
        term_unit: dto.termUnit || parent.term_unit,
        interest_rate: dto.interestRate,
        monthly_payment: dto.monthlyPayment,
        total_repayment: dto.totalRepayment,
        loan_purpose: parent.loan_purpose,
        loan_product_id: parent.loan_product_id || null,
        parent_loan_id: parent.id,
        status: "approved",
        source: "reloan",
        repayment_start_date: dto.reloanDate,
        admin_notes: dto.childNotes,
        disbursed_by: actor.userId,
        disbursed_at: reloanIso,
        approved_by: actor.userId,
        approved_at: reloanIso,
      })
      .select("id, user_id, loan_term_months, total_repayment, monthly_payment, loan_product_id")
      .single();
    if (insertError || !newLoan?.id) {
      apiFail(HttpStatus.BAD_REQUEST, "RELOAN_INSERT_FAILED", insertError?.message || "Could not create reloan");
    }

    try {
      await insertRepaymentSchedule(admin, {
        id: newLoan.id,
        user_id: newLoan.user_id,
        loan_term_months: newLoan.loan_term_months,
        total_repayment: newLoan.total_repayment,
        monthly_payment: newLoan.monthly_payment,
        loan_product_id: newLoan.loan_product_id,
        term_unit: dto.termUnit || parent.term_unit,
        repayment_start_date: dto.reloanDate,
        disbursed_at: reloanIso,
      });
    } catch (err) {
      apiFail(HttpStatus.BAD_REQUEST, "SCHEDULE_FAILED", err instanceof Error ? err.message : "Could not generate schedule");
    }

    if (optionalTopUp > 0 && dto.sourceAccountId) {
      const { data: topUpDisb, error: disbInsertErr } = await admin
        .from("disbursements")
        .insert({
          loan_id: newLoan.id,
          amount: topUpNet,
          disbursement_method: "cash",
          status: "pending",
          source_account_id: dto.sourceAccountId,
          transaction_reference: `RELOAN-TOPUP-${String(newLoan.id).slice(0, 8).toUpperCase()}`,
          is_top_up: true,
        })
        .select("id")
        .single();
      if (disbInsertErr || !topUpDisb?.id) {
        apiFail(HttpStatus.BAD_REQUEST, "DISBURSE_INSERT_FAILED", disbInsertErr?.message || "Could not create reloan top-up disbursement");
      }
      try {
        await this.completeDisbursementRpc(
          admin,
          topUpDisb.id,
          dto.sourceAccountId,
          `RELOAN-TOPUP-${String(newLoan.id).slice(0, 8).toUpperCase()}`,
        );
      } catch (err) {
        await admin.from("disbursements").delete().eq("id", topUpDisb.id);
        throw err;
      }
    }

    const { error: ev1 } = await admin.from("loan_events").insert({
      loan_id: parent.id,
      event_type: "reloan",
      performed_by: actor.userId,
      reason: dto.parentEventReason || "Reloan",
      previous_values: dto.previousValues || {},
      new_values: dto.newValues || {},
      new_loan_id: newLoan.id,
      amount: dto.newPrincipal,
    });
    if (ev1) apiFail(HttpStatus.BAD_REQUEST, "EVENT_INSERT_FAILED", ev1.message);

    const { error: ev2 } = await admin.from("loan_events").insert({
      loan_id: newLoan.id,
      event_type: "reloan_created",
      performed_by: actor.userId,
      reason: dto.childEventReason || `Created from loan ${String(parent.id).slice(0, 8).toUpperCase()}`,
      previous_values: { parent_loan_id: parent.id, original_principal: parent.loan_amount },
      new_values: dto.newValues || { principal: dto.newPrincipal, total_repayment: dto.totalRepayment },
      amount: dto.newPrincipal,
    });
    if (ev2) apiFail(HttpStatus.BAD_REQUEST, "EVENT_INSERT_FAILED", ev2.message);

    return { ok: true, data: { id: newLoan.id, newPrincipal: dto.newPrincipal } };
  }

  async topUpLoan(loanId: string, dto: TopUpLoanDto, actor: AuthUser) {
    const admin = this.supabase.getAdminClient();
    await this.assertNoUnpaidPenalties(admin, loanId);

    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id, user_id, loan_term_months, loan_product_id, term_unit, full_name, admin_notes")
      .eq("id", loanId)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");

    const termMonths = dto.newTermMonths || loan.loan_term_months;
    const { error: loanUpdErr } = await admin
      .from("loan_applications")
      .update({
        loan_amount: dto.newPrincipal,
        total_repayment: dto.newTotalRepayment,
        monthly_payment: dto.newMonthlyPayment,
        loan_term_months: termMonths,
        admin_notes: dto.notes,
      })
      .eq("id", loanId);
    if (loanUpdErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_UPDATE_FAILED", loanUpdErr.message);

    const { error: cancelErr } = await admin
      .from("loan_repayments")
      .update({ status: "cancelled" })
      .eq("loan_id", loanId)
      .in("status", ["pending", "overdue"]);
    if (cancelErr) apiFail(HttpStatus.BAD_REQUEST, "SCHEDULE_CANCEL_FAILED", cancelErr.message);

    try {
      await insertRepaymentSchedule(
        admin,
        {
          id: loan.id,
          user_id: loan.user_id,
          loan_term_months: termMonths,
          total_repayment: dto.newTotalRepayment,
          monthly_payment: dto.newMonthlyPayment,
          loan_product_id: loan.loan_product_id,
          term_unit: dto.termUnit || loan.term_unit,
        },
        { regenerateRemaining: true },
      );
    } catch (err) {
      apiFail(HttpStatus.BAD_REQUEST, "SCHEDULE_FAILED", err instanceof Error ? err.message : "Could not regenerate schedule");
    }

    await this.insertAndCompleteTopUpDisbursement(admin, {
      loanId,
      amount: dto.netDisbursement,
      sourceAccountId: dto.sourceAccountId,
    });

    const { error: evErr } = await admin.from("loan_events").insert({
      loan_id: loanId,
      event_type: "top_up",
      performed_by: actor.userId,
      reason: dto.reason || "Top-up applied",
      previous_values: dto.previousValues || {},
      new_values: dto.newValues || {},
      amount: roundZmw(dto.additionalAmount),
      fees_charged: roundZmw(dto.totalFees),
      net_amount: roundZmw(dto.netDisbursement),
      source_account_id: dto.sourceAccountId,
    });
    if (evErr) apiFail(HttpStatus.BAD_REQUEST, "EVENT_INSERT_FAILED", evErr.message);

    return { ok: true, data: { additionalAmount: roundZmw(dto.additionalAmount), netDisbursement: roundZmw(dto.netDisbursement) } };
  }

  async restructureLoan(loanId: string, dto: RestructureLoanDto, actor: AuthUser) {
    const admin = this.supabase.getAdminClient();
    await this.assertNoUnpaidPenalties(admin, loanId);

    const { data: loan, error: loanErr } = await admin
      .from("loan_applications")
      .select("id, user_id, loan_product_id, term_unit")
      .eq("id", loanId)
      .maybeSingle();
    if (loanErr) apiFail(HttpStatus.BAD_REQUEST, "LOAN_LOOKUP_FAILED", loanErr.message);
    if (!loan) apiFail(HttpStatus.NOT_FOUND, "LOAN_NOT_FOUND", "Loan not found");

    const { error: loanError } = await admin
      .from("loan_applications")
      .update({
        loan_amount: dto.principal,
        loan_term_months: dto.newTermMonths,
        interest_rate: dto.newInterestRate,
        total_repayment: dto.newTotalRepayment,
        monthly_payment: dto.newMonthlyPayment,
        admin_notes: dto.notes,
      })
      .eq("id", loanId);
    if (loanError) apiFail(HttpStatus.BAD_REQUEST, "LOAN_UPDATE_FAILED", loanError.message);

    const { error: cancelErr } = await admin
      .from("loan_repayments")
      .update({ status: "cancelled" })
      .eq("loan_id", loanId)
      .in("status", ["pending", "overdue"]);
    if (cancelErr) apiFail(HttpStatus.BAD_REQUEST, "SCHEDULE_CANCEL_FAILED", cancelErr.message);

    try {
      await insertRepaymentSchedule(
        admin,
        {
          id: loan.id,
          user_id: loan.user_id,
          loan_term_months: dto.newTermMonths,
          total_repayment: dto.newTotalRepayment,
          monthly_payment: dto.newMonthlyPayment,
          loan_product_id: loan.loan_product_id,
          term_unit: dto.termUnit || loan.term_unit,
        },
        { regenerateRemaining: true },
      );
    } catch (err) {
      apiFail(HttpStatus.BAD_REQUEST, "SCHEDULE_FAILED", err instanceof Error ? err.message : "Could not regenerate schedule");
    }

    const { error: evErr } = await admin.from("loan_events").insert({
      loan_id: loanId,
      event_type: "restructure",
      performed_by: actor.userId,
      reason: dto.reason || "Loan restructured",
      previous_values: dto.previousValues || {},
      new_values: dto.newValues || {},
    });
    if (evErr) apiFail(HttpStatus.BAD_REQUEST, "EVENT_INSERT_FAILED", evErr.message);

    return { ok: true, data: { loanId } };
  }

  private async assertNoUnpaidPenalties(admin: ReturnType<SupabaseService["getAdminClient"]>, loanId: string) {
    const { data: openRows, error } = await admin
      .from("loan_repayments")
      .select("penalty_amount, penalty_paid")
      .eq("loan_id", loanId)
      .in("status", ["pending", "overdue", "partial"]);
    if (error) apiFail(HttpStatus.BAD_REQUEST, "PENALTY_LOOKUP_FAILED", error.message);
    const totalUnpaid = (openRows || []).reduce(
      (sum, r) => sum + Math.max(0, Number(r.penalty_amount || 0) - Number(r.penalty_paid || 0)),
      0,
    );
    if (totalUnpaid > 0.01) {
      apiFail(
        HttpStatus.CONFLICT,
        "PENALTIES_OUTSTANDING",
        `Cannot continue: K${totalUnpaid.toLocaleString()} in penalties must be cleared first.`,
      );
    }
  }

  private async insertAndCompleteTopUpDisbursement(
    admin: ReturnType<SupabaseService["getAdminClient"]>,
    args: { loanId: string; amount: number; sourceAccountId: string },
  ) {
    const ref = `TOP-UP-${String(args.loanId).slice(0, 8).toUpperCase()}`;
    const { data: inserted, error } = await admin
      .from("disbursements")
      .insert({
        loan_id: args.loanId,
        amount: args.amount,
        disbursement_method: "cash",
        status: "pending",
        source_account_id: args.sourceAccountId,
        transaction_reference: ref,
        is_top_up: true,
      })
      .select("id")
      .single();
    if (error || !inserted?.id) {
      apiFail(HttpStatus.BAD_REQUEST, "DISBURSE_INSERT_FAILED", error?.message || "Could not create top-up disbursement");
    }
    try {
      await this.completeDisbursementRpc(admin, inserted.id, args.sourceAccountId, ref);
    } catch (err) {
      await admin.from("disbursements").delete().eq("id", inserted.id);
      throw err;
    }
  }

  private async completeDisbursementRpc(
    admin: ReturnType<SupabaseService["getAdminClient"]>,
    disbursementId: string,
    accountId: string,
    transactionReference: string,
  ) {
    const { data, error } = await admin.rpc("complete_disbursement", {
      p_disbursement_id: disbursementId,
      p_account_id: accountId,
      p_transaction_reference: transactionReference,
    });
    if (error) apiFail(HttpStatus.BAD_REQUEST, "DISBURSE_RPC_FAILED", error.message);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const row = data as { success?: boolean; ok?: boolean; error?: string };
      if (row.success === false || row.ok === false) {
        apiFail(HttpStatus.CONFLICT, "DISBURSE_REJECTED", row.error || "Disbursement was rejected");
      }
    }
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
