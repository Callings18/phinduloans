/**
 * Normalize phone to E.164 format for consistent lookup and OTP.
 * Zambian numbers: 09... or 260... -> +260...
 */
import { supabase } from "@phinduloans/shared/integrations/supabase/client";

export function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.startsWith("260") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+260${digits.slice(1)}`;
  if (digits.length >= 9) return `+260${digits}`;
  return `+${digits}`;
}

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
