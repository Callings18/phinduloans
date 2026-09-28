/**
 * Route-level guard for /admin/*.
 * Staff stay on office.phindu.com — never bounce failed logins to the borrower PWA.
 */
import { Navigate, Outlet, Link } from "react-router-dom";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { AdminShellProvider } from "@/contexts/AdminShellContext";
import { Button } from "@phinduloans/shared/components/ui/button";

export default function AdminRoute() {
  const { user, isLoading, isStaff, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth?next=/admin" replace />;
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-bold text-foreground">Staff access required</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          This account signed in, but it has no staff role in Supabase (<code>user_roles</code>).
          Ask a super admin to grant <strong>admin</strong> or another staff role, then sign in again.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>
          <Button asChild>
            <Link to="/auth">Back to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AdminShellProvider>
      <Outlet />
    </AdminShellProvider>
  );
}
