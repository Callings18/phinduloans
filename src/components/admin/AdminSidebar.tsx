import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
} from "lucide-react";
import phinduLogo from "@/assets/phindu-logo-white.png";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ThemeToggle from "@/components/common/ThemeToggle";
import NotificationCenter from "@/components/common/NotificationCenter";
import { adminMenuGroups, type SidebarMenuItem } from "./adminSidebarConfig";

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    adminMenuGroups.reduce((acc, group) => ({ ...acc, [group.label]: true }), {})
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const { can, isLoading: permsLoading } = usePermissions();

  const visibleItem = useCallback(
    (item: SidebarMenuItem): boolean => {
      if (item.adminOnly && !isAdmin) return false;
      if (!item.perm) return true;
      if (permsLoading) return false;
      if (isAdmin) return true;
      return can(item.perm.module, item.perm.action);
    },
    [isAdmin, permsLoading, can],
  );

  const filteredMenuGroups = useMemo(
    () =>
      adminMenuGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(visibleItem),
        }))
        .filter((g) => g.items.length > 0),
    [visibleItem],
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const pathActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const isActiveGroup = (group: (typeof filteredMenuGroups)[0]) =>
    group.items.some((item) => pathActive(item.path));

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 transition-all duration-300 flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
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

      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div
        className={cn(
          "px-4 py-3 border-b border-sidebar-border flex gap-2 shrink-0",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        <ThemeToggle variant={collapsed ? "minimal" : "default"} />
        {!collapsed && <NotificationCenter />}
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {filteredMenuGroups.map((group) => {
          const isOpen = openGroups[group.label];
          const hasActiveItem = isActiveGroup(group);

          if (collapsed) {
            return group.items.map((item) => {
              const isActive = pathActive(item.path);
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
                  const isActive = pathActive(item.path);
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

      <div className="p-4 border-t border-sidebar-border shrink-0 space-y-2">
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard?view=borrower")}
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
