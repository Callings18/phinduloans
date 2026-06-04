import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { useHouseProduct } from "@/hooks/useHouseData";
import { useProductAccess } from "@/hooks/useProductAccess";
import { Badge } from "@/components/ui/badge";
import { BetaBadge } from "@/components/admin/BetaBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Users, CreditCard, Banknote, AlertTriangle, BarChart3, ClipboardCheck, Receipt } from "lucide-react";

const houseTabs = [
  { key: "dashboard", label: "Dashboard", icon: Home, path: "" },
  { key: "borrowers", label: "Borrowers", icon: Users, path: "borrowers" },
  { key: "loans", label: "Loans", icon: CreditCard, path: "loans" },
  { key: "review", label: "Review", icon: ClipboardCheck, path: "review" },
  { key: "disbursements", label: "Disbursements", icon: Banknote, path: "disbursements" },
  { key: "collections", label: "Collections", icon: AlertTriangle, path: "collections" },
  { key: "reconciliation", label: "Reconciliation", icon: Receipt, path: "reconciliation" },
  { key: "reports", label: "Reports", icon: BarChart3, path: "reports" },
];

export default function HouseLayout() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const location = useLocation();
  const { data: product, isLoading } = useHouseProduct(productCode);
  const { data: hasAccess, isLoading: accessLoading, isError: accessError } = useProductAccess(productCode);

  if (!isLoading && !product) {
    return <Navigate to="/admin" replace />;
  }
  if (!accessLoading && hasAccess === false) {
    return (
      <AdminLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>You do not have access to this loan product house.</p>
            <p>Ask an administrator to grant product access in `user_product_access`.</p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  if (!accessLoading && accessError) {
    return (
      <AdminLayout>
        <Card>
          <CardHeader>
            <CardTitle>Could not verify access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We could not confirm your product access right now. This may be a temporary network issue.</p>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/houses">Back to houses</Link>
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 via-background to-background px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Product house
              </p>
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {product?.name || productCode}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Product house workspace
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="max-w-full truncate text-[11px]">
                {productCode}
              </Badge>
              <BetaBadge />
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-lg border border-border/60 bg-background/95 p-1 px-1 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-wrap sm:overflow-visible">
          {houseTabs.map((tab) => {
            const path = tab.path ? `/admin/houses/${productCode}/${tab.path}` : `/admin/houses/${productCode}`;
            const active =
              tab.path === ""
                ? location.pathname === path
                : location.pathname === path || location.pathname.startsWith(`${path}/`);
            const Icon = tab.icon;
            return (
              <Button
                key={tab.key}
                variant={active ? "default" : "ghost"}
                size="sm"
                className="h-8 shrink-0 text-xs font-medium"
                asChild
              >
                <Link to={path}>
                  <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  {tab.label}
                </Link>
              </Button>
            );
          })}
        </div>

        <Outlet />
      </div>
    </AdminLayout>
  );
}
