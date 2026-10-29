/**
 * Normalize phone to E.164 format for consistent lookup and OTP.
 * Zambian numbers: 09... or 260... -> +260...
 */
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { normalizePhoneToE164 } from "@phinduloans/shared/utils/phoneE164";

export { normalizePhoneToE164 };

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * After custom phone OTP verification, establish a Supabase session in-app
 * (avoids magic-link redirect to marketing Site URL).
 */
export async function completeBorrowerSessionFromOtpToken(
  tokenHash: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  return { error: error ? new Error(error.message) : null };
}
