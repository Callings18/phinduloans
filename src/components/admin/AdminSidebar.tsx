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
  ChevronDown,
  Package,
  Banknote,
  Receipt,
  History,
  FileX,
  AlertTriangle,
  Layers,
  FileSignature,
  Landmark,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MenuGroup {
  label: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const menuGroups: MenuGroup[] = [
  {
    label: "Overview",
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    ],
  },
  {
    label: "Lending",
    defaultOpen: true,
    items: [
      { icon: FileText, label: "Applications", path: "/admin/applications" },
      { icon: Users, label: "Borrowers", path: "/admin/borrowers" },
      { icon: Building2, label: "Employees", path: "/admin/employers" },
      { icon: Package, label: "Loan Products", path: "/admin/loan-products", adminOnly: true },
      { icon: CreditCard, label: "Loans", path: "/admin/loans" },
      { icon: CreditCard, label: "Disbursements", path: "/admin/disbursements" },
    ],
  },
  {
    label: "Payments",
    defaultOpen: true,
    items: [
      { icon: Banknote, label: "Repayments", path: "/admin/repayments" },
      { icon: Layers, label: "Bulk Repayments", path: "/admin/bulk-repayments" },
      { icon: Landmark, label: "PMIC", path: "/admin/pmic" },
    ],
  },
  {
    label: "Recovery",
    defaultOpen: true,
    items: [
      { icon: AlertTriangle, label: "Collections", path: "/admin/collections" },
      { icon: FileX, label: "Write-Offs", path: "/admin/write-offs" },
    ],
  },
  {
    label: "Reports & Logs",
    defaultOpen: false,
    items: [
      { icon: BarChart3, label: "Reports", path: "/admin/reports" },
      { icon: History, label: "Audit Logs", path: "/admin/audit-logs" },
    ],
  },
  {
    label: "Administration",
    defaultOpen: false,
    items: [
      { icon: Shield, label: "Staff", path: "/admin/staff", adminOnly: true },
      { icon: FileSignature, label: "Contracts", path: "/admin/contract-templates", adminOnly: true },
      { icon: Settings, label: "Settings", path: "/admin/settings", adminOnly: true },
    ],
  },
];

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    menuGroups.reduce((acc, group) => ({ ...acc, [group.label]: group.defaultOpen ?? true }), {})
  );
  const location = useLocation();
  const { signOut, isAdmin } = useAuth();

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActiveGroup = (group: MenuGroup) => {
    return group.items.some(item => location.pathname === item.path);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 transition-all duration-300 tour-admin-nav flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
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
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {menuGroups.map((group) => {
          // Filter items based on admin status
          const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          const isOpen = openGroups[group.label];
          const hasActiveItem = isActiveGroup(group);

          if (collapsed) {
            // When collapsed, just show icons without groups
            return visibleItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={cn(
                    "flex items-center justify-center p-3 rounded-xl transition-all duration-200",
                    isActive
                      ? "gradient-primary text-primary-foreground shadow-button"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon size={20} />
                </Link>
              );
            });
          }

          return (
            <Collapsible
              key={group.label}
              open={isOpen}
              onOpenChange={() => toggleGroup(group.label)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                <span className={cn(hasActiveItem && "text-primary")}>{group.label}</span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ml-2",
                        isActive
                          ? "gradient-primary text-primary-foreground shadow-button"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon size={18} />
                      <span className="font-medium text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border shrink-0">
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
