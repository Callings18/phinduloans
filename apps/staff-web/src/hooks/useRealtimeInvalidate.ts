import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";

/**
 * Subscribe to Postgres changes on one or more tables and invalidate the given
 * React Query keys when anything changes. Use to keep dashboards live.
 */
export function useRealtimeInvalidate(
  tables: string[],
  queryKeys: (string | (string | null | undefined)[])[],
  channelName?: string,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tables.length) return;
    const name = channelName || `rt-${tables.join("-")}-${Math.random().toString(36).slice(2, 8)}`;
    let channel = supabase.channel(name);
    tables.forEach((table) => {
      channel = (channel as any).on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryKeys.forEach((key) => {
            const queryKey = Array.isArray(key) ? key : [key];
            queryClient.invalidateQueries({ queryKey });
          });
        },
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join("|"), channelName]);
}
