/**
 * usePermissions: loads current user's permissions and exposes can(module, action).
 * Uses get_my_permissions RPC (requires RBAC migration: roles, permissions, role_permissions).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";

type PermissionKey = string;

function permKey(module: string, action: string): PermissionKey {
  return `${module}:${action}`;
}

export function usePermissions() {
  const { user, isLoading: authLoading, hasRole: authHasRole } = useAuth();
  const [permissionSet, setPermissionSet] = useState<Set<PermissionKey>>(new Set());
  const [productAccessSet, setProductAccessSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [rpcError, setRpcError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPermissionSet(new Set());
      setProductAccessSet(new Set());
      setRpcError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await (supabase.rpc as any)("get_my_permissions");
        if (cancelled) return;
        if (error) {
          console.warn("get_my_permissions failed — UI permission checks may deny actions until this succeeds. Backend RLS still applies.", error);
          setPermissionSet(new Set());
          setRpcError(error.message ?? String(error));
          return;
        }
        setRpcError(null);
        const set = new Set<PermissionKey>();
        (data ?? []).forEach((row: { module: string; action: string }) => {
          set.add(permKey(row.module, row.action));
        });
        setPermissionSet(set);

        try {
          const fromAny = (supabase.from as any);
          const { data: productAccessData } = await fromAny("user_product_access")
            .select("product_code")
            .eq("user_id", user.id)
            .eq("is_active", true);
          const productSet = new Set<string>((productAccessData ?? []).map((row: { product_code: string }) => row.product_code));
          setProductAccessSet(productSet);
        } catch {
          // Table may not exist yet in staged rollout.
          setProductAccessSet(new Set());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const can = useCallback(
    (module: string, action: string) => {
      if (authLoading || loading) return false;
      // Admin & super_admin always pass — server-side RLS still enforces.
      if (authHasRole("super_admin") || authHasRole("admin")) return true;
      return permissionSet.has(permKey(module, action));
    },
    [permissionSet, authLoading, loading, authHasRole]
  );

  /** Check by "module:action" string, e.g. hasPermission("loans:approve") */
  const hasPermission = useCallback(
    (permissionName: string) => {
      if (authLoading || loading) return false;
      if (authHasRole("super_admin") || authHasRole("admin")) return true;
      // Support both "module:action" and "module_action" formats
      if (permissionSet.has(permissionName)) return true;
      const parts = permissionName.includes(":") ? permissionName.split(":") : permissionName.split("_");
      if (parts.length >= 2) {
        const action = parts.pop()!;
        const module = parts.join("_");
        return permissionSet.has(permKey(module, action));
      }
      return false;
    },
    [permissionSet, authLoading, loading, authHasRole]
  );

  /** Prefer useAuth().hasRole for exact checks; exposed for legacy callers */
  const hasRole = useCallback(
    (roleName: string) => authHasRole(roleName),
    [authHasRole]
  );

  const canInProduct = useCallback(
    (module: string, action: string, productCode: string) => {
      if (authLoading || loading) return false;
      if (authHasRole("super_admin") || authHasRole("admin")) return true;
      if (!permissionSet.has(permKey(module, action))) return false;
      if (productAccessSet.size === 0) return true;
      return productAccessSet.has(productCode);
    },
    [authLoading, loading, authHasRole, permissionSet, productAccessSet]
  );

  const isLoading = authLoading || loading;

  return useMemo(
    () => ({
      can,
      canInProduct,
      hasPermission,
      hasRole,
      permissions: permissionSet,
      productAccess: productAccessSet,
      isLoading,
      rpcError,
    }),
    [can, canInProduct, hasPermission, hasRole, permissionSet, productAccessSet, isLoading, rpcError]
  );
}

// ── Helper functions for common permission checks ──

export const canApproveLoan = (perms: Set<string>) =>
  perms.has("loans:approve") || perms.has("loans:finance_approve");

export const canDisburseFunds = (perms: Set<string>) =>
  perms.has("disbursement:disburse") || perms.has("disbursement:create");

export const canViewReports = (perms: Set<string>) =>
  perms.has("reports:view") || perms.has("reports:export");

export const canManageUsers = (perms: Set<string>) =>
  perms.has("settings:manage") || perms.has("users:manage");
