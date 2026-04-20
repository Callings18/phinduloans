/**
 * useFeatureFlags — read-only access to runtime feature flags from the
 * `feature_flags` table. Use `useFeatureFlag(key)` in components to gate UI
 * so risky features can be killed instantly from /admin/feature-flags
 * without redeploying.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlagRow {
  id: string;
  flag_key: string;
  flag_label: string;
  description: string | null;
  is_enabled: boolean;
  category: string;
  updated_at: string;
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: async (): Promise<FeatureFlagRow[]> => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*")
        .order("category", { ascending: true })
        .order("flag_label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FeatureFlagRow[];
    },
    staleTime: 60_000,
  });
}

export function useFeatureFlag(key: string): { isEnabled: boolean; isLoading: boolean } {
  const { data, isLoading } = useFeatureFlags();
  const flag = data?.find((f) => f.flag_key === key);
  // Default-on: if the flag row doesn't exist yet, allow the feature so we
  // never accidentally hide functionality from new keys.
  return { isEnabled: flag ? flag.is_enabled : true, isLoading };
}
