/** Normalize phone to E.164 for Zambia (+260). Pure helper — safe for unit tests. */
export function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.startsWith("260") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+260${digits.slice(1)}`;
  if (digits.length >= 9) return `+260${digits}`;
  return `+${digits}`;
}
