import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Package,
  Banknote,
  Wallet,
  FileSignature,
  Settings,
  Shield,
  UserCog,
  BookOpen,
  Eye,
} from "lucide-react";
import phinduLogo from "@/assets/phindu-logo-white.png";
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
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    ],
  },
  {
    label: "Lending",
    items: [
      { icon: FileText, label: "Applications", path: "/admin/applications" },
      { icon: Users, label: "Borrowers", path: "/admin/borrowers" },
      { icon: Package, label: "Loan Products", path: "/admin/loan-products" },
      { icon: CreditCard, label: "Loans", path: "/admin/loans" },
    ],
  },
  {
    label: "Operations",
    items: [
      { icon: CreditCard, label: "Disbursements", path: "/admin/disbursements" },
      { icon: Banknote, label: "Repayments", path: "/admin/repayments" },
      { icon: Wallet, label: "Accounts", path: "/admin/accounts", adminOnly: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { icon: FileSignature, label: "Contract Templates", path: "/admin/contract-templates" },
      { icon: UserCog, label: "Staff", path: "/admin/staff" },
      { icon: Shield, label: "Roles & Permissions", path: "/admin/roles-permissions", adminOnly: true },
      { icon: BookOpen, label: "User Guide", path: "/admin/user-guide" },
      { icon: Settings, label: "Settings", path: "/admin/settings", adminOnly: true },
    ],
  },
];

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    menuGroups.reduce((acc, group) => ({ ...acc, [group.label]: true }), {})
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();

  // Filter menu items based on role
  const filteredMenuGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => !item.adminOnly || isAdmin),
  })).filter(group => group.items.length > 0);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActiveGroup = (group: MenuGroup) => {
    return group.items.some(item => location.pathname === item.path);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 transition-all duration-300 flex flex-col",
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
              className="h-10 object-contain invert dark:invert-0"
            />
          </div>
        )}
        {collapsed && (
          <img
            src={phinduLogo}
            alt="Phindu"
            className="h-8 w-8 object-contain mx-auto rounded invert dark:invert-0"
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
        {filteredMenuGroups.map((group) => {
          const isOpen = openGroups[group.label];
          const hasActiveItem = isActiveGroup(group);

          if (collapsed) {
            return group.items.map((item) => {
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
                {group.items.map((item) => {
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

      {/* View as Borrower + Logout */}
      <div className="p-4 border-t border-sidebar-border shrink-0 space-y-2">
        <Button
          variant="outline"
          onClick={() => navigate('/dashboard')}
          className={cn(
            "w-full justify-start text-primary border-primary/30 hover:bg-primary/10",
            collapsed && "justify-center"
          )}
          title="View Borrower Dashboard"
        >
          <Eye size={20} />
          {!collapsed && <span className="ml-3">View as Borrower</span>}
        </Button>
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
