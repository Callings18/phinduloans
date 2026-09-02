export function formatPhoneNumber(phone: string): string {
  const formatted = phone.trim().replace(/\s+/g, "").replace(/[^0-9+]/g, "");

  if (formatted.startsWith("+260")) return formatted;
  if (formatted.startsWith("260")) return `+${formatted}`;
  if (formatted.startsWith("0")) return `+260${formatted.substring(1)}`;
  if (formatted.length === 9 && !formatted.startsWith("+")) return `+260${formatted}`;
  if (formatted.startsWith("+")) return formatted;
  return `+260${formatted}`;
}
