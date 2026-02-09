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
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const [permissionSet, setPermissionSet] = useState<Set<PermissionKey>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissionSet(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase.rpc("get_my_permissions");
        if (cancelled) return;
        if (error) {
          console.warn("get_my_permissions failed", error);
          setPermissionSet(new Set());
          return;
        }
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
      // Fallback: if RBAC not run or empty, treat super_admin/admin as full access
      if (permissionSet.size === 0 && isAdmin) return true;
      return permissionSet.has(permKey(module, action));
    },
    [permissionSet, authLoading, loading, isAdmin]
  );

  const isLoading = authLoading || loading;

  return useMemo(() => ({ can, permissions: permissionSet, isLoading }), [can, permissionSet, isLoading]);
}
