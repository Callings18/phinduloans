import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useProductAccess(productCode: string | null | undefined) {
  const { user, hasRole } = useAuth();

  return useQuery({
    queryKey: ["user-product-access", user?.id, productCode],
    enabled: Boolean(user?.id && productCode),
    queryFn: async () => {
      if (!user?.id || !productCode) return false;
      if (
        hasRole("super_admin") ||
        hasRole("admin") ||
        hasRole("loan_officer") ||
        hasRole("credit_officer") ||
        hasRole("finance_officer") ||
        hasRole("collections_officer")
      ) return true;

      const normalizedProductCode = productCode.trim().toUpperCase();

      const fromAny = (supabase.from as any);
      const { data, error } = await fromAny("user_product_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_code", normalizedProductCode)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });
}
