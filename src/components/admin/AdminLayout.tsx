// AdminLayout — Auth guard is handled by AdminRoute, so no redundant check here
import AdminSidebar from "./AdminSidebar";
import AdminRealTimeNotifications from "./AdminRealTimeNotifications";
import { usePermissions } from "@/hooks/usePermissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminShell } from "@/contexts/AdminShellContext";
import { cn } from "@/lib/utils";
import phinduLogo from "@/assets/phindu-logo-white.png";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { rpcError, isLoading } = usePermissions();
  const { sidebarCollapsed, mobileNavOpen, setMobileNavOpen, closeMobileNav } = useAdminShell();

  return (
    <div className="min-h-screen bg-background">
      <button
        type="button"
        aria-label="Close menu"
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity lg:hidden",
          mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={closeMobileNav}
      />

      <header className="fixed top-0 left-0 right-0 z-[45] flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-expanded={mobileNavOpen}
          aria-controls="admin-sidebar-nav"
          onClick={() => setMobileNavOpen((o) => !o)}
        >
          {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <img src={phinduLogo} alt="Phindu Credit" className="h-8 object-contain invert dark:invert-0" />
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">Admin</span>
      </header>

      <AdminSidebar />
      <main
        className={cn(
          "min-h-screen transition-[margin] duration-300",
          "ml-0 pt-14 lg:pt-0",
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
        )}
      >
        <div className="mx-auto max-w-[100vw] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {!isLoading && rpcError && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Permissions could not be loaded</AlertTitle>
              <AlertDescription>
                Role checks in the UI may hide actions until this is fixed. Database policies still apply.{" "}
                <span className="font-mono text-xs opacity-90 break-all">{rpcError}</span>
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
