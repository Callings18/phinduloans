/**
 * Normalize phone to E.164 format for consistent lookup and OTP.
 * Zambian numbers: 09... or 260... -> +260...
 */
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
