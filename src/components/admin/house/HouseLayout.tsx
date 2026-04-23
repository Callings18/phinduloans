import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { useHouseProduct } from "@/hooks/useHouseData";
import { useProductAccess } from "@/hooks/useProductAccess";
import { Badge } from "@/components/ui/badge";
import { BetaBadge } from "@/components/admin/BetaBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Users, CreditCard, ClipboardCheck, Banknote, AlertTriangle, BarChart3 } from "lucide-react";

const houseTabs = [
  { key: "dashboard", label: "Dashboard", icon: Home, path: "" },
  { key: "borrowers", label: "Borrowers", icon: Users, path: "borrowers" },
  { key: "loans", label: "Loans", icon: CreditCard, path: "loans" },
  { key: "disbursements", label: "Disbursements", icon: Banknote, path: "disbursements" },
  { key: "collections", label: "Collections", icon: AlertTriangle, path: "collections" },
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {product?.name || productCode}
            </h1>
            <p className="text-sm text-muted-foreground">Product house workspace</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="outline" className="max-w-full truncate">
              {productCode}
            </Badge>
            <BetaBadge />
          </div>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {houseTabs.map((tab) => {
            const path = tab.path ? `/admin/houses/${productCode}/${tab.path}` : `/admin/houses/${productCode}`;
            const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
            const Icon = tab.icon;
            return (
              <Button
                key={tab.key}
                variant={active ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                asChild
              >
                <Link to={path}>
                  <Icon className="mr-1 h-4 w-4 shrink-0" />
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
