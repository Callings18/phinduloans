import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";

/** Build dashboard URL that auto-opens the loan application form. */
function buildApplyDashboardPath(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set("apply", "true");
  return `/dashboard?${params.toString()}`;
}

/**
 * /apply redirects into the dashboard apply flow:
 * - Authenticated → /dashboard?apply=true (+ product/amount/term from query)
 * - Unauthenticated → /auth?next=... (preserves apply intent)
 */
const Apply = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;
    const dashboardApply = buildApplyDashboardPath(location.search);
    if (user) {
      navigate(dashboardApply, { replace: true });
    } else {
      navigate(`/auth?next=${encodeURIComponent(dashboardApply)}`, { replace: true });
    }
  }, [user, isLoading, navigate, location.search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default Apply;
