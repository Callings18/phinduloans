/**
 * End-to-end integration test for the full loan flow.
 *
 * Runs staged borrower and staff journeys with authenticated clients. The
 * service-role client is used only for setup and read-only assertions.
 *
 * Auto-skips unless these env vars are set:
 *   E2E_SUPABASE_URL              (e.g. https://yqrfheavftgybhcafzpt.supabase.co)
 *   E2E_SUPABASE_SERVICE_ROLE_KEY (service role key — never commit)
 *   E2E_SUPABASE_PUBLISHABLE_KEY  (staging browser key)
 *   E2E_STAFF_USER_ID             (uuid of the seeded staging admin)
 *   E2E_STAFF_EMAIL / PASSWORD    (seeded staging admin credentials)
 *   E2E_PRODUCT_CODE              (optional, default: MARKETEER)
 *   E2E_FUNDING_ACCOUNT_ID        (uuid of synthetic staging funding account)
 *
 * Run locally:
 *   E2E_SUPABASE_URL=... E2E_SUPABASE_SERVICE_ROLE_KEY=... \
 *   E2E_STAFF_USER_ID=... npx vitest run tests/integration/loan-flow.full.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isProductionSupabaseUrl } from "../../supabase/functions/create-borrower/borrowerIdentity";

const URL = process.env.E2E_SUPABASE_URL;
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;
const STAFF_USER_ID = process.env.E2E_STAFF_USER_ID;
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;
const PRODUCT_CODE = process.env.E2E_PRODUCT_CODE || "MARKETEER";
const FUNDING_ACCOUNT_ID = process.env.E2E_FUNDING_ACCOUNT_ID || null;

const enabled = Boolean(
  URL && SERVICE_KEY && PUBLISHABLE_KEY && STAFF_USER_ID && STAFF_EMAIL && STAFF_PASSWORD && FUNDING_ACCOUNT_ID,
);
if (enabled && isProductionSupabaseUrl(URL)) {
  throw new Error("The mutation-based loan flow test refuses to run against the production Supabase project.");
}
const d = enabled ? describe : describe.skip;

d("loan flow (full) — staff can complete every stage without permission/product gaps", () => {
  let admin: SupabaseClient;
  let staff: SupabaseClient;
  let borrower: SupabaseClient;
  let borrowerUserId: string;
  let borrowerEmail: string;
  let borrowerPassword: string;
  let documentPath: string | null = null;
  let productId: string;
  let applicationId: string;
  let disbursementId: string;
  let fundingAccountId: string | null;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    staff = createClient(URL!, PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await staff.auth.signInWithPassword({
      email: STAFF_EMAIL!,
      password: STAFF_PASSWORD!,
    });
    expect(error, `Staging staff sign-in failed: ${error?.message}`).toBeNull();
    expect(data.user?.id).toBe(STAFF_USER_ID);
  });

  afterAll(async () => {
    if (documentPath && admin) {
      await admin.storage.from("loan-documents").remove([documentPath]);
    }
  });

  it("loads the active loan product by product_code (no 'product not found')", async () => {
    const { data, error } = await admin
      .from("loan_products")
      .select("id, product_code, is_active")
      .eq("product_code", PRODUCT_CODE)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    expect(error).toBeNull();
    expect(data?.length, `Active product ${PRODUCT_CODE} must exist`).toBeGreaterThan(0);
    productId = data![0].id as string;
  });

  it("staff role has all permissions needed for the full flow", async () => {
    // Pull staff roles
    const { data: roles, error: rolesErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", STAFF_USER_ID!);
    expect(rolesErr).toBeNull();
    const roleNames = (roles ?? []).map((r) => (r as any).role as string);
    expect(roleNames.length, "Staff user must have at least one role").toBeGreaterThan(0);

    const { data: perms, error: permsErr } = await admin
      .from("role_permissions")
      .select("permissions(module, action)")
      .in("role_name", roleNames);
    expect(permsErr).toBeNull();

    const flat = new Set(
      (perms ?? []).map((row: any) => `${row.permissions.module}:${row.permissions.action}`),
    );

    const isAdmin = roleNames.includes("admin") || roleNames.includes("super_admin");
    if (isAdmin) return; // admins bypass

    // Required for the end-to-end loan flow
    const required = [
      "borrowers:manage",
      "loans:create",
      "loans:verify_documents",
      "loans:approve",
      "disbursement:create",
      "repayments:record",
    ];
    for (const r of required) {
      expect(flat.has(r), `Staff role must include ${r}`).toBe(true);
    }
  });

  it("creates a borrower (auth user + profile)", async () => {
    borrowerEmail = `e2e-borrower-${Date.now()}@phindu.test`;
    borrowerPassword = `Test!${Date.now()}aB`;
    const { data, error } = await admin.auth.admin.createUser({
      email: borrowerEmail,
      password: borrowerPassword,
      email_confirm: true,
      user_metadata: { full_name: "E2E Test Borrower" },
    });
    expect(error).toBeNull();
    borrowerUserId = data.user!.id;

    // Profile is created by handle_new_user trigger; backfill if missing.
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", borrowerUserId)
      .maybeSingle();
    if (!profile) {
      await admin.from("profiles").insert({
        id: borrowerUserId,
        email: borrowerEmail,
        full_name: "E2E Test Borrower",
      });
    }

    borrower = createClient(URL!, PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await borrower.auth.signInWithPassword({
      email: borrowerEmail,
      password: borrowerPassword,
    });
    expect(signInError, `Staging borrower sign-in failed: ${signInError?.message}`).toBeNull();
  });

  it("uploads and retrieves a private borrower document with borrower permissions", async () => {
    documentPath = `${borrowerUserId}/uat-${Date.now()}.txt`;
    const body = "synthetic staging document";
    const { error: uploadError } = await borrower.storage.from("loan-documents").upload(
      documentPath,
      new Blob([body], { type: "text/plain" }),
      { contentType: "text/plain", upsert: false },
    );
    expect(uploadError, `Borrower document upload failed: ${uploadError?.message}`).toBeNull();

    const { data, error } = await borrower.storage.from("loan-documents").download(documentPath);
    expect(error, `Borrower document download failed: ${error?.message}`).toBeNull();
    expect(await data!.text()).toBe(body);
  });

  it("creates a loan application", async () => {
    const { data, error } = await borrower
      .from("loan_applications")
      .insert({
        user_id: borrowerUserId,
        loan_product_id: productId,
        full_name: "E2E Test Borrower",
        email: borrowerEmail,
        phone: "+260970000000",
        nrc_number: "100001/10/1",
        loan_amount: 1000,
        loan_term_months: 1,
        purpose: "e2e",
        monthly_income: 5000,
        status: "pending",
      })
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();
    applicationId = data!.id as string;
  });

  it("transitions: verify_documents → finance_approve → approve", async () => {
    for (const action of ["verify_documents", "finance_approve", "approve"] as const) {
      const { data, error } = await staff.rpc("transition_loan_status" as any, {
        p_loan_id: applicationId,
        p_action: action,
        p_reason: null,
      });
      expect(error, `RPC error on ${action}: ${error?.message}`).toBeNull();
      const ok = (data as any)?.ok ?? (data as any)?.success;
      expect(ok, `transition ${action} failed: ${JSON.stringify(data)}`).toBe(true);
    }

    const { data: loan } = await admin
      .from("loan_applications")
      .select("status")
      .eq("id", applicationId)
      .single();
    expect(loan?.status).toBe("approved");
  });

  it("creates and completes a disbursement against a funding account", async () => {
    fundingAccountId = FUNDING_ACCOUNT_ID;
    if (!fundingAccountId) {
      console.warn("No funding account with sufficient balance — skipping disbursement steps.");
      return;
    }

    const { data: disb, error: disbErr } = await staff
      .from("disbursements")
      .insert({
        loan_id: applicationId,
        amount: 1000,
        disbursement_method: "cash",
        status: "pending",
      })
      .select("id")
      .single();
    expect(disbErr, disbErr?.message).toBeNull();
    disbursementId = disb!.id as string;

    const { data, error } = await staff.rpc("complete_disbursement" as any, {
      p_disbursement_id: disbursementId,
      p_account_id: fundingAccountId,
      p_transaction_reference: `E2E-${Date.now()}`,
    });
    expect(error, error?.message).toBeNull();
    expect((data as any)?.success, JSON.stringify(data)).toBe(true);
  });

  it("undoes a mistaken disbursement once, then allows a clean re-disbursement", async () => {
    const { data: undone, error: undoError } = await staff.rpc("admin_undo_loan_disbursement" as any, {
      p_loan_id: applicationId,
    });
    expect(undoError, undoError?.message).toBeNull();
    expect((undone as any)?.ok, JSON.stringify(undone)).toBe(true);

    const { data: application } = await admin
      .from("loan_applications")
      .select("status")
      .eq("id", applicationId)
      .single();
    expect(application?.status).toBe("approved");

    const { data: secondUndo, error: secondUndoError } = await staff.rpc(
      "admin_undo_loan_disbursement" as any,
      { p_loan_id: applicationId },
    );
    expect(secondUndoError, secondUndoError?.message).toBeNull();
    expect((secondUndo as any)?.ok).toBe(false);

    const { data: refundRows, error: refundError } = await admin
      .from("account_transactions")
      .select("id")
      .eq("reference_type", "disbursement_reversal")
      .eq("reference_id", applicationId);
    expect(refundError, refundError?.message).toBeNull();
    expect(refundRows).toHaveLength(1);

    const { data: disb, error: disbErr } = await staff
      .from("disbursements")
      .insert({ loan_id: applicationId, amount: 1000, disbursement_method: "cash", status: "pending" })
      .select("id")
      .single();
    expect(disbErr, disbErr?.message).toBeNull();
    disbursementId = disb!.id as string;

    const { data, error } = await staff.rpc("complete_disbursement" as any, {
      p_disbursement_id: disbursementId,
      p_account_id: FUNDING_ACCOUNT_ID,
      p_transaction_reference: `E2E-REDISBURSE-${Date.now()}`,
    });
    expect(error, error?.message).toBeNull();
    expect((data as any)?.success, JSON.stringify(data)).toBe(true);
  });

  it("records a repayment via record_loan_payment RPC", async () => {
    const { data: rep } = await admin
      .from("loan_repayments")
      .select("id, amount")
      .eq("loan_id", applicationId)
      .eq("status", "pending")
      .order("installment_number", { ascending: true })
      .limit(1);
    if (!rep || rep.length === 0) {
      throw new Error("No pending repayment row generated — schedule trigger may be inactive.");
    }

    const { data, error } = await staff.rpc("record_loan_payment" as any, {
      p_repayment_id: rep[0].id,
      p_amount: Number(rep[0].amount),
      p_payment_method: "cash",
      p_account_id: fundingAccountId,
      p_transaction_reference: null,
    });
    expect(error, error?.message).toBeNull();
    expect((data as any)?.success, JSON.stringify(data)).toBe(true);

    const { data: retry, error: retryError } = await staff.rpc("record_loan_payment" as any, {
      p_repayment_id: rep[0].id,
      p_amount: Number(rep[0].amount),
      p_payment_method: "cash",
      p_account_id: fundingAccountId,
      p_transaction_reference: null,
    });
    expect(retryError, retryError?.message).toBeNull();
    expect((retry as any)?.success).toBe(false);
    expect((retry as any)?.error).toBe("Already paid");

    const { data: blockedUndo, error: blockedUndoError } = await staff.rpc(
      "admin_undo_loan_disbursement" as any,
      { p_loan_id: applicationId },
    );
    expect(blockedUndoError, blockedUndoError?.message).toBeNull();
    expect((blockedUndo as any)?.error).toBe("PAYMENTS_RECORDED");

    const { data: writeoff, error: writeoffError } = await staff
      .from("loan_writeoffs")
      .insert({ loan_id: applicationId, writeoff_amount: 1000, reason: "Automated staging UAT" })
      .select("id")
      .single();
    expect(writeoffError, writeoffError?.message).toBeNull();

    const { data: approved, error: approveError } = await staff.rpc("admin_approve_loan_writeoff" as any, {
      p_writeoff_id: writeoff!.id,
    });
    expect(approveError, approveError?.message).toBeNull();
    expect((approved as any)?.success, JSON.stringify(approved)).toBe(true);

    const { data: writtenOff } = await admin
      .from("loan_applications")
      .select("status")
      .eq("id", applicationId)
      .single();
    expect(writtenOff?.status).toBe("defaulted");
  });
});
