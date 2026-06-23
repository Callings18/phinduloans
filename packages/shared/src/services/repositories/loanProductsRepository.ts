import type { Database } from "@phinduloans/shared/integrations/supabase/types";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { apiGet } from "@phinduloans/shared/api/httpClient";
import { apiFeatureFlags } from "@phinduloans/shared/config/apiMode";

export type LoanProductRow = Database["public"]["Tables"]["loan_products"]["Row"];

export type LoanProductSort = "name" | "interest_rate" | "min_amount";

/**
 * Active loan products with ordering — Supabase or REST behind `VITE_API_LOAN_PRODUCTS`.
 */
export async function fetchActiveLoanProducts(options: {
  sort: LoanProductSort;
  ascending: boolean;
}): Promise<LoanProductRow[]> {
  if (apiFeatureFlags.loanProducts) {
    const order = options.ascending ? "asc" : "desc";
    return apiGet<LoanProductRow[]>(
      `/api/v1/loan-products?active=true&sort=${options.sort}&order=${order}`,
    );
  }

  const { data, error } = await supabase
    .from("loan_products")
    .select("*")
    .eq("is_active", true)
    .order(options.sort, { ascending: options.ascending });

  if (error) throw error;
  return data as LoanProductRow[];
}
