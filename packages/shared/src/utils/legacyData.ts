/**
 * Legacy / sparse data safety helpers.
 *
 * Production data predates several schema additions (KYC docs, contract URLs,
 * canonical statuses, etc.). New UI components must render gracefully against
 * those older records — never crash, never show "undefined", "NaN", or
 * "Invalid Date".
 *
 * These helpers are the canonical guard layer. Use them at the **render
 * boundary** of any component that consumes loan / repayment / borrower /
 * document rows from the database.
 *
 * Companion test suite: `src/utils/__tests__/legacyData.test.ts`.
 */

import { getCanonicalStatusLabel, LOAN_STATUS_LABELS } from "@phinduloans/shared/constants/loanStatusLabels";

export const LEGACY_FALLBACKS = {
  text: "—",
  amount: "—",
  date: "—",
  status: "Unknown",
  document: "Not provided",
} as const;

/** Safe text fallback for any nullable string/unknown field. */
export function safeText(value: unknown, fallback: string = LEGACY_FALLBACKS.text): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? fallback : trimmed;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return fallback;
}

/** Safe numeric formatter for currency/amount fields (returns string). */
export function safeAmount(
  value: unknown,
  options: { currency?: string; fallback?: string } = {},
): string {
  const { currency = "ZMW", fallback = LEGACY_FALLBACKS.amount } = options;
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  try {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Safe numeric coercion. Returns null if value cannot be safely parsed. */
export function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Safe date formatter. Returns fallback for null/invalid/legacy null-string dates. */
export function safeDate(
  value: unknown,
  formatter: (d: Date) => string = (d) => d.toLocaleDateString("en-ZM"),
  fallback: string = LEGACY_FALLBACKS.date,
): string {
  if (value === null || value === undefined || value === "") return fallback;
  // Some legacy rows have literal "null" or "0000-00-00" strings.
  if (typeof value === "string" && (value === "null" || value.startsWith("0000"))) {
    return fallback;
  }
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return fallback;
  try {
    return formatter(d);
  } catch {
    return fallback;
  }
}

/**
 * Returns true if a status value is one of the known canonical loan statuses.
 * Older records may carry deprecated/free-text statuses we no longer recognise.
 */
export function isKnownLoanStatus(status: unknown): status is keyof typeof LOAN_STATUS_LABELS {
  return typeof status === "string" && status in LOAN_STATUS_LABELS;
}

/** Resolve a possibly-legacy status to a human label, never crashing. */
export function safeStatusLabel(status: unknown, fallback: string = LEGACY_FALLBACKS.status): string {
  if (status === null || status === undefined || status === "") return fallback;
  if (typeof status !== "string") return fallback;
  return getCanonicalStatusLabel(status);
}

/** Safe array — returns [] for null/undefined/non-array input so `.map`/`.length` is always safe. */
export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Safe nested property accessor. Use over chained `?.` when the path is dynamic. */
export function safeGet<T = unknown>(obj: unknown, path: string, fallback: T | null = null): T | null {
  if (obj === null || obj === undefined) return fallback;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return fallback;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return (current ?? fallback) as T | null;
}

/**
 * Returns a structured "render mode" descriptor for a legacy/sparse loan row.
 * Helps UI choose between full render, partial render, or "legacy record"
 * placeholder.
 */
export interface LoanCompletenessReport {
  isComplete: boolean;
  missing: string[];
  hasMinimumViable: boolean;
}

export function assessLoanCompleteness(loan: unknown): LoanCompletenessReport {
  const missing: string[] = [];
  if (!loan || typeof loan !== "object") {
    return { isComplete: false, missing: ["entire_record"], hasMinimumViable: false };
  }
  const l = loan as Record<string, unknown>;
  const required = ["id", "loan_amount", "status"] as const;
  const optional = ["loan_term_months", "monthly_repayment", "total_repayment", "disbursement_date"] as const;

  for (const k of required) {
    if (l[k] === null || l[k] === undefined || l[k] === "") missing.push(k);
  }
  for (const k of optional) {
    if (l[k] === null || l[k] === undefined) missing.push(k);
  }

  const hasMinimumViable = required.every(
    (k) => l[k] !== null && l[k] !== undefined && l[k] !== "",
  );
  return {
    isComplete: missing.length === 0,
    missing,
    hasMinimumViable,
  };
}

/** Document list completeness — null/empty/missing required docs all flagged. */
export function assessDocumentCompleteness(
  documents: unknown,
  requiredTypes: string[] = [],
): { hasAny: boolean; missingRequired: string[]; total: number } {
  const list = safeArray(documents as unknown[]);
  const presentTypes = new Set(
    list
      .map((d) => safeGet<string>(d, "doc_type"))
      .filter((t): t is string => typeof t === "string" && t.length > 0),
  );
  const missingRequired = requiredTypes.filter((t) => !presentTypes.has(t));
  return {
    hasAny: list.length > 0,
    missingRequired,
    total: list.length,
  };
}
