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
    if (isMissingPurgeRpcError(error)) {
      throw new Error(
        "The audited loan deletion service is unavailable. No records were deleted. Contact support to restore the database migration, then retry.",
      );
    }
    throw error;
  }

  const result = data as { ok?: boolean; error?: string; message?: string } | null;
  if (result && result.ok === false) {
    throw new Error(result.message || result.error || "Failed to delete loan");
  }
}

function isMissingPurgeRpcError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  if (e.code === "42883" || e.code === "PGRST202") return true;
  const msg = e.message ?? "";
  return msg.includes("admin_purge_loan_application") || msg.includes("schema cache");
}
