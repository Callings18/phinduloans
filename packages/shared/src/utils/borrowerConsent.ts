import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import {
  BORROWER_TERMS_POLICY_VERSION,
  getMarketingPrivacyUrl,
  getMarketingTermsUrl,
} from "@phinduloans/shared/constants/borrowerLegal";

export async function recordBorrowerTermsConsent(userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("consent_logs").insert({
    user_id: userId,
    consent_type: "borrower_terms_privacy",
    version: BORROWER_TERMS_POLICY_VERSION,
    accepted: true,
    metadata: {
      terms_url: getMarketingTermsUrl(),
      privacy_url: getMarketingPrivacyUrl(),
    },
  });
  return { error: error ? new Error(error.message) : null };
}
