import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminDashboardContent } from "@/pages/admin/AdminDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      const { data, error } = await supabase.from("loan_products").select("id, name, product_code").eq("id", pid).maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; product_code: string | null } | null;
    },
    enabled: !!pid,
  });

  const { data: productWidgets } = useQuery({
    queryKey: ["product-dashboard-widgets", pid],
    queryFn: async () => {
      if (!pid || !product?.id) return null;
      const productCode = (product as { product_code?: string | null }).product_code || null;

      if (productCode === "MARKETEER") {
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from("loan_repayments")
          .select("id, due_date, status, amount, loan:loan_applications!inner(loan_product_id)")
          .eq("loan.loan_product_id", pid);
        if (error) throw error;
        const todaysDue = (data || []).filter((r: any) => r.due_date === today);
        const todaysMissed = todaysDue.filter((r: any) => r.status !== "paid");
        return {
          titleA: "Expected Daily Collections",
          valueA: `K${todaysDue.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0).toLocaleString()}`,
          titleB: "Missed Daily Repayments",
          valueB: String(todaysMissed.length),
        };
      }

      if (productCode === "MOTOR_VEHICLE") {
        const { data, error } = await supabase
          .from("loan_applications")
          .select("id, product_specific_data")
          .eq("loan_product_id", pid)
          .in("status", ["approved", "active", "disbursed"]);
        if (error) throw error;
        const insured = (data || []).filter((l: any) => Boolean((l.product_specific_data || {}).comprehensive_insurance)).length;
        return {
          titleA: "Insured Active Loans",
          valueA: String(insured),
          titleB: "Uninsured Active Loans",
          valueB: String((data || []).length - insured),
        };
      }

      if (productCode === "SALARY_ADVANCE" || productCode === "SALARY_ADVANCE_STAFF") {
        const { data, error } = await supabase
          .from("loan_repayments")
          .select("id, due_date, status, loan:loan_applications!inner(loan_product_id)")
          .eq("loan.loan_product_id", pid);
        if (error) throw error;
        const dueOn23 = (data || []).filter((r: any) => {
          const d = new Date(r.due_date);
          return d.getDate() === 23;
        }).length;
        return {
          titleA: "Due on 23rd",
          valueA: String(dueOn23),
          titleB: "Other Due Dates",
          valueB: String((data || []).length - dueOn23),
        };
      }

      if (productCode === "PAYDAY_SOFT") {
        const { data, error } = await supabase
          .from("loan_applications")
          .select("id, city, status")
          .eq("loan_product_id", pid);
        if (error) throw error;
        const lusaka = (data || []).filter((l: any) => String(l.city || "").toLowerCase() === "lusaka").length;
        return {
          titleA: "Lusaka Applications",
          valueA: String(lusaka),
          titleB: "Outside Lusaka",
          valueB: String((data || []).length - lusaka),
        };
      }

      if (productCode === "COLLATERAL") {
        const { data, error } = await supabase
          .from("loan_applications")
          .select("id, status")
          .eq("loan_product_id", pid);
        if (error) throw error;
        const approvedOrDisbursed = (data || []).filter((l: any) => ["approved", "disbursed", "active"].includes(l.status)).length;
        return {
          titleA: "Secured Active/Approved",
          valueA: String(approvedOrDisbursed),
          titleB: "Collateral Pipeline",
          valueB: String((data || []).length),
        };
      }

      if (productCode === "BUSINESS") {
        const { data, error } = await supabase
          .from("loan_applications")
          .select("id, employment_type, status")
          .eq("loan_product_id", pid);
        if (error) throw error;
        const ownerCaptured = (data || []).filter((l: any) => ["self_employed", "contract"].includes(l.employment_type)).length;
        return {
          titleA: "Business-owner Profiles",
          valueA: String(ownerCaptured),
          titleB: "Business Loan Pipeline",
          valueB: String((data || []).length),
        };
      }

      return null;
    },
    enabled: !!pid && !!product,
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
      afterContent={
        productWidgets ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{productWidgets.titleA}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{productWidgets.valueA}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{productWidgets.titleB}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{productWidgets.valueB}</p></CardContent>
            </Card>
          </div>
        ) : null
      }
    />
  );
}
