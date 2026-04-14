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
      if (hasRole("super_admin") || hasRole("admin")) return true;

      const fromAny = (supabase.from as any);
      const { data, error } = await fromAny("user_product_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_code", productCode)
        .eq("is_active", true)
        .maybeSingle();
      if (error) {
        // During rollout, fail open for staff if mapping table not yet deployed.
        return true;
      }
      return Boolean(data);
    },
  });
}
