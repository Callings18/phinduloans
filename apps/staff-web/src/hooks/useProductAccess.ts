import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";

/**
 * Product-house access: admins/super_admins always pass.
 * Users with house:dashboard_view and no product scoping rows get all houses.
 * Otherwise require an active user_product_access row for the product.
 */
export function useProductAccess(productCode: string | null | undefined) {
  const { user, hasRole } = useAuth();
  const { can, isLoading: permsLoading } = usePermissions();

  return useQuery({
    queryKey: ["user-product-access", user?.id, productCode, can("house", "dashboard_view")],
    enabled: Boolean(user?.id && productCode) && !permsLoading,
    queryFn: async () => {
      if (!user?.id || !productCode) return false;
      if (hasRole("super_admin") || hasRole("admin")) return true;

      // Must have at least house dashboard view (or any house permission via can).
      if (!can("house", "dashboard_view")) return false;

      const normalizedProductCode = productCode.trim().toUpperCase();

      const fromAny = (supabase.from as any);
      const { data: grants, error } = await fromAny("user_product_access")
        .select("product_code")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (error) throw error;

      // No scoping rows → all houses with house RBAC are allowed.
      if (!grants || grants.length === 0) return true;

      return grants.some(
        (row: { product_code: string }) =>
          (row.product_code || "").trim().toUpperCase() === normalizedProductCode,
      );
    },
  });
}
