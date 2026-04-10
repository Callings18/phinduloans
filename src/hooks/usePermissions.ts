/**
 * usePermissions: loads current user's permissions and exposes can(module, action).
 * Uses get_my_permissions RPC (requires RBAC migration: roles, permissions, role_permissions).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PermissionKey = string;

function permKey(module: string, action: string): PermissionKey {
  return `${module}:${action}`;
}

export function usePermissions() {
  const { user, isLoading: authLoading, hasRole: authHasRole } = useAuth();
  const [permissionSet, setPermissionSet] = useState<Set<PermissionKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [rpcError, setRpcError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPermissionSet(new Set());
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
      if (authHasRole("super_admin")) return true;
      return permissionSet.has(permKey(module, action));
    },
    [permissionSet, authLoading, loading, authHasRole]
  );

  /** Check by "module:action" string, e.g. hasPermission("loans:approve") */
  const hasPermission = useCallback(
    (permissionName: string) => {
      if (authLoading || loading) return false;
      if (authHasRole("super_admin")) return true;
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

  const isLoading = authLoading || loading;

  return useMemo(
    () => ({
      can,
      hasPermission,
      hasRole,
      permissions: permissionSet,
      isLoading,
      rpcError,
    }),
    [can, hasPermission, hasRole, permissionSet, isLoading, rpcError]
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
