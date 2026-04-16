import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHouseReportSummary } from "@/hooks/useHouseData";
import { Badge } from "@/components/ui/badge";
import { format, isPast } from "date-fns";
import { Banknote, TrendingUp, AlertTriangle, CheckCircle2, Clock, Users } from "lucide-react";
import MarketeerDailyCollectionTracker from "@/components/admin/marketeer/MarketeerDailyCollectionTracker";
import MarketeerTierBreakdown from "@/components/admin/marketeer/MarketeerTierBreakdown";

export default function HouseDashboardPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data } = useHouseReportSummary(productCode);

  // For non-Marketeer products: fetch repayment summary
  const { data: repaymentStats } = useQuery({
    queryKey: ["house-repayment-stats", productCode],
    enabled: productCode !== "MARKETEER" && Boolean(productCode),
    queryFn: async () => {
      const { data: product } = await supabase
        .from("loan_products")
        .select("id")
        .eq("product_code", productCode)
        .maybeSingle();
      if (!product) return null;
      
      const { data: loans } = await supabase
        .from("loan_applications")
        .select("id")
        .eq("loan_product_id", product.id)
        .in("status", ["active", "disbursed"]);

      const loanIds = (loans ?? []).map((l: any) => l.id);
      if (loanIds.length === 0) return { dueToday: 0, overdue: 0, collectedThisMonth: 0, totalOutstanding: 0 };

      const { data: repayments } = await supabase
        .from("loan_repayments")
        .select("amount, due_date, status, principal_paid, paid_date")
        .in("loan_id", loanIds);

      const today = format(new Date(), "yyyy-MM-dd");
      const monthStart = format(new Date(), "yyyy-MM-01");
      const reps = repayments ?? [];
      
      return {
        dueToday: reps.filter((r: any) => r.due_date === today && r.status !== "paid" && r.status !== "cancelled")
          .reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
        overdue: reps.filter((r: any) => r.status !== "paid" && r.status !== "cancelled" && isPast(new Date(r.due_date)) && r.due_date !== today)
          .reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
        collectedThisMonth: reps.filter((r: any) => r.status === "paid" && r.paid_date && r.paid_date >= monthStart)
          .reduce((s: number, r: any) => s + Number(r.principal_paid || r.amount || 0), 0),
        totalOutstanding: reps.filter((r: any) => r.status !== "paid" && r.status !== "cancelled")
          .reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
      };
    },
  });

  const topCards = [
    { label: "Total loans", value: data?.totalLoans ?? 0, icon: Users },
    { label: "Active loans", value: data?.activeLoans ?? 0, icon: TrendingUp },
    { label: "Overdue items", value: data?.overdue ?? 0, icon: AlertTriangle },
    { label: "Total disbursed", value: `K${Number(data?.totalDisbursed ?? 0).toLocaleString()}`, icon: Banknote },
  ];
  const extraCards =
    productCode === "PAYDAY_SOFT"
      ? [{ label: "Policy", value: "Lusaka / 30 days" }]
      : productCode === "COLLATERAL"
        ? [{ label: "Collateral", value: "Required" }]
        : productCode === "BUSINESS"
          ? [{ label: "Business Owner Focus", value: "Enabled" }]
          : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <c.icon className="h-4 w-4 text-muted-foreground" />
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{c.value}</p></CardContent>
          </Card>
        ))}
      </div>
      {extraCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {extraCards.map((c) => (
            <Card key={c.label}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{c.label}</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-semibold">{c.value}</p></CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Collection summary for non-Marketeer products */}
      {productCode !== "MARKETEER" && repaymentStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Banknote className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Due today</p>
                <p className="text-lg font-bold">K{repaymentStats.dueToday.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Total overdue</p>
                <p className="text-lg font-bold text-destructive">K{repaymentStats.overdue.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Collected this month</p>
                <p className="text-lg font-bold text-green-600">K{repaymentStats.collectedThisMonth.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold">K{repaymentStats.totalOutstanding.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {productCode === "MARKETEER" && (
        <>
          <MarketeerTierBreakdown />
          <MarketeerDailyCollectionTracker />
        </>
      )}
    </div>
  );
}
