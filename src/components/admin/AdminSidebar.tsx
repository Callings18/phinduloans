import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Users,
  Shield,
  ShieldCheck,
  Building2,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
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
  Wallet,
  Scale,
  UserCircle,
  DollarSign,
  Mail,
  BookOpen,
} from "lucide-react";
import phinduLogo from "@/assets/phindu-logo.png";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ThemeToggle from "@/components/common/ThemeToggle";
import NotificationCenter from "@/components/common/NotificationCenter";

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
  /** Permission required to see item (module, action). If not set, visibility follows adminOnly only. */
  permission?: { module: string; action: string };
  /** Show "New" badge for recently improved modules */
  badge?: "New";
}

const menuGroups: MenuGroup[] = [
  {
    label: "Overview",
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin", badge: "New" },
    ],
  },
  {
    label: "Lending",
    defaultOpen: true,
    items: [
      { icon: FileText, label: "Applications", path: "/admin/applications", permission: { module: "loans", action: "view" }, badge: "New" },
      { icon: Users, label: "Borrowers", path: "/admin/borrowers", permission: { module: "borrowers", action: "view" } },
      { icon: Building2, label: "Employees", path: "/admin/employers" },
      { icon: Package, label: "Loan Products", path: "/admin/loan-products", permission: { module: "products", action: "view" }, badge: "New" },
      { icon: CreditCard, label: "Loans", path: "/admin/loans", permission: { module: "loans", action: "view" }, badge: "New" },
      { icon: CreditCard, label: "Disbursements", path: "/admin/disbursements", permission: { module: "disbursement", action: "view" }, badge: "New" },
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
    label: "Finance",
    defaultOpen: true,
    items: [
      { icon: Wallet, label: "Accounts", path: "/admin/accounts" },
      { icon: Receipt, label: "Expenses", path: "/admin/expenses" },
    ],
  },
  {
    label: "Recovery",
    defaultOpen: true,
    items: [
      { icon: AlertTriangle, label: "Collections", path: "/admin/collections" },
      { icon: FileX, label: "Write-Offs", path: "/admin/write-offs" },
      { icon: Scale, label: "Court Cases", path: "/admin/court-cases" },
    ],
  },
  {
    label: "Reports & Logs",
    defaultOpen: false,
    items: [
      { icon: BarChart3, label: "Reports", path: "/admin/reports", permission: { module: "reports", action: "view" }, badge: "New" },
      { icon: History, label: "Audit Logs", path: "/admin/audit-logs", permission: { module: "audit", action: "view" }, badge: "New" },
    ],
  },
  {
    label: "HR & Payroll",
    defaultOpen: false,
    items: [
      { icon: UserCircle, label: "HR Management", path: "/admin/hr", permission: { module: "payroll", action: "view" }, badge: "New" },
      { icon: DollarSign, label: "Payroll", path: "/admin/payroll", permission: { module: "payroll", action: "view" }, badge: "New" },
    ],
  },
  {
    label: "Administration",
    defaultOpen: false,
    items: [
      { icon: Shield, label: "Staff", path: "/admin/staff", adminOnly: true, badge: "New" },
      { icon: ShieldCheck, label: "Roles & Permissions", path: "/admin/roles-permissions", adminOnly: true, badge: "New" },
      { icon: FileSignature, label: "Contracts", path: "/admin/contract-templates", adminOnly: true },
      { icon: Mail, label: "Email Log", path: "/admin/email-log", adminOnly: true },
      { icon: BookOpen, label: "User Guide", path: "/admin/user-guide", badge: "New" },
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
  const { can } = usePermissions();

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
            <img
              src={phinduLogo}
              alt="Phindu Credit"
              className="h-10 object-contain"
            />
          </div>
        )}
        {collapsed && (
          <img
            src={phinduLogo}
            alt="Phindu"
            className="h-8 w-8 object-contain mx-auto rounded"
          />
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Quick Actions - Theme & Notifications */}
      <div className={cn(
        "px-4 py-3 border-b border-sidebar-border flex gap-2 shrink-0",
        collapsed ? "justify-center" : "justify-start"
      )}>
        <ThemeToggle variant={collapsed ? "minimal" : "default"} />
        {!collapsed && <NotificationCenter />}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {menuGroups.map((group) => {
          // Filter items: adminOnly and permission-based visibility
          const visibleItems = group.items.filter(item => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.permission && !can(item.permission.module, item.permission.action)) return false;
            return true;
          });
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
                    "flex items-center justify-center relative p-3 rounded-xl transition-all duration-200",
                    isActive
                      ? "gradient-primary text-primary-foreground shadow-button"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon size={20} />
                  {item.badge === "New" && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">New</span>
                  )}
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
                      <span className="font-medium text-sm flex-1">{item.label}</span>
                      {item.badge === "New" && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30">New</span>
                      )}
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
