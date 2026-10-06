import { supabase } from "@phinduloans/shared/integrations/supabase/client";

/** Matches staff UI `DELETABLE_STATUSES` (pre-disbursement cleanup). */
export const DELETABLE_LOAN_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "contract_signing",
  "awaiting_disbursement",
  "rejected",
  "crb_failed",
  "pmic_pending",
] as const;

export function isDeletableLoanStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (DELETABLE_LOAN_STATUSES as readonly string[]).includes(status);
}

/**
 * Remove a loan application and dependent rows (uses DB RPC when available).
 */
export async function deleteLoanApplication(
  loanId: string,
  status: string,
  options?: { allowPrivilegedDelete?: boolean },
) {
  if (!options?.allowPrivilegedDelete && !isDeletableLoanStatus(status)) {
    throw new Error(
      `Cannot delete a loan in status "${status}". Undo disbursement first or use admin delete.`,
    );
  }

  // Types regenerated after migration 20261005120000 is applied on the linked project.
  const { data, error } = await (
    supabase.rpc as (
      fn: "admin_purge_loan_application",
      args: { p_loan_id: string },
    ) => ReturnType<typeof supabase.rpc>
  )("admin_purge_loan_application", { p_loan_id: loanId });

  if (error) {
    if ((error as { code?: string }).code === "42883") {
      return deleteLoanApplicationFallback(loanId, status);
    }
    throw error;
  }

  const result = data as { ok?: boolean; error?: string; message?: string } | null;
  if (result && result.ok === false) {
    throw new Error(result.message || result.error || "Failed to delete loan");
  }
}

/** Legacy path if migration not applied yet. */
async function deleteLoanApplicationFallback(loanId: string, status: string) {
  if (!isDeletableLoanStatus(status)) {
    throw new Error(`Cannot delete a loan in status "${status}".`);
  }
  const byLoanId = [
    "loan_repayments",
    "disbursements",
    "loan_status_transitions",
    "loan_events",
    "payment_claims",
    "loan_notes",
  ] as const;
  for (const table of byLoanId) {
    const { error } = await supabase.from(table).delete().eq("loan_id", loanId);
    if (error && (error as { code?: string }).code !== "42P01") throw error;
  }
  {
    const { error } = await supabase.from("application_documents").delete().eq("application_id", loanId);
    if (error && (error as { code?: string }).code !== "42P01") throw error;
  }
  {
    const { error } = await supabase.from("loan_borrowers").delete().eq("loan_application_id", loanId);
    if (error && (error as { code?: string }).code !== "42P01") throw error;
  }
  const { error } = await supabase.from("loan_applications").delete().eq("id", loanId);
  if (error) throw error;
}
