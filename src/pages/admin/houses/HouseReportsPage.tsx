import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHouseReportSummary, useHouseLoans, useHouseRepayments, useHouseProduct, useHouseExpenses } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Banknote, TrendingUp, AlertTriangle, CheckCircle2, Download, PieChart, Percent, BarChart3, Wallet } from "lucide-react";
import { isPast, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { computeMonthlyProfit, type MonthlyProfitRow } from "@/utils/houseProfit";

type HouseRepaymentRow = {
  status: string;
  due_date: string;
  amount: number | null;
  principal_paid: number | null;
  paid_date: string | null;
  loan_id?: string | null;
  is_reversed?: boolean | null;
};

type HouseLoanRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  loan_amount: number | null;
  total_repayment?: number | null;
  status: string;
  loan_term_months?: number | null;
  term_unit?: string | null;
  created_at: string;
};

const fmtK = (v: number) => `K${Math.round(v).toLocaleString()}`;

export default function HouseReportsPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { user } = useAuth();
  const { data: product } = useHouseProduct(productCode);
  const { data } = useHouseReportSummary(productCode);
  const { data: loans } = useHouseLoans(productCode);
  const { data: repayments } = useHouseRepayments(productCode);
  const { data: expenses } = useHouseExpenses(productCode);
  const { toast } = useToast();

  const repaymentStats = useMemo(() => {
    const reps = (repayments ?? []) as HouseRepaymentRow[];
    const today = format(new Date(), "yyyy-MM-dd");
    const monthStart = format(new Date(), "yyyy-MM-01");
    const totalPaid = reps
      .filter((r) => r.status === "paid")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalDue = reps
      .filter((r) => r.status !== "paid" && r.status !== "cancelled")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const overdueCount = reps.filter((r) => r.status !== "paid" && r.status !== "cancelled" && isPast(new Date(r.due_date)) && r.due_date !== today).length;
    const collectedThisMonth = reps
      .filter((r) => r.status === "paid" && r.paid_date && r.paid_date >= monthStart)
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const repaymentRate = reps.length > 0 ? Math.round((reps.filter((r) => r.status === "paid").length / reps.length) * 100) : 0;
    return { totalPaid, totalDue, overdueCount, collectedThisMonth, repaymentRate };
  }, [repayments]);

  // Monthly profit: interest expected (by due month) vs interest made (by paid month), net of expenses
  const profit = useMemo(
    () =>
      computeMonthlyProfit(
        (loans ?? []) as HouseLoanRow[],
        (repayments ?? []) as HouseRepaymentRow[],
        (expenses ?? []) as { loan_id?: string | null; amount?: number | null; expense_date?: string | null; status?: string | null }[],
        12,
      ),
    [loans, repayments, expenses],
  );

  const currentMonthRow = useMemo<MonthlyProfitRow | undefined>(() => {
    const key = format(new Date(), "yyyy-MM");
    return profit.rows.find((r) => r.monthKey === key);
  }, [profit]);

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
      ["interest_made", Math.round(profit.totals.interestMade)],
      ["expected_interest", Math.round(profit.totals.expectedInterest)],
      ["total_expenses", Math.round(profit.totals.expenses)],
      ["net_profit", Math.round(profit.totals.netProfit)],
      ["total_outstanding", repaymentStats.totalDue],
      ["collected_this_month", repaymentStats.collectedThisMonth],
      ["repayment_rate_percent", repaymentStats.repaymentRate],
    ];

    const profitHeaders = ["month", "expected_interest", "interest_made", "expenses", "net_profit"];
    const profitRows = profit.rows.map((r) => [
      r.label,
      Math.round(r.expectedInterest),
      Math.round(r.interestMade),
      Math.round(r.expenses),
      Math.round(r.netProfit),
    ]);

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
      "--- Monthly Profit (Interest) ---",
      profitHeaders.join(","),
      ...profitRows.map(r => r.join(",")),
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
            interest_made: Math.round(profit.totals.interestMade),
            expected_interest: Math.round(profit.totals.expectedInterest),
            total_expenses: Math.round(profit.totals.expenses),
            net_profit: Math.round(profit.totals.netProfit),
            total_outstanding: repaymentStats.totalDue,
            collected_this_month: repaymentStats.collectedThisMonth,
            repayment_rate_percent: repaymentStats.repaymentRate,
          },
          monthly_profit: profit.rows.map((r) => ({
            month: r.label,
            expected_interest: Math.round(r.expectedInterest),
            interest_made: Math.round(r.interestMade),
            expenses: Math.round(r.expenses),
            net_profit: Math.round(r.netProfit),
          })),
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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Disbursed</p>
              <p className="text-lg font-bold">{fmtK(Number(data?.totalDisbursed ?? 0))}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="text-lg font-bold text-green-600">{fmtK(repaymentStats.totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Percent className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Interest Made</p>
              <p className="text-lg font-bold">{fmtK(profit.totals.interestMade)}</p>
              <p className="text-[10px] text-muted-foreground">Expected {fmtK(profit.totals.expectedInterest)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Net Profit</p>
              <p className="text-lg font-bold text-emerald-600">{fmtK(profit.totals.netProfit)}</p>
              <p className="text-[10px] text-muted-foreground">Expenses {fmtK(profit.totals.expenses)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Banknote className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-bold">{fmtK(repaymentStats.totalDue)}</p>
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

      {/* Monthly profit graph: expected vs made */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 size={16} /> Monthly Profit — Interest Expected vs Made (last 12 months)</CardTitle>
          {currentMonthRow && (
            <p className="text-xs text-muted-foreground">
              This month ({currentMonthRow.label}): interest made <strong className="text-foreground">{fmtK(currentMonthRow.interestMade)}</strong> of {fmtK(currentMonthRow.expectedInterest)} expected · net profit <strong className="text-emerald-600">{fmtK(currentMonthRow.netProfit)}</strong>
            </p>
          )}
        </CardHeader>
        <CardContent>
          {profit.hasData ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profit.rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `K${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    formatter={(value: number, name: string) => [`K${Number(value).toLocaleString()}`, name]}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as MonthlyProfitRow | undefined;
                      if (!row) return label as string;
                      return `${row.label} · Net profit ${fmtK(row.netProfit)} (after ${fmtK(row.expenses)} expenses)`;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="expectedInterest" name="Interest Expected" fill="hsl(var(--muted-foreground))" fillOpacity={0.45} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="interestMade" name="Interest Made" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No interest or profit recorded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Monthly profit breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Percent size={16} /> Monthly Profit Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Month</th>
                <th className="py-2 px-3 font-medium text-right">Expected</th>
                <th className="py-2 px-3 font-medium text-right">Made</th>
                <th className="py-2 px-3 font-medium text-right">Expenses</th>
                <th className="py-2 pl-3 font-medium text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {profit.rows.map((r) => (
                <tr key={r.monthKey} className="border-b border-border/50">
                  <td className="py-2 pr-3">{r.label}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{fmtK(r.expectedInterest)}</td>
                  <td className="py-2 px-3 text-right font-medium">{fmtK(r.interestMade)}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{fmtK(r.expenses)}</td>
                  <td className={`py-2 pl-3 text-right font-semibold ${r.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmtK(r.netProfit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 px-3 text-right">{fmtK(profit.totals.expectedInterest)}</td>
                <td className="py-2 px-3 text-right">{fmtK(profit.totals.interestMade)}</td>
                <td className="py-2 px-3 text-right">{fmtK(profit.totals.expenses)}</td>
                <td className={`py-2 pl-3 text-right ${profit.totals.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmtK(profit.totals.netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

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
              <p>Collected this month: <strong>{fmtK(repaymentStats.collectedThisMonth)}</strong></p>
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
