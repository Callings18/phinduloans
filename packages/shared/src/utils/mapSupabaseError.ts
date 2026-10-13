/**
 * Maps Supabase PostgREST / Postgres errors to short, user-facing copy.
 * Use in mutation onError and optional query onError for HR/payroll and similar.
 */

export function mapSupabaseError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err == null) return fallback;

  if (typeof err === "string") {
    const s = err.trim();
    return s || fallback;
  }

  const e = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  const raw = (e.message || "").trim();
  const lower = raw.toLowerCase();
  const code = e.code || "";

  if (
    code === "42501" ||
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("violates row-level security") ||
    lower.includes("rls")
  ) {
    return "You don't have permission for this action. If you need access, ask an administrator.";
  }

  if (code === "23505" || lower.includes("unique constraint") || lower.includes("duplicate key")) {
    // Trigger: block_duplicate_active_loan (Option C: blocks on user_id, NRC, or phone match)
    if (lower.includes("borrower already has an open loan")) {
      const idMatch = raw.match(/existing_id=([0-9a-f-]{36})/i);
      const statusMatch = raw.match(/status=([a-z_]+)/i);
      const ref = idMatch ? ` Open loan ID: ${idMatch[1]}.` : "";
      const st = statusMatch ? ` Status: ${statusMatch[1]}.` : "";
      return (
        `This borrower already has an open loan on the books.${st}${ref} ` +
        "Open that loan → Undo Disbursement (if no payments recorded) or Delete Loan (admin), then create again in the correct product house."
      );
    }
    if (lower.includes("loan_applications_open_nrc_phone_uniq")) {
      return "You already have an existing loan application or active loan under this identity (NRC/phone). Please complete or close it before applying again.";
    }
    return "This record already exists or conflicts with an existing value.";
  }

  if (code === "23503" || lower.includes("foreign key constraint")) {
    return "This action conflicts with linked records. Remove or update related data first.";
  }

  if (code === "PGRST116" || lower.includes("0 rows")) {
    return "Record not found or you no longer have access to it.";
  }

  if (lower.includes("jwt") || lower.includes("session") || code === "401") {
    return "Your session may have expired. Please sign in again.";
  }

  if (raw) return raw;
  return fallback;
}
