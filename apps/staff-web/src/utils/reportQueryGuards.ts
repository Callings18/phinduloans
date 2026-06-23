import { differenceInCalendarDays } from "date-fns";

/** Max inclusive calendar days for date-range reports (loan book, disbursement, performance). */
export const REPORT_MAX_RANGE_DAYS = 366;

/** Safety cap on rows returned from client-side report queries. */
export const REPORT_MAX_LOAN_ROWS = 5000;

export const REPORT_MAX_REPAYMENT_ROWS = 50000;

/** Performance report: bounded scans to avoid loading entire tables in the browser. */
export const REPORT_PERF_MAX_LOANS = 15000;
export const REPORT_PERF_MAX_REPAYMENTS = 100000;
export const REPORT_PERF_MAX_PAYROLL = 5000;

export const REPORT_IN_CHUNK = 200;

export function reportDateRangeError(fromStr: string, toStr: string): string | null {
  const from = new Date(fromStr);
  const to = new Date(`${toStr}T23:59:59`);
  if (Number.isNaN(+from) || Number.isNaN(+to)) return "Invalid date range.";
  if (from > to) return "Start date must be before end date.";
  const days = differenceInCalendarDays(to, from) + 1;
  if (days > REPORT_MAX_RANGE_DAYS) {
    return `Date range cannot exceed ${REPORT_MAX_RANGE_DAYS} days (inclusive). Narrow the range and try again.`;
  }
  return null;
}

export function chunkIds<T>(ids: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}
