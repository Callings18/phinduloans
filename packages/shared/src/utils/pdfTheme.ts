/** Shared professional palette for jsPDF documents (print-friendly, high contrast). */
export const PDF_THEME = {
  /** Slate-800 — primary headers and table heads */
  header: [30, 41, 59] as [number, number, number],
  /** Teal-700 — accents, footer highlights */
  accent: [15, 118, 110] as [number, number, number],
  /** Slate-700 — body text */
  body: [51, 65, 85] as [number, number, number],
  /** Near-black — emphasis rows */
  ink: [15, 23, 42] as [number, number, number],
  /** Slate-50 — subtle section backgrounds */
  softBg: [248, 250, 252] as [number, number, number],
  /** Slate-100 — zebra / alternate rows */
  stripe: [241, 245, 249] as [number, number, number],
  /** Success tint for balance highlights */
  successBg: [236, 253, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
} as const;

export function pdfMoney(amount: unknown): string {
  const n = Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  return `K${value.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
