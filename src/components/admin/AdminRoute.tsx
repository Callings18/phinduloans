/**
 * Route-level guard for /admin/*. Checks user and isStaff before rendering;
 * redirects to /auth or /dashboard to avoid brief flash of admin UI.
 * Document in FLOWS_AND_MODULES_AUDIT.md.
 */
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function AdminRoute() {
  const { user, isLoading, isStaff } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isStaff) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
