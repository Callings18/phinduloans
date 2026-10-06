import type { QueryClient } from "@tanstack/react-query";

/** Invalidate every React Query cache that reads `loan_products` after admin/house saves. */
export function invalidateLoanProductQueries(queryClient: QueryClient) {
  const keys = [
    "loan-products",
    "loan-products-linked-counts",
    "loan-product-modules-dynamic",
    "accessible-houses",
    "active-loan-products",
    "active-loan-products-select",
    "admin-loan-products",
    "loan-products-public",
    "loan-products-simple",
    "loan-products-quick",
  ] as const;

  for (const key of keys) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export function normalizeLoanProductCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return code.length > 0 ? code : null;
}
