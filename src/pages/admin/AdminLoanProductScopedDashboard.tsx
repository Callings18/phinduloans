import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminDashboardContent } from "@/pages/admin/AdminDashboard";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { isBetaModule } from "@/config/featureRollout";
import { BetaBadge } from "@/components/admin/BetaBadge";

export default function AdminLoanProductScopedDashboard() {
  const { productId } = useParams<{ productId: string }>();
  const pid = productId || "";

  const { data: product } = useQuery({
    queryKey: ["loan-product-name", pid],
    queryFn: async () => {
      if (!pid) return null;
      const { data, error } = await supabase.from("loan_products").select("id, name").eq("id", pid).maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string } | null;
    },
    enabled: !!pid,
  });

  if (!pid) {
    return (
      <AdminDashboardContent
        loanProductId={null}
        title="Product dashboard"
        backLink={
          <Button variant="ghost" size="sm" className="mb-1 -ml-2" asChild>
            <Link to="/admin/loan-product-dashboards">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Hub
            </Link>
          </Button>
        }
      />
    );
  }

  const showBeta = isBetaModule("product_dashboards");

  return (
    <AdminDashboardContent
      loanProductId={pid}
      title={
        <span className="inline-flex items-center gap-2 flex-wrap">
          {product?.name || "Product dashboard"}
          {showBeta ? <BetaBadge /> : null}
        </span>
      }
      backLink={
        <Button variant="ghost" size="sm" className="mb-1 -ml-2" asChild>
          <Link to="/admin/loan-product-dashboards">
            <ChevronLeft className="h-4 w-4 mr-1" />
            All product dashboards
          </Link>
        </Button>
      }
    />
  );
}
