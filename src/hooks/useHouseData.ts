import { useQuery } from "@tanstack/react-query";
import {
  fetchHouseBorrowers,
  fetchHouseDisbursements,
  fetchHouseLoans,
  fetchHouseProductByCode,
  fetchHouseRepayments,
  fetchHouseReportSummary,
} from "@/services/repositories/houseRepository";

export function useHouseProduct(productCode: string) {
  return useQuery({
    queryKey: ["house-product", productCode],
    queryFn: () => fetchHouseProductByCode(productCode),
    enabled: Boolean(productCode),
  });
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
