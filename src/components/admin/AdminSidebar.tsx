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
  X,
} from "lucide-react";
import phinduLogo from "@/assets/phindu-logo-white.png";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAdminShell } from "@/contexts/AdminShellContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ThemeToggle from "@/components/common/ThemeToggle";
import NotificationCenter from "@/components/common/NotificationCenter";
import { adminMenuGroups, type SidebarMenuItem } from "./adminSidebarConfig";
import { isBetaModule } from "@/config/featureRollout";
import { BetaBadge } from "@/components/admin/BetaBadge";

const AdminSidebar = () => {
  const { sidebarCollapsed, setSidebarCollapsed, mobileNavOpen, closeMobileNav } = useAdminShell();
  const isLg = useMediaQuery("(min-width: 1024px)");
  const showCollapsedNav = sidebarCollapsed && isLg;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    adminMenuGroups.reduce((acc, group) => ({ ...acc, [group.label]: true }), {})
  );
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
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
          items: group.items.filter(visibleItem).map((item) => ({
            ...item,
            children: item.children?.filter(visibleItem),
          })),
        }))
        .filter((g) => g.items.length > 0),
    [visibleItem],
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleSubMenu = (path: string) => {
    setOpenSubMenus((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const pathActive = (path: string) => {
    if (path === "/admin/loans") {
      return location.pathname === "/admin/loans";
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const isChildActive = (item: SidebarMenuItem) =>
    item.children?.some((child) => pathActive(child.path)) ?? false;

  const isActiveGroup = (group: (typeof filteredMenuGroups)[0]) =>
    group.items.some((item) => pathActive(item.path) || isChildActive(item));

  useEffect(() => {
    closeMobileNav();
  }, [location.pathname, closeMobileNav]);

  return (
    <aside
      id="admin-sidebar-nav"
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar shadow-xl transition-transform duration-300 ease-out lg:shadow-none lg:transition-[transform,width] lg:duration-300",
        sidebarCollapsed ? "w-64 lg:w-20" : "w-64",
        mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-3 lg:h-20 lg:px-4">
        {showCollapsedNav ? (
          <img
            src={phinduLogo}
            alt="Phindu"
            className="mx-auto h-8 w-8 rounded object-contain invert dark:invert-0"
          />
        ) : (
          <div className="flex w-full min-w-0 items-center justify-between gap-2">
            <img
              src={phinduLogo}
              alt="Phindu Credit"
              className="h-9 max-h-10 shrink-0 object-contain invert dark:invert-0 lg:h-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-sidebar-foreground lg:hidden"
              aria-label="Close menu"
              onClick={closeMobileNav}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSidebarCollapsed((c) => !c)}
        className={cn(
          "absolute -right-3 top-24 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground transition-colors hover:text-foreground",
          !isLg && "hidden",
        )}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div
        className={cn(
          "flex shrink-0 gap-2 border-b border-sidebar-border px-3 py-3 lg:px-4",
          showCollapsedNav ? "justify-center" : "justify-start",
        )}
      >
        <ThemeToggle variant={showCollapsedNav ? "minimal" : "default"} />
        {!showCollapsedNav && <NotificationCenter />}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3 lg:p-4">
        {filteredMenuGroups.map((group) => {
          const isOpen = openGroups[group.label];
          const hasActiveItem = isActiveGroup(group);

          if (showCollapsedNav) {
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
                  const hasChildren = item.children && item.children.length > 0;
                  const childActive = isChildActive(item);
                  const subOpen = openSubMenus[item.path] ?? childActive;

                  if (hasChildren) {
                    return (
                      <Collapsible
                        key={item.path}
                        open={subOpen}
                        onOpenChange={() => toggleSubMenu(item.path)}
                      >
                        <div className="ml-2">
                          <div className="flex items-center">
                            <Link
                              to={item.path}
                              className={cn(
                                "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                                isActive
                                  ? "gradient-primary text-primary-foreground shadow-button"
                                  : childActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                              )}
                            >
                              <item.icon size={18} />
                              <span className="font-medium text-sm inline-flex items-center flex-wrap gap-x-1">
                                {item.label}
                                {item.betaKey && isBetaModule(item.betaKey) ? <BetaBadge /> : null}
                              </span>
                            </Link>
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                              >
                                <ChevronDown
                                  size={14}
                                  className={cn(
                                    "transition-transform duration-200",
                                    subOpen && "rotate-180"
                                  )}
                                />
                              </button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="space-y-0.5 mt-0.5 ml-4 border-l border-sidebar-border pl-2">
                            {item.children!.map((child) => {
                              const isChildItemActive = pathActive(child.path);
                              return (
                                <Link
                                  key={child.path}
                                  to={child.path}
                                  className={cn(
                                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 text-sm",
                                    isChildItemActive
                                      ? "gradient-primary text-primary-foreground shadow-button"
                                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                  )}
                                >
                                  <child.icon size={15} />
                                  <span className="font-medium">{child.label}</span>
                                </Link>
                              );
                            })}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  }

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
                      <span className="font-medium text-sm inline-flex items-center flex-wrap gap-x-1">
                        {item.label}
                        {item.betaKey && isBetaModule(item.betaKey) ? <BetaBadge /> : null}
                      </span>
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
            "w-full justify-start border-primary/30 text-primary hover:bg-primary/10",
            showCollapsedNav && "justify-center",
          )}
          title="View Borrower Dashboard"
        >
          <Eye size={20} />
          {!showCollapsedNav && <span className="ml-3">View as Borrower</span>}
        </Button>
        <Button
          variant="ghost"
          onClick={signOut}
          className={cn(
            "w-full justify-start text-muted-foreground hover:text-destructive",
            showCollapsedNav && "justify-center",
          )}
        >
          <LogOut size={20} />
          {!showCollapsedNav && <span className="ml-3">Logout</span>}
        </Button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
