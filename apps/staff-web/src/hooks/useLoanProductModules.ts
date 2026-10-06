import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { LOAN_PRODUCT_MODULES, type LoanProductModuleDefinition } from "@phinduloans/shared/config/loanProductModules";
import { invalidateLoanProductQueries } from "@/lib/invalidateLoanProductQueries";

export interface DynamicLoanProductModule extends Omit<LoanProductModuleDefinition, "betaKey"> {
  betaKey: string;
  isCustom: boolean;
  description?: string | null;
  productCode: string;
}

/**
 * Returns the list of loan product "houses" — legacy hard-coded ones merged with
 * any custom product defined in `loan_products` by an admin. Every active product
 * automatically gets its own house dashboard at `/admin/houses/<product_code>`.
 */
export function useLoanProductModules() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("loan-product-modules-dynamic")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loan_products" },
        () => {
          invalidateLoanProductQueries(queryClient);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["loan-product-modules-dynamic"],
    staleTime: 0,
    queryFn: async (): Promise<DynamicLoanProductModule[]> => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, product_code, name, description, is_active")
        .order("name", { ascending: true });
      if (error) throw error;

      const seen = new Set<string>();
      const merged: DynamicLoanProductModule[] = [];

      for (const m of LOAN_PRODUCT_MODULES) {
        merged.push({
          ...m,
          productCode: m.code,
          isCustom: false,
          description: null,
        });
        seen.add(m.code);
      }

      for (const p of data ?? []) {
        const code = (p.product_code || "").toUpperCase().trim();
        if (!code) continue;
        if (seen.has(code)) continue;
        if (p.is_active === false) continue;
        seen.add(code);
        merged.push({
          code: code as never,
          productCode: code,
          name: p.name,
          description: p.description,
          createPath: `/admin/houses/${code}/loans/create`,
          housePath: `/admin/houses/${code}`,
          betaKey: `loan_create_${code.toLowerCase()}`,
          enabled: true,
          isCustom: true,
        });
      }

      return merged;
    },
  });
}
