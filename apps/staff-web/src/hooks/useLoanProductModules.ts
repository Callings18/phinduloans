import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { LOAN_PRODUCT_MODULES, type LoanProductModuleDefinition } from "@phinduloans/shared/config/loanProductModules";

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
  return useQuery({
    queryKey: ["loan-product-modules-dynamic"],
    staleTime: 60_000,
    queryFn: async (): Promise<DynamicLoanProductModule[]> => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, product_code, name, description, is_active")
        .order("name", { ascending: true });
      if (error) throw error;

      const staticByCode = new Map(LOAN_PRODUCT_MODULES.map((m) => [m.code as string, m]));
      const seen = new Set<string>();
      const merged: DynamicLoanProductModule[] = [];

      // Add hard-coded modules first (preserves order + special handlers)
      for (const m of LOAN_PRODUCT_MODULES) {
        merged.push({
          ...m,
          productCode: m.code,
          isCustom: false,
          description: null,
        });
        seen.add(m.code);
      }

      // Add custom products with a product_code that isn't already a hard-coded house
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
