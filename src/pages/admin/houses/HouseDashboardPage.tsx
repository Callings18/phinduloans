import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHouseReportSummary } from "@/hooks/useHouseData";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Badge } from "@/components/ui/badge";
import { format, isPast } from "date-fns";
import { Banknote, TrendingUp, AlertTriangle, CheckCircle2, Clock, Users } from "lucide-react";
import MarketeerDailyCollectionTracker from "@/components/admin/marketeer/MarketeerDailyCollectionTracker";
import MarketeerTierBreakdown from "@/components/admin/marketeer/MarketeerTierBreakdown";
import HouseProductConfigCard from "@/components/admin/house/HouseProductConfigCard";

type RepaymentSummaryRow = {
  amount: number | null;
  due_date: string;
  status: string;
  principal_paid: number | null;
  paid_date: string | null;
};

export default function HouseDashboardPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data } = useHouseReportSummary(productCode);

  // Live updates for the house dashboard whenever loans, repayments,
  // disbursements or payment claims change.
  useRealtimeInvalidate(
    ["loan_applications", "loan_repayments", "disbursements", "payment_claims"],
    [
      ["house-report-summary", productCode],
      ["house-repayment-stats", productCode],
      ["house-loans", productCode],
      ["house-disbursements", productCode],
      ["house-repayments", productCode],
    ],
    `house-${productCode}-realtime`,
  );

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
      
      const { data: loans, error: loansError } = await supabase
        .from("loan_applications")
        .select("id")
        .eq("loan_product_id", product.id)
        .in("status", ["active", "disbursed"]);
      if (loansError) throw loansError;

      const loanIds = (loans ?? []).map((l) => l.id);
      if (loanIds.length === 0) return { dueToday: 0, overdue: 0, collectedThisMonth: 0, totalOutstanding: 0 };

      const { data: repayments, error: repaymentsError } = await supabase
        .from("loan_repayments")
        .select("amount, due_date, status, principal_paid, paid_date")
        .in("loan_id", loanIds);
      if (repaymentsError) throw repaymentsError;

      const today = format(new Date(), "yyyy-MM-dd");
      const monthStart = format(new Date(), "yyyy-MM-01");
      const reps = (repayments ?? []) as RepaymentSummaryRow[];
      
      return {
        dueToday: reps
          .filter((r) => r.due_date === today && r.status !== "paid" && r.status !== "cancelled")
          .reduce((s, r) => s + Number(r.amount || 0), 0),
        overdue: reps
          .filter((r) => r.status !== "paid" && r.status !== "cancelled" && isPast(new Date(r.due_date)) && r.due_date !== today)
          .reduce((s, r) => s + Number(r.amount || 0), 0),
        collectedThisMonth: reps
          .filter((r) => r.status === "paid" && r.paid_date && r.paid_date >= monthStart)
          .reduce((s, r) => s + Number(r.principal_paid || r.amount || 0), 0),
        totalOutstanding: reps
          .filter((r) => r.status !== "paid" && r.status !== "cancelled")
          .reduce((s, r) => s + Number(r.amount || 0), 0),
      };
    },
  });

  const topCards = [
    { label: "Total loans", value: data?.totalLoans ?? 0, icon: Users, accent: "from-primary/20 to-primary/5", iconClass: "text-primary" },
    { label: "Active loans", value: data?.activeLoans ?? 0, icon: TrendingUp, accent: "from-emerald-500/20 to-emerald-500/5", iconClass: "text-emerald-500" },
    { label: "Overdue items", value: data?.overdue ?? 0, icon: AlertTriangle, accent: "from-destructive/20 to-destructive/5", iconClass: "text-destructive" },
    { label: "Total disbursed", value: `K${Number(data?.totalDisbursed ?? 0).toLocaleString()}`, icon: Banknote, accent: "from-amber-500/20 to-amber-500/5", iconClass: "text-amber-500" },
  ];
  const extraBadges =
    productCode === "PAYDAY_SOFT"
      ? [{ label: "Policy", value: "Lusaka / 30 days" }]
      : productCode === "COLLATERAL"
        ? [{ label: "Collateral", value: "Required" }]
        : productCode === "BUSINESS"
          ? [{ label: "Focus", value: "Business owners" }]
          : productCode === "SALARY_ADVANCE_STAFF"
            ? [{ label: "Program", value: "Staff salary" }]
            : [];

  const collectionTiles = repaymentStats
    ? [
        { label: "Due today", value: repaymentStats.dueToday, icon: Banknote, valueClass: "text-foreground", iconClass: "text-primary" },
        { label: "Total overdue", value: repaymentStats.overdue, icon: AlertTriangle, valueClass: "text-destructive", iconClass: "text-destructive" },
        { label: "Collected this month", value: repaymentStats.collectedThisMonth, icon: CheckCircle2, valueClass: "text-emerald-500", iconClass: "text-emerald-500" },
        { label: "Outstanding", value: repaymentStats.totalOutstanding, icon: Clock, valueClass: "text-foreground", iconClass: "text-muted-foreground" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Top KPI hero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((c) => (
          <Card
            key={c.label}
            className={`relative overflow-hidden border-border/50 bg-gradient-to-br ${c.accent}`}
          >
            <div className="absolute -right-6 -bottom-6 opacity-10">
              <c.icon className="h-28 w-28" />
            </div>
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <c.icon className={`h-4 w-4 ${c.iconClass}`} />
                <span>{c.label}</span>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Extra product badges as chips, no longer giant cards */}
      {extraBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {extraBadges.map((b) => (
            <Badge
              key={b.label}
              variant="outline"
              className="px-3 py-1.5 text-xs bg-muted/40"
            >
              <span className="text-muted-foreground">{b.label}:</span>
              <span className="ml-1.5 font-semibold">{b.value}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Collection summary for non-Marketeer products */}
      {productCode !== "MARKETEER" && repaymentStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {collectionTiles.map((t) => (
            <Card key={t.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted/50 grid place-items-center">
                  <t.icon className={`h-5 w-5 ${t.iconClass}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                  <p className={`text-lg font-bold ${t.valueClass}`}>
                    K{Number(t.value).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <HouseProductConfigCard productCode={productCode} />

      {productCode === "MARKETEER" && (
        <>
          <MarketeerTierBreakdown />
          <MarketeerDailyCollectionTracker />
        </>
      )}
    </div>
  );
}
