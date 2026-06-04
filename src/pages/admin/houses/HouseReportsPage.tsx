import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAccessibleHouses, useHouseProduct, useHousesReportBundle } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Banknote,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Download,
  PieChart,
  Percent,
  BarChart3,
  Wallet,
  CalendarIcon,
  Building2,
} from "lucide-react";
import {
  isPast,
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
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

type HouseDisbursementRow = {
  status: string;
  amount: number | null;
  disbursed_at?: string | null;
  created_at?: string | null;
};

const fmtK = (v: number) => `K${Math.round(v).toLocaleString()}`;

const ALL = "ALL";

type PresetKey = "this_month" | "last_month" | "quarter" | "year" | "all" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

function resolvePeriod(preset: PresetKey, custom?: DateRange): { from: Date | null; to: Date | null; label: string } {
  const now = new Date();
  switch (preset) {
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now), label: `This month (${format(now, "MMM yyyy")})` };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm), label: `Last month (${format(lm, "MMM yyyy")})` };
    }
    case "quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now), label: `This quarter (${format(now, "QQQ yyyy")})` };
    case "year":
      return { from: startOfYear(now), to: endOfYear(now), label: `This year (${format(now, "yyyy")})` };
    case "all":
      return { from: null, to: now, label: "All time" };
    case "custom":
      if (custom?.from) {
        const to = custom.to ?? custom.from;
        return {
          from: custom.from,
          to,
          label: `${format(custom.from, "dd MMM yyyy")} – ${format(to, "dd MMM yyyy")}`,
        };
      }
      return { from: null, to: now, label: "Custom range" };
    default:
      return { from: startOfYear(now), to: endOfYear(now), label: `This year (${format(now, "yyyy")})` };
  }
}

export default function HouseReportsPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: product } = useHouseProduct(productCode);
  const { data: accessibleHouses } = useAccessibleHouses();
  const { toast } = useToast();

  // Filters
  const [scope, setScope] = useState<string>(productCode); // productCode or ALL
  const [preset, setPreset] = useState<PresetKey>("year");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const accessibleCodes = useMemo(
    () => (accessibleHouses ?? []).map((h) => h.productCode),
    [accessibleHouses],
  );
  const activeCodes = useMemo(
    () => (scope === ALL ? (accessibleCodes.length ? accessibleCodes : [productCode]) : [productCode]),
    [scope, accessibleCodes, productCode],
  );

  const { data: bundle, isLoading } = useHousesReportBundle(activeCodes);
  const loans = (bundle?.loans ?? []) as HouseLoanRow[];
  const repayments = (bundle?.repayments ?? []) as HouseRepaymentRow[];
  const expenses = (bundle?.expenses ?? []) as {
    loan_id?: string | null;
    amount?: number | null;
    expense_date?: string | null;
    status?: string | null;
  }[];
  const disbursements = (bundle?.disbursements ?? []) as HouseDisbursementRow[];

  const period = useMemo(() => resolvePeriod(preset, customRange), [preset, customRange]);

  const scopeLabel = scope === ALL ? "All houses" : product?.name || productCode;

  // Monthly profit: interest expected (by due month) vs interest made (by paid month), net of expenses
  const profit = useMemo(
    () => computeMonthlyProfit(loans, repayments, expenses, { from: period.from, to: period.to }),
    [loans, repayments, expenses, period],
  );

  // Period-scoped disbursed total (by disbursed_at / created_at within range)
  const disbursedInPeriod = useMemo(() => {
    const fromKey = period.from ? format(startOfMonth(period.from), "yyyy-MM-dd") : null;
    const toKey = period.to ? format(endOfMonth(period.to), "yyyy-MM-dd") : null;
    return disbursements
      .filter((d) => d.status === "completed")
      .filter((d) => {
        const raw = d.disbursed_at || d.created_at;
        if (!raw) return false;
        const day = raw.slice(0, 10);
        if (fromKey && day < fromKey) return false;
        if (toKey && day > toKey) return false;
        return true;
      })
      .reduce((s, d) => s + Number(d.amount || 0), 0);
  }, [disbursements, period]);

  // Live snapshot (point-in-time) — not period bound
  const liveStats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const totalDue = repayments
      .filter((r) => r.status !== "paid" && r.status !== "cancelled" && !r.is_reversed)
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const overdueCount = repayments.filter(
      (r) =>
        r.status !== "paid" &&
        r.status !== "cancelled" &&
        !r.is_reversed &&
        r.due_date &&
        isPast(new Date(r.due_date)) &&
        r.due_date !== today,
    ).length;
    const paidCount = repayments.filter((r) => r.status === "paid").length;
    const repaymentRate = repayments.length > 0 ? Math.round((paidCount / repayments.length) * 100) : 0;
    return { totalDue, overdueCount, repaymentRate };
  }, [repayments]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    loans.forEach((l) => {
      map[l.status] = (map[l.status] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [loans]);

  const handleScopeChange = (value: string) => {
    if (value === ALL) {
      setScope(ALL);
      return;
    }
    if (value === productCode) {
      setScope(productCode);
      return;
    }
    // Navigate to the chosen house's reports (keeps header/tabs + deep link in sync)
    navigate(`/admin/houses/${value}/reports`);
  };

  const exportCsv = async () => {
    const scopeKey = scope === ALL ? "all-houses" : productCode.toLowerCase();
    const headers = ["metric", "value"];
    const rows = [
      ["scope", scopeLabel],
      ["period", period.label],
      ["total_loans", loans.length],
      ["active_loans", loans.filter((l) => ["active", "disbursed"].includes(l.status)).length],
      ["overdue_installments", liveStats.overdueCount],
      ["disbursed_in_period", Math.round(disbursedInPeriod)],
      ["collected_in_period", Math.round(profit.totals.collected)],
      ["interest_made", Math.round(profit.totals.interestMade)],
      ["expected_interest", Math.round(profit.totals.expectedInterest)],
      ["total_expenses", Math.round(profit.totals.expenses)],
      ["net_profit", Math.round(profit.totals.netProfit)],
      ["total_outstanding", Math.round(liveStats.totalDue)],
      ["repayment_rate_percent", liveStats.repaymentRate],
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
    const loanRows = loans.map((l) => [
      l.id,
      l.full_name || l.email || "",
      l.loan_amount ?? 0,
      l.status,
      `${l.loan_term_months ?? 0} ${l.term_unit || "months"}`,
      l.created_at,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
      "",
      `--- Monthly Profit (Interest) · ${scopeLabel} · ${period.label} ---`,
      profitHeaders.join(","),
      ...profitRows.map((r) => r.join(",")),
      "",
      "--- Loan Details ---",
      loanHeaders.join(","),
      ...loanRows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scopeKey}-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (user?.id) {
      const { error: postError } = await (supabase.from as any)("product_house_report_posts").insert({
        product_code: scope === ALL ? "ALL" : productCode,
        product_name: scopeLabel,
        report_type: "house_summary",
        posted_by: user.id,
        report_payload: {
          scope: scopeLabel,
          period: period.label,
          metrics: {
            total_loans: loans.length,
            active_loans: loans.filter((l) => ["active", "disbursed"].includes(l.status)).length,
            overdue_installments: liveStats.overdueCount,
            disbursed_in_period: Math.round(disbursedInPeriod),
            collected_in_period: Math.round(profit.totals.collected),
            interest_made: Math.round(profit.totals.interestMade),
            expected_interest: Math.round(profit.totals.expectedInterest),
            total_expenses: Math.round(profit.totals.expenses),
            net_profit: Math.round(profit.totals.netProfit),
            total_outstanding: Math.round(liveStats.totalDue),
            repayment_rate_percent: liveStats.repaymentRate,
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Reports</h2>
          <p className="text-xs text-muted-foreground">
            {scopeLabel} · {period.label}
            {scope === ALL && " — showing all houses you can access"}
          </p>
        </div>
        <Button size="sm" onClick={() => void exportCsv()}>
          <Download size={14} className="mr-1" /> Export + Post
        </Button>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-muted-foreground" />
            <Select value={scope} onValueChange={handleScopeChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select house" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value={ALL}>All houses</SelectItem>
                {(accessibleHouses ?? []).map((h) => (
                  <SelectItem key={h.productCode} value={h.productCode}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={preset === p.key ? "default" : "outline"}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant={preset === "custom" ? "default" : "outline"}
                  className={cn(!customRange?.from && preset !== "custom" && "text-muted-foreground")}
                >
                  <CalendarIcon size={14} className="mr-1" />
                  {preset === "custom" && customRange?.from
                    ? `${format(customRange.from, "dd MMM")}${customRange.to ? ` – ${format(customRange.to, "dd MMM")}` : ""}`
                    : "Custom"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range);
                    setPreset("custom");
                    if (range?.from && range?.to) setCalendarOpen(false);
                  }}
                  numberOfMonths={2}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Disbursed</p>
              <p className="text-lg font-bold">{fmtK(disbursedInPeriod)}</p>
              <p className="text-[10px] text-muted-foreground">in period</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="text-lg font-bold text-green-600">{fmtK(profit.totals.collected)}</p>
              <p className="text-[10px] text-muted-foreground">in period</p>
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
              <p className="text-lg font-bold">{fmtK(liveStats.totalDue)}</p>
              <p className="text-[10px] text-muted-foreground">as of today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Overdue Items</p>
              <p className="text-lg font-bold text-destructive">{liveStats.overdueCount}</p>
              <p className="text-[10px] text-muted-foreground">as of today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly profit graph: expected vs made */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 size={16} /> Interest Expected vs Made — {scopeLabel} · {period.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : profit.hasData ? (
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
            <p className="text-sm text-muted-foreground text-center py-8">No interest or profit recorded in this period.</p>
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
              {profit.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">No data in this period.</td>
                </tr>
              )}
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
              <p className="text-4xl font-bold text-primary">{liveStats.repaymentRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">of installments paid (all time)</p>
            </div>
            <div className="mt-3 text-sm space-y-1">
              <p>Collected in period: <strong>{fmtK(profit.totals.collected)}</strong></p>
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
