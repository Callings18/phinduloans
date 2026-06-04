import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchHouseBorrowers,
  fetchHouseDisbursements,
  fetchHouseExpenses,
  fetchHouseLoans,
  fetchHouseProductByCode,
  fetchHouseRepayments,
  fetchHouseReportSummary,
} from "@/services/repositories/houseRepository";

export function useHouseProduct(productCode: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["house-product", productCode],
    queryFn: () => fetchHouseProductByCode(productCode),
    enabled: Boolean(productCode),
    staleTime: 0,
  });

  useEffect(() => {
    if (!productCode) return;
    const channel = supabase
      .channel(`house-product-live-${productCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loan_products",
          filter: `product_code=eq.${productCode}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["house-product", productCode] });
          queryClient.invalidateQueries({ queryKey: ["product-by-code", productCode] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [productCode, queryClient]);

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
