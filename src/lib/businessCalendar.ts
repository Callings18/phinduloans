/**
 * Business calendar — defines which days of the week and which specific
 * calendar dates are non-working (no loan collections, no reminders).
 *
 * Configured globally via system_settings.business_calendar:
 *   { non_working_weekdays: number[], holidays: string[] }
 *   - weekdays: 0=Sun, 1=Mon, ..., 6=Sat
 *   - holidays: ISO YYYY-MM-DD strings
 */

import { supabase } from "@/integrations/supabase/client";

export interface BusinessCalendar {
  non_working_weekdays: number[];
  holidays: string[]; // ISO yyyy-MM-dd
}

export const DEFAULT_BUSINESS_CALENDAR: BusinessCalendar = {
  non_working_weekdays: [0], // Sunday
  holidays: [],
};

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, idx) => ({ value: idx, label }));

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isNonWorkingDay(date: Date, calendar: BusinessCalendar): boolean {
  if (calendar.non_working_weekdays.includes(date.getDay())) return true;
  if (calendar.holidays.includes(toIsoDate(date))) return true;
  return false;
}

/**
 * Advance the date forward (in-place safe: returns a copy) until it lands on a
 * business day. Caps at 366 iterations to avoid infinite loops if a misconfig
 * marks every weekday off.
 */
export function nextBusinessDay(date: Date, calendar: BusinessCalendar): Date {
  const d = new Date(date);
  let guard = 0;
  while (isNonWorkingDay(d, calendar) && guard < 366) {
    d.setDate(d.getDate() + 1);
    guard += 1;
  }
  return d;
}

export function parseBusinessCalendar(raw: unknown): BusinessCalendar {
  if (!raw || typeof raw !== "object") return DEFAULT_BUSINESS_CALENDAR;
  const r = raw as Record<string, unknown>;
  const weekdays = Array.isArray(r.non_working_weekdays)
    ? r.non_working_weekdays.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : DEFAULT_BUSINESS_CALENDAR.non_working_weekdays;
  const holidays = Array.isArray(r.holidays)
    ? r.holidays.filter((h): h is string => typeof h === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h))
    : [];
  return { non_working_weekdays: Array.from(new Set(weekdays)), holidays: Array.from(new Set(holidays)).sort() };
}

let cachedCalendar: BusinessCalendar | null = null;
let cacheExpiresAt = 0;

/**
 * Fetch the global business calendar with a short in-memory cache so
 * schedule generators can call this freely.
 */
export async function getBusinessCalendar(force = false): Promise<BusinessCalendar> {
  const now = Date.now();
  if (!force && cachedCalendar && now < cacheExpiresAt) return cachedCalendar;
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "business_calendar")
      .maybeSingle();
    if (error) throw error;
    cachedCalendar = parseBusinessCalendar(data?.value);
  } catch {
    cachedCalendar = DEFAULT_BUSINESS_CALENDAR;
  }
  cacheExpiresAt = now + 60_000; // 1 minute
  return cachedCalendar;
}

export function invalidateBusinessCalendarCache() {
  cachedCalendar = null;
  cacheExpiresAt = 0;
}

export function describeCalendar(cal: BusinessCalendar): string {
  const days = cal.non_working_weekdays.length
    ? cal.non_working_weekdays
        .slice()
        .sort()
        .map((d) => WEEKDAY_LABELS[d])
        .join(", ")
    : "none";
  const holidayCount = cal.holidays.length;
  return `Off days: ${days}. Holidays: ${holidayCount}.`;
}
