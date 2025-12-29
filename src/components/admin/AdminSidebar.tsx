import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Users,
  Shield,
  Building2,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Package,
  Banknote,
  Receipt,
  History,
  FileX,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: FileText, label: "Applications", path: "/admin/applications" },
  { icon: Users, label: "Borrowers", path: "/admin/borrowers" },
  { icon: Building2, label: "Employers", path: "/admin/employers" },
  { icon: Package, label: "Loan Products", path: "/admin/loan-products" },
  { icon: CreditCard, label: "Loans", path: "/admin/loans" },
  { icon: Banknote, label: "Repayments", path: "/admin/repayments" },
  { icon: FileText, label: "Collections", path: "/admin/collections" },
  { icon: CreditCard, label: "Disbursements", path: "/admin/disbursements" },
  { icon: BarChart3, label: "Reports", path: "/admin/reports" },
  { icon: FileX, label: "Write-Offs", path: "/admin/write-offs" },
  { icon: History, label: "Audit Logs", path: "/admin/audit-logs" },
  { icon: Shield, label: "Staff", path: "/admin/staff" },
  { icon: Settings, label: "Settings", path: "/admin/settings" },
];

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { signOut, isAdmin } = useAuth();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 transition-all duration-300 tour-admin-nav",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
              <Sparkles className="text-primary-foreground" size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-sidebar-foreground font-bold text-lg leading-tight">PHINDU</span>
              <span className="text-muted-foreground text-xs">Admin Portal</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center mx-auto">
            <Sparkles className="text-primary-foreground" size={20} />
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          // Hide sensitive modules from non-admin staff
          if ((item.label === 'Staff' || item.label === 'Settings' || item.label === 'Loan Products') && !isAdmin) {
            return null;
          }

          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                isActive
                  ? "gradient-primary text-primary-foreground shadow-button"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon size={20} />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="absolute bottom-4 left-0 right-0 px-4">
        <Button
          variant="ghost"
          onClick={signOut}
          className={cn(
            "w-full justify-start text-muted-foreground hover:text-destructive",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={20} />
          {!collapsed && <span className="ml-3">Logout</span>}
        </Button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
