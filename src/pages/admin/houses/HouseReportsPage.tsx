import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHouseReportSummary, useHouseLoans, useHouseRepayments, useHouseProduct } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Banknote, TrendingUp, AlertTriangle, CheckCircle2, Download, PieChart } from "lucide-react";
import { isPast, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type HouseRepaymentRow = {
  status: string;
  due_date: string;
  amount: number | null;
  principal_paid: number | null;
  paid_date: string | null;
};

type HouseLoanRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  loan_amount: number | null;
  status: string;
  loan_term_months?: number | null;
  term_unit?: string | null;
  created_at: string;
};

export default function HouseReportsPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { user } = useAuth();
  const { data: product } = useHouseProduct(productCode);
  const { data } = useHouseReportSummary(productCode);
  const { data: loans } = useHouseLoans(productCode);
  const { data: repayments } = useHouseRepayments(productCode);
  const { toast } = useToast();

  const repaymentStats = useMemo(() => {
    const reps = (repayments ?? []) as HouseRepaymentRow[];
    const today = format(new Date(), "yyyy-MM-dd");
    const monthStart = format(new Date(), "yyyy-MM-01");
    const totalPaid = reps
      .filter((r) => r.status === "paid")
      .reduce((s, r) => s + Number(r.principal_paid || r.amount || 0), 0);
    const totalDue = reps
      .filter((r) => r.status !== "paid" && r.status !== "cancelled")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const overdueCount = reps.filter((r) => r.status !== "paid" && r.status !== "cancelled" && isPast(new Date(r.due_date)) && r.due_date !== today).length;
    const collectedThisMonth = reps
      .filter((r) => r.status === "paid" && r.paid_date && r.paid_date >= monthStart)
      .reduce((s, r) => s + Number(r.principal_paid || r.amount || 0), 0);
    const repaymentRate = reps.length > 0 ? Math.round((reps.filter((r) => r.status === "paid").length / reps.length) * 100) : 0;
    return { totalPaid, totalDue, overdueCount, collectedThisMonth, repaymentRate };
  }, [repayments]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    (loans ?? []).forEach((l) => {
      map[l.status] = (map[l.status] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [loans]);

  const exportCsv = async () => {
    const headers = ["metric", "value"];
    const rows = [
      ["total_loans", data?.totalLoans ?? 0],
      ["active_loans", data?.activeLoans ?? 0],
      ["overdue_installments", repaymentStats.overdueCount],
      ["total_disbursed", data?.totalDisbursed ?? 0],
      ["total_collected", repaymentStats.totalPaid],
      ["total_outstanding", repaymentStats.totalDue],
      ["collected_this_month", repaymentStats.collectedThisMonth],
      ["repayment_rate_percent", repaymentStats.repaymentRate],
    ];

    // Add loan detail rows
    const loanHeaders = ["loan_id", "borrower", "amount", "status", "term", "created_at"];
    const loanRows = ((loans ?? []) as HouseLoanRow[]).map((l) => [
      l.id,
      l.full_name || l.email || "",
      l.loan_amount ?? 0,
      l.status,
      `${l.loan_term_months ?? 0} ${l.term_unit || "months"}`,
      l.created_at,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(",")),
      "",
      "--- Loan Details ---",
      loanHeaders.join(","),
      ...loanRows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productCode.toLowerCase()}-house-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (user?.id) {
      const { error: postError } = await (supabase.from as any)("product_house_report_posts").insert({
        product_code: productCode,
        product_name: product?.name ?? productCode,
        report_type: "house_summary",
        posted_by: user.id,
        report_payload: {
          metrics: {
            total_loans: data?.totalLoans ?? 0,
            active_loans: data?.activeLoans ?? 0,
            overdue_installments: repaymentStats.overdueCount,
            total_disbursed: data?.totalDisbursed ?? 0,
            total_collected: repaymentStats.totalPaid,
            total_outstanding: repaymentStats.totalDue,
            collected_this_month: repaymentStats.collectedThisMonth,
            repayment_rate_percent: repaymentStats.repaymentRate,
          },
        },
        csv_content: csvContent,
      });
      if (postError) {
        toast({ title: "Report downloaded, but posting failed", description: postError.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Report exported" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Reports</h2>
        <Button size="sm" onClick={() => void exportCsv()}><Download size={14} className="mr-1" /> Export + Post</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Disbursed</p>
              <p className="text-lg font-bold">K{Number(data?.totalDisbursed ?? 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="text-lg font-bold text-green-600">K{repaymentStats.totalPaid.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Banknote className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-bold">K{repaymentStats.totalDue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Overdue Items</p>
              <p className="text-lg font-bold text-destructive">{repaymentStats.overdueCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Repayment rate */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><PieChart size={16} /> Repayment Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{repaymentStats.repaymentRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">of installments paid on time</p>
            </div>
            <div className="mt-3 text-sm space-y-1">
              <p>Collected this month: <strong>K{repaymentStats.collectedThisMonth.toLocaleString()}</strong></p>
            </div>
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Loan Status Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {statusBreakdown.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs capitalize">{status.replace(/_/g, " ")}</Badge>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
            {statusBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No loan data yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
