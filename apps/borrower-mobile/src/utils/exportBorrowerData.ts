import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Compiles all borrower-owned data into a single JSON file and triggers download.
 * GDPR-style "export my data" — everything the borrower can already access via RLS.
 */
export async function exportBorrowerData(userId: string): Promise<void> {
  const [
    profileRes,
    loansRes,
    repaymentsRes,
    documentsRes,
    kycInfoRes,
    referencesRes,
    paymentClaimsRes,
    consentRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("loan_applications").select("*").eq("user_id", userId),
    supabase.from("loan_repayments").select("*").eq("user_id", userId),
    supabase.from("borrower_document_vault").select("*").eq("borrower_id", userId),
    supabase.from("borrower_kyc_info").select("*").eq("borrower_id", userId).maybeSingle(),
    supabase.from("borrower_references").select("*").eq("borrower_id", userId),
    supabase.from("payment_claims" as any).select("*").eq("user_id", userId),
    supabase.from("consent_logs" as any).select("*").eq("user_id", userId),
  ]);

  const exportPayload = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    profile: profileRes.data ?? null,
    kyc_info: kycInfoRes.data ?? null,
    references: referencesRes.data ?? [],
    documents: documentsRes.data ?? [],
    loan_applications: loansRes.data ?? [],
    loan_repayments: repaymentsRes.data ?? [],
    payment_claims: paymentClaimsRes.data ?? [],
    consent_logs: consentRes.data ?? [],
    notice:
      "This export contains personal data we hold about you. Treat it with care — store it securely and delete it when no longer needed.",
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `phindu_my_data_${format(new Date(), "yyyyMMdd_HHmm")}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
