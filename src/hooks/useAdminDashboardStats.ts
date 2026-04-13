import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAdminDashboardStats, fetchAdminUpcomingPayments } from "@/lib/adminDashboardStats";

export function useAdminDashboardStats(loanProductId: string | null | undefined) {
  const id = loanProductId || null;
  return useQuery({
    queryKey: ["admin-stats", id],
    queryFn: () => fetchAdminDashboardStats(supabase, { loanProductId: id }),
  });
}

export function useAdminUpcomingPayments(loanProductId: string | null | undefined) {
  const id = loanProductId || null;
  return useQuery({
    queryKey: ["upcoming-payments", id],
    queryFn: () => fetchAdminUpcomingPayments(supabase, { loanProductId: id }),
  });
}
