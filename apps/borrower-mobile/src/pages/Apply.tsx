import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";

/**
 * /apply now redirects:
 * - Authenticated → /dashboard
 * - Unauthenticated → /auth?redirect=dashboard
 */
const Apply = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/auth?redirect=dashboard", { replace: true });
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default Apply;
