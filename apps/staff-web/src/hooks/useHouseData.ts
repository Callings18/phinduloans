import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { useLoanProductModules } from "@/hooks/useLoanProductModules";
import {
  fetchHouseBorrowers,
  fetchHouseDisbursements,
  fetchHouseExpenses,
  fetchHouseLoans,
  fetchHouseProductByCode,
  fetchHouseRepayments,
  fetchHouseReportSummary,
  fetchHousesReportBundle,
} from "@/services/repositories/houseRepository";


export function useHouseProduct(productCode: string) {
  const normalized = productCode.trim().toUpperCase();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["house-product", normalized],
    queryFn: () => fetchHouseProductByCode(normalized),
    enabled: Boolean(normalized),
    staleTime: 0,
  });

  useEffect(() => {
    if (!normalized) return;
    const channel = supabase
      .channel(`house-product-live-${normalized}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loan_products",
          filter: `product_code=eq.${normalized}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["house-product", normalized] });
          queryClient.invalidateQueries({ queryKey: ["product-by-code", normalized] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [normalized, queryClient]);

  return query;
}

export function useHouseLoans(productCode: string) {
  return useQuery({
    queryKey: ["house-loans", productCode],
    queryFn: () => fetchHouseLoans(productCode),
    enabled: Boolean(productCode),
  });
}

export function useHouseBorrowers(productCode: string) {
  return useQuery({
    queryKey: ["house-borrowers", productCode],
    queryFn: () => fetchHouseBorrowers(productCode),
    enabled: Boolean(productCode),
  });
}

export function useHouseRepayments(productCode: string) {
  return useQuery({
    queryKey: ["house-repayments", productCode],
    queryFn: () => fetchHouseRepayments(productCode),
    enabled: Boolean(productCode),
  });
}

export function useHouseDisbursements(productCode: string) {
  return useQuery({
    queryKey: ["house-disbursements", productCode],
    queryFn: () => fetchHouseDisbursements(productCode),
    enabled: Boolean(productCode),
  });
}

export function useHouseReportSummary(productCode: string) {
  return useQuery({
    queryKey: ["house-report-summary", productCode],
    queryFn: () => fetchHouseReportSummary(productCode),
    enabled: Boolean(productCode),
  });
}

export function useHouseExpenses(productCode: string) {
  return useQuery({
    queryKey: ["house-expenses", productCode],
    queryFn: () => fetchHouseExpenses(productCode),
    enabled: Boolean(productCode),
  });
}

export interface AccessibleHouse {
  productCode: string;
  name: string;
}

/**
 * Houses the current user can open:
 * - admin / super_admin → every active house
 * - house:dashboard_view with no product grants → every active house
 * - otherwise → filter by active `user_product_access` rows
 */
export function useAccessibleHouses() {
  const { user, hasRole } = useAuth();
  const modulesQuery = useLoanProductModules();
  const { data: modules, isLoading: modulesLoading, isError: modulesError, error: modulesErr } = modulesQuery;

  const query = useQuery({
    queryKey: ["accessible-houses", user?.id, (modules ?? []).map((m) => m.productCode).join(",")],
    enabled: Boolean(user?.id) && !modulesLoading && !modulesError,
    queryFn: async (): Promise<AccessibleHouse[]> => {
      const houses: AccessibleHouse[] = (modules ?? [])
        .filter((m) => m.enabled)
        .map((m) => ({ productCode: m.productCode, name: m.name }));

      if (hasRole("super_admin") || hasRole("admin")) return houses;
      if (!user?.id) return [];

      const { data, error } = await (supabase.from as any)("user_product_access")
        .select("product_code")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (error) throw error;

      // No product scoping → all houses (RBAC still gates routes/tabs).
      if (!data || data.length === 0) return houses;

      const allowed = new Set(
        (data ?? []).map((row: { product_code: string }) => (row.product_code || "").toUpperCase()),
      );
      return houses.filter((h) => allowed.has(h.productCode.toUpperCase()));
    },
  });

  return {
    ...query,
    isLoading: modulesLoading || query.isLoading || query.isFetching,
    isError: modulesError || query.isError,
    error: query.error ?? modulesErr,
  };
}

/**
 * Loans, repayments, expenses and disbursements across one or many houses,
 * used by the Reports page for single-house or "All houses" aggregation.
 */
export function useHousesReportBundle(productCodes: string[]) {
  const codes = Array.from(new Set((productCodes ?? []).map((c) => c.toUpperCase()).filter(Boolean))).sort();
  const queryClient = useQueryClient();
  const key = codes.join(",");

  // Keep the report live: any change to the underlying tables refetches the bundle.
  useEffect(() => {
    if (!key) return;
    const channel = supabase
      .channel(`houses-report-bundle-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_repayments" }, () =>
        queryClient.invalidateQueries({ queryKey: ["houses-report-bundle", key] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "disbursements" }, () =>
        queryClient.invalidateQueries({ queryKey: ["houses-report-bundle", key] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () =>
        queryClient.invalidateQueries({ queryKey: ["houses-report-bundle", key] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_applications" }, () =>
        queryClient.invalidateQueries({ queryKey: ["houses-report-bundle", key] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [key, queryClient]);

  return useQuery({
    queryKey: ["houses-report-bundle", key],
    queryFn: () => fetchHousesReportBundle(codes),
    enabled: codes.length > 0,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}
