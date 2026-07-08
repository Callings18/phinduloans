import { useQuery } from "@tanstack/react-query";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";

type MaybeNumber = number | null;

export interface AIOpsBriefing {
  pendingApplications: MaybeNumber;
  overdueOrFailedYesterday: MaybeNumber;
  availableLiquidity: MaybeNumber;
  unsignedContracts: MaybeNumber;
  assignedPendingReviews: MaybeNumber;
  collectionsTrend: string;
  approachingDefault: MaybeNumber;
  notificationFailures: MaybeNumber;
  healthHint: string;
  generatedAt: string;
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code || "") : "";
  return code === "42P01";
}

async function countPendingApplications(): Promise<MaybeNumber> {
  const { count, error } = await supabase
    .from("loan_applications")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "under_review"]);
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return count ?? 0;
}

export function useAIOpsBriefing() {
  return useQuery({
    queryKey: ["ai-ops-briefing"],
    staleTime: 60_000,
    queryFn: async (): Promise<AIOpsBriefing> => {
      const today = new Date();
      const yesterdayStart = startOfDay(subDays(today, 1)).toISOString();
      const yesterdayEnd = endOfDay(subDays(today, 1)).toISOString();
      const lastWeekStart = startOfDay(subDays(today, 7)).toISOString();

      const normalizeCount = (result: { count: number | null; error: unknown }): MaybeNumber => {
        if (result.error) {
          if (isMissingTableError(result.error)) return null;
          throw result.error;
        }
        return result.count ?? 0;
      };

      const pendingApplications = await countPendingApplications();
      const overdueRepayments = normalizeCount(
        await supabase.from("loan_repayments").select("*", { count: "exact", head: true }).eq("status", "overdue"),
      );
      const failedPaymentsYesterday = normalizeCount(
        await supabase
          .from("loan_repayments")
          .select("*", { count: "exact", head: true })
          .gte("updated_at", yesterdayStart)
          .lte("updated_at", yesterdayEnd)
          .in("status", ["failed", "rejected"]),
      );
      const unsignedContracts = normalizeCount(
        await supabase
          .from("loan_applications")
          .select("*", { count: "exact", head: true })
          .in("status", ["contract_signing", "awaiting_disbursement"])
          .or("borrower_signed.is.false,borrower_signed_at.is.null"),
      );
      const assignedPendingReviews = normalizeCount(
        await supabase
          .from("loan_applications")
          .select("*", { count: "exact", head: true })
          .not("assigned_to", "is", null)
          .in("status", ["pending", "under_review"]),
      );
      const approachingDefault = normalizeCount(
        await supabase
          .from("loan_repayments")
          .select("*", { count: "exact", head: true })
          .eq("status", "overdue")
          .lt("due_date", format(subDays(today, 14), "yyyy-MM-dd")),
      );
      const notificationFailures = normalizeCount(
        await supabase
          .from("notification_logs")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("created_at", yesterdayStart),
      );

      const { data: accountRows, error: accountError } = await supabase
        .from("accounts")
        .select("balance, is_active")
        .eq("is_active", true);
      const availableLiquidity =
        accountError && isMissingTableError(accountError)
          ? null
          : accountError
            ? (() => {
                throw accountError;
              })()
            : (accountRows || []).reduce((sum, row) => sum + Number(row.balance || 0), 0);

      const { count: overdueLastWeek, error: overdueLastWeekError } = await supabase
        .from("loan_repayments")
        .select("*", { count: "exact", head: true })
        .eq("status", "overdue")
        .gte("updated_at", lastWeekStart);
      if (overdueLastWeekError && !isMissingTableError(overdueLastWeekError)) {
        throw overdueLastWeekError;
      }

      const currentOverdue = overdueRepayments ?? 0;
      const lastWeekOverdue = overdueLastWeekError ? null : (overdueLastWeek ?? 0);
      const collectionsTrend =
        lastWeekOverdue === null
          ? "—"
          : currentOverdue > lastWeekOverdue
            ? `Overdue loans are up by ${currentOverdue - lastWeekOverdue} versus last week.`
            : currentOverdue < lastWeekOverdue
              ? `Overdue loans are down by ${lastWeekOverdue - currentOverdue} versus last week.`
              : "Overdue loans are flat versus last week.";

      return {
        pendingApplications,
        overdueOrFailedYesterday:
          (overdueRepayments ?? 0) + (failedPaymentsYesterday ?? 0),
        availableLiquidity,
        unsignedContracts,
        assignedPendingReviews,
        collectionsTrend,
        approachingDefault,
        notificationFailures,
        healthHint:
          notificationFailures === null
            ? "Notification queue data is unavailable. Review Supabase logs."
            : notificationFailures > 0
              ? `${notificationFailures} notification failures detected in the last day.`
              : "No recent notification queue failures detected.",
        generatedAt: new Date().toISOString(),
      };
    },
  });
}
