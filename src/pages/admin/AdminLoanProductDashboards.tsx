import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ArrowUpRight } from "lucide-react";
import { isBetaModule } from "@/config/featureRollout";
import { BetaBadge } from "@/components/admin/BetaBadge";

export default function AdminLoanProductDashboards() {
  const showBeta = isBetaModule("product_dashboards");

  const { data: products, isLoading } = useQuery({
    queryKey: ["loan-products-dashboard-hub"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, name, product_code, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; product_code: string | null; is_active: boolean | null }[];
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2 flex-wrap">
              Loan product dashboards
              {showBeta ? <BetaBadge /> : null}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Open a scoped KPI view for each active loan product (same metrics as the main dashboard, filtered).
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin/loans">
              Loan portfolio
              <ArrowUpRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>

        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Products
            </CardTitle>
            <CardDescription>Choose a product to open its dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : !products?.length ? (
              <p className="text-muted-foreground text-sm">No active loan products.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <li key={p.id}>
                    <Button variant="secondary" className="w-full h-auto py-4 justify-between" asChild>
                      <Link to={`/admin/loans/products/${p.id}/dashboard`}>
                        <span className="text-left">
                          <span className="font-medium block">{p.name}</span>
                          {p.product_code ? (
                            <span className="text-xs font-mono text-muted-foreground">{p.product_code}</span>
                          ) : null}
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70" />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
