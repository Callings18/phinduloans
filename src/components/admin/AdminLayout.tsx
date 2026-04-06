// AdminLayout — Auth guard is handled by AdminRoute, so no redundant check here
import AdminSidebar from "./AdminSidebar";
import AdminRealTimeNotifications from "./AdminRealTimeNotifications";
import { usePermissions } from "@/hooks/usePermissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { rpcError, isLoading } = usePermissions();

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="ml-20 lg:ml-64 min-h-screen transition-all duration-300">
        <div className="p-6 lg:p-8">
          {!isLoading && rpcError && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Permissions could not be loaded</AlertTitle>
              <AlertDescription>
                Role checks in the UI may hide actions until this is fixed. Database policies still apply.{" "}
                <span className="font-mono text-xs opacity-90">{rpcError}</span>
              </AlertDescription>
            </Alert>
          )}
          {children}
        </div>
      </main>
      <AdminRealTimeNotifications />
    </div>
  );
};

export default AdminLayout;
