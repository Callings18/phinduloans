/** Normalize supported Zambian mobile number formats to Auth E.164. */
export function normalizeBorrowerPhone(phone?: string | null): string | null {
  const trimmed = String(phone ?? "").trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("260") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+260${digits.slice(1)}`;
  if (digits.length === 9) return `+260${digits}`;
  return null;
}

export function isDuplicateBorrowerAuthError(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "").toLowerCase();
  return (
    ["email_exists", "phone_exists", "user_already_exists"].includes(code) ||
    /already(?: been)? registered|already exists|duplicate key.*users_(?:email|phone)/i.test(message)
  );
}

export function matchesBorrowerAuthIdentity(
  user: { email?: string | null; phone?: string | null },
  email: string,
  phone?: string | null,
): boolean {
  const emailMatches = Boolean(user.email && user.email.trim().toLowerCase() === email.trim().toLowerCase());
  const normalizedPhone = normalizeBorrowerPhone(phone);
  const phoneMatches = Boolean(normalizedPhone && normalizeBorrowerPhone(user.phone) === normalizedPhone);
  return emailMatches || phoneMatches;
}

/** Prevent destructive integration suites from ever writing to production. */
export function isProductionSupabaseUrl(value?: string | null): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === "seobilifwyxhtjvsgqpc.supabase.co" ||
      host === "yqrfheavftgybhcafzpt.supabase.co" ||
      /(^|[-.])(prod|production|live)([-.]|$)/.test(host)
    );
  } catch {
    return false;
  }
}
