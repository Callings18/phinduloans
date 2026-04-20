/**
 * Route guard: requires staff (already ensured by parent AdminRoute) plus
 * either admin-only, a single permission, or any-of permissions.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

export type PermissionSpec = { module: string; action: string };

interface PermissionRouteProps {
  children: React.ReactNode;
  /** Only super_admin/admin app roles */
  adminOnly?: boolean;
  /** Require this permission (admins pass) */
  permission?: PermissionSpec;
  /** Require at least one permission (admins pass) */
  anyOf?: PermissionSpec[];
}

export default function PermissionRoute({
  children,
  adminOnly,
  permission,
  anyOf,
}: PermissionRouteProps) {
  const { isLoading: authLoading, hasRole } = useAuth();
  const { can, isLoading: permLoading, rpcError } = usePermissions();

  if (authLoading || permLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (adminOnly) {
    if (!hasRole("admin") && !hasRole("super_admin")) {
      return <Navigate to="/admin" replace />;
    }
    return <>{children}</>;
  }

  // Admins and super_admins always pass — server-side RLS still enforces.
  if (hasRole("super_admin") || hasRole("admin")) {
    return <>{children}</>;
  }

  // If the permissions RPC failed for a non-admin staff member, surface a clear message.
  if (rpcError) {
    return (
      <div className="max-w-lg mx-auto mt-8 p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-sm">
        Permissions could not be verified. Please refresh or contact an administrator.
      </div>
    );
  }

  if (anyOf && anyOf.length > 0) {
    const allowed = anyOf.some((p) => can(p.module, p.action));
    if (!allowed) {
      return <Navigate to="/admin" replace />;
    }
    return <>{children}</>;
  }

  if (permission) {
    if (!can(permission.module, permission.action)) {
      return <Navigate to="/admin" replace />;
    }
    return <>{children}</>;
  }

  return <>{children}</>;
}
