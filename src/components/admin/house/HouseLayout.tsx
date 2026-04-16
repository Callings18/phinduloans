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
  { key: "review", label: "Review", icon: ClipboardCheck, path: "review" },
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
  if (!accessLoading && (hasAccess === false || accessError)) {
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

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{product?.name || productCode}</h1>
            <p className="text-muted-foreground text-sm">Product house workspace</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{productCode}</Badge>
            <BetaBadge />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {houseTabs.map((tab) => {
            const path = tab.path ? `/admin/houses/${productCode}/${tab.path}` : `/admin/houses/${productCode}`;
            const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
            const Icon = tab.icon;
            return (
              <Button key={tab.key} variant={active ? "default" : "outline"} size="sm" asChild>
                <Link to={path}>
                  <Icon className="h-4 w-4 mr-1" />
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
