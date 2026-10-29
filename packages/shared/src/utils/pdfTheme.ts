/** Phindu Credit brand palette for jsPDF (matches app primary + dark maroon). */
export const PDF_THEME = {
  /** Brand maroon header bar — #2D0818 (capacitor / app background) */
  header: [45, 8, 24] as [number, number, number],
  /** Primary pink accent — hsl(330, 90%, 55%) ≈ #F0277A / #FF3399 */
  accent: [255, 51, 153] as [number, number, number],
  /** Body text on white */
  body: [51, 45, 62] as [number, number, number],
  /** Strong emphasis */
  ink: [45, 8, 24] as [number, number, number],
  /** Light pink section backgrounds */
  softBg: [253, 242, 248] as [number, number, number],
  /** Alternate rows */
  stripe: [250, 235, 245] as [number, number, number],
  /** Paid / success highlights */
  successBg: [236, 253, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  muted: [120, 100, 115] as [number, number, number],
  border: [230, 210, 220] as [number, number, number],
} as const;

export function pdfMoney(amount: unknown): string {
  const n = Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  return `K${value.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
