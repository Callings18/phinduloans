import { normalizePhoneToE164 } from "@phinduloans/shared/utils/phoneE164";

/** Common Zambian mobile prefixes (9-digit local after stripping leading 0). */
const ZM_MOBILE_PREFIXES = ["97", "96", "95", "77", "76", "57"] as const;

export function isValidZambianMobile(phone: string): boolean {
  const e164 = normalizePhoneToE164(phone);
  if (!/^\+260\d{9}$/.test(e164)) return false;
  const local = e164.slice(4);
  return ZM_MOBILE_PREFIXES.some((p) => local.startsWith(p));
}

/** Display local part as 97X XXX XXX (no country code). */
export function formatZambianMobileDisplay(phone: string): string {
  const e164 = normalizePhoneToE164(phone);
  const local = e164.startsWith("+260") ? e164.slice(4) : phone.replace(/\D/g, "").replace(/^260/, "");
  const d = local.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function parseZambianMobileInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^260/, "").replace(/^0/, "").slice(0, 9);
  return digits;
}
