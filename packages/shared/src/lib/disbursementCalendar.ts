import { getBusinessCalendar, isNonWorkingDay } from "@phinduloans/shared/lib/businessCalendar";

/**
 * Throws a friendly error if today is a non-working day (e.g. Sunday or a
 * configured holiday). Used by every Disburse entry point so the rule is
 * enforced uniformly across products and dashboards.
 */
export async function assertBusinessDayForDisbursement(now: Date = new Date()): Promise<void> {
  const calendar = await getBusinessCalendar();
  if (isNonWorkingDay(now, calendar)) {
    throw new Error(
      "Disbursements are paused on non-working days (Sundays / holidays). Please process this on the next business day.",
    );
  }
}
