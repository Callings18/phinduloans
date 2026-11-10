import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";

export type SmsPackageConfig = {
  provider?: string;
  package_size: number;
  package_start_at: string | null;
  low_balance_threshold?: number;
  notes?: string;
};

export type SmsUsageStats = {
  since: string;
  messages_sent: number;
  messages_failed: number;
  messages_pending: number;
  sms_units_used: number;
};

export type ExciteBalanceResponse = {
  success: boolean;
  source: "excitesms" | "unavailable";
  remaining_units?: number;
  message?: string;
  fetched_at?: string;
};

const DEFAULT_PACKAGE: SmsPackageConfig = {
  provider: "excitesms",
  package_size: 2000,
  package_start_at: null,
  low_balance_threshold: 200,
};

export function useSmsPackageConfig() {
  return useQuery({
    queryKey: ["sms-package-config"],
    queryFn: async (): Promise<SmsPackageConfig> => {
      const { data, error } = await (supabase.rpc as (fn: string) => ReturnType<typeof supabase.rpc>)(
        "get_sms_package_config",
      );
      if (error) throw error;
      const raw = (data ?? {}) as Partial<SmsPackageConfig>;
      return {
        ...DEFAULT_PACKAGE,
        ...raw,
        package_size: Number(raw.package_size ?? DEFAULT_PACKAGE.package_size) || 0,
        low_balance_threshold: Number(raw.low_balance_threshold ?? DEFAULT_PACKAGE.low_balance_threshold) || 0,
      };
    },
    staleTime: 30_000,
  });
}

export function useSmsUsageStats(packageStartAt: string | null | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!packageStartAt) return;
    const channel = supabase
      .channel("sms-usage-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_logs", filter: "type=eq.sms" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["sms-usage-stats"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [packageStartAt, queryClient]);
  return useQuery({
    queryKey: ["sms-usage-stats", packageStartAt ?? "no-package-start"],
    enabled: Boolean(packageStartAt),
    queryFn: async (): Promise<SmsUsageStats> => {
      if (!packageStartAt) throw new Error("Set a package start date before calculating bundle usage.");
      const { data, error } = await (supabase.rpc as (fn: string, args: { p_since: string }) => ReturnType<typeof supabase.rpc>)(
        "get_sms_usage_stats",
        { p_since: packageStartAt },
      );
      if (error) throw error;
      const row = data as SmsUsageStats | null;
      return {
        since: row?.since ?? packageStartAt,
        messages_sent: Number(row?.messages_sent ?? 0),
        messages_failed: Number(row?.messages_failed ?? 0),
        messages_pending: Number(row?.messages_pending ?? 0),
        sms_units_used: Number(row?.sms_units_used ?? 0),
      };
    },
    // Realtime updates immediately; polling remains a recovery path if a
    // browser sleeps or the Realtime socket reconnects.
    refetchInterval: packageStartAt ? 5 * 60_000 : false,
  });
}

export function useExciteSmsBalance(enabled: boolean) {
  return useQuery({
    queryKey: ["excite-sms-balance"],
    enabled,
    queryFn: async (): Promise<ExciteBalanceResponse> => {
      const { data, error } = await supabase.functions.invoke("excite-sms-balance", { method: "GET" });
      if (error) throw error;
      return (data ?? { success: false, source: "unavailable" }) as ExciteBalanceResponse;
    },
    staleTime: 5 * 60_000,
    refetchInterval: enabled ? 60_000 : false,
    retry: false,
  });
}
