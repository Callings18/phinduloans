import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval } from "date-fns";
import { Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportReportPDF, exportReportExcel, formatK } from "@/utils/reportExportEngine";
import { chunkIds, REPORT_IN_CHUNK, REPORT_MAX_REPAYMENT_ROWS } from "@/utils/reportQueryGuards";

interface Props {
  products: { id: string; name: string }[];
  canExport?: boolean;
}

const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: format(new Date(2025, i, 1), "MMMM") }));
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

const CollectionsReport = ({ products, canExport = true }: Props) => {
  const [month, setMonth] = useState(String(new Date().getMonth()));
  const [year, setYear] = useState(String(currentYear));
  const [product, setProduct] = useState("all");

  const periodStart = startOfMonth(new Date(Number(year), Number(month)));
  const periodEnd = endOfMonth(new Date(Number(year), Number(month)));

  const { data, isLoading } = useQuery({
    queryKey: ["collections-report", month, year, product],
    queryFn: async () => {
      const startStr = format(periodStart, "yyyy-MM-dd");
      const endStr = format(periodEnd, "yyyy-MM-dd");

      const repsRes = await supabase
        .from("loan_repayments")
        .select("id, loan_id, amount, status, due_date, paid_date")
        .gte("due_date", startStr)
        .lte("due_date", endStr)
        .limit(REPORT_MAX_REPAYMENT_ROWS);
      if (repsRes.error) throw repsRes.error;

      const reps = repsRes.data || [];
      const loanIds = [...new Set(reps.map((r) => r.loan_id))];
      const loans: { id: string; full_name: string | null; loan_product_id: string | null; loan_amount: number | null }[] = [];
      for (const part of chunkIds(loanIds, REPORT_IN_CHUNK)) {
        if (part.length === 0) continue;
        const { data: batch, error: loansErr } = await supabase
          .from("loan_applications")
          .select("id, full_name, loan_product_id, loan_amount")
          .in("id", part);
        if (loansErr) throw loansErr;
        loans.push(...(batch ?? []));
      }
      const loanMap = new Map(loans.map((l) => [l.id, l]));
      const productMap = new Map(products.map((p) => [p.id, p.name]));

      // Filter by product if needed
      const filteredReps = product === "all" ? reps : reps.filter((r) => {
        const loan = loanMap.get(r.loan_id);
        return loan?.loan_product_id === product;
      });

      const totalDue = filteredReps.reduce((s, r) => s + Number(r.amount), 0);
      const paidReps = filteredReps.filter((r) => r.status === "paid");
      const totalCollected = paidReps.reduce((s, r) => s + Number(r.amount), 0);
      const outstanding = totalDue - totalCollected;
      const collectionRate = totalDue > 0 ? ((totalCollected / totalDue) * 100).toFixed(1) : "0.0";

      // Breakdown by product
      const byProduct = new Map<string, { due: number; collected: number }>();
      filteredReps.forEach((r) => {
        const loan = loanMap.get(r.loan_id);
        const pName = loan?.loan_product_id ? productMap.get(loan.loan_product_id) || "Other" : "Unlinked";
        const entry = byProduct.get(pName) || { due: 0, collected: 0 };
        entry.due += Number(r.amount);
        if (r.status === "paid") entry.collected += Number(r.amount);
        byProduct.set(pName, entry);
      });

      // Weekly breakdown
      const weeks = eachWeekOfInterval({ start: periodStart, end: periodEnd }, { weekStartsOn: 1 });
      const weeklyData = weeks.map((ws, i) => {
        const we = i < weeks.length - 1 ? new Date(weeks[i + 1].getTime() - 1) : periodEnd;
        const wsStr = format(ws, "yyyy-MM-dd");
        const weStr = format(we, "yyyy-MM-dd");
        const weekReps = filteredReps.filter((r) => r.due_date >= wsStr && r.due_date <= weStr);
        return {
          week: `W${i + 1}`,
          due: weekReps.reduce((s, r) => s + Number(r.amount), 0),
          collected: weekReps.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0),
        };
      });

      // Top 5 by amount collected
      const borrowerCollected = new Map<string, { name: string; amount: number }>();
      paidReps.forEach((r) => {
        const loan = loanMap.get(r.loan_id);
        const name = loan?.full_name || "Unknown";
        const entry = borrowerCollected.get(r.loan_id) || { name, amount: 0 };
        entry.amount += Number(r.amount);
        borrowerCollected.set(r.loan_id, entry);
      });
      const top5 = [...borrowerCollected.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);

      // Bottom 5 (most overdue)
      const today = format(new Date(), "yyyy-MM-dd");
      const overdueReps = filteredReps.filter((r) => r.status === "pending" && r.due_date < today);
      const borrowerOverdue = new Map<string, { name: string; amount: number }>();
      overdueReps.forEach((r) => {
        const loan = loanMap.get(r.loan_id);
        const name = loan?.full_name || "Unknown";
        const entry = borrowerOverdue.get(r.loan_id) || { name, amount: 0 };
        entry.amount += Number(r.amount);
        borrowerOverdue.set(r.loan_id, entry);
      });
      const bottom5 = [...borrowerOverdue.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);

      return {
        totalDue,
        totalCollected,
        outstanding,
        collectionRate,
        byProduct: [...byProduct.entries()].map(([name, d]) => ({ name, ...d })),
        weeklyData,
        top5,
        bottom5,
        truncatedRepayments: reps.length >= REPORT_MAX_REPAYMENT_ROWS,
      };
    },
  });

  const doExport = (type: "pdf" | "excel") => {
    if (!data) return;
    const monthLabel = months.find((m) => m.value === month)?.label || month;
    const opts = {
      title: "Collections Report",
      subtitle: `${monthLabel} ${year}`,
      filters: { Period: `${monthLabel} ${year}`, Product: product === "all" ? "All" : products.find((p) => p.id === product)?.name || product },
      headers: ["Product", "Due", "Collected", "Rate (%)"],
      rows: data.byProduct.map((p) => [p.name, formatK(p.due), formatK(p.collected), p.due > 0 ? `${((p.collected / p.due) * 100).toFixed(1)}%` : "0%"]),
      summaryRows: [
        { label: "Total Due", value: formatK(data.totalDue) },
        { label: "Total Collected", value: formatK(data.totalCollected) },
        { label: "Collection Rate", value: `${data.collectionRate}%` },
        { label: "Outstanding", value: formatK(data.outstanding) },
      ],
      filename: `collections-${year}-${String(Number(month) + 1).padStart(2, "0")}`,
    };
    type === "pdf" ? exportReportPDF(opts) : exportReportExcel(opts);
  };

  const monthLabel = months.find((m) => m.value === month)?.label || "";

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Product</Label>
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => doExport("pdf")} disabled={!data || !canExport}>
                <FileText size={14} className="mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => doExport("excel")} disabled={!data || !canExport}>
                <FileSpreadsheet size={14} className="mr-1" /> Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…</div>
      ) : data ? (
        <>
          {data.truncatedRepayments && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Repayment rows capped at {REPORT_MAX_REPAYMENT_ROWS} for this month — totals may be incomplete.
            </p>
          )}
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Due</p><p className="text-2xl font-bold text-foreground">K{data.totalDue.toLocaleString()}</p></CardContent></Card>
            <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Collected</p><p className="text-2xl font-bold text-success">K{data.totalCollected.toLocaleString()}</p></CardContent></Card>
            <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Collection Rate</p><p className="text-2xl font-bold text-foreground">{data.collectionRate}%</p></CardContent></Card>
            <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-2xl font-bold text-destructive">K{data.outstanding.toLocaleString()}</p></CardContent></Card>
          </div>

          {/* Weekly chart */}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3">Weekly Breakdown – {monthLabel} {year}</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `K${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(v: number) => `K${v.toLocaleString()}`} />
                    <Bar dataKey="due" fill="hsl(var(--muted-foreground))" opacity={0.3} name="Due" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" fill="hsl(var(--success))" name="Collected" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* By product + Top/Bottom borrowers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-3">By Product</p>
                <div className="space-y-2">
                  {data.byProduct.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{p.name}</span>
                      <div className="flex gap-3">
                        <span className="text-foreground">K{p.collected.toLocaleString()}</span>
                        <span className="text-muted-foreground">/ K{p.due.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-success mb-3">Top 5 Collected</p>
                {data.top5.length === 0 ? <p className="text-xs text-muted-foreground">No collections</p> : (
                  <div className="space-y-2">
                    {data.top5.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{b.name}</span>
                        <span className="font-medium text-success">K{b.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-destructive mb-3">Most Overdue</p>
                {data.bottom5.length === 0 ? <p className="text-xs text-muted-foreground">No overdue</p> : (
                  <div className="space-y-2">
                    {data.bottom5.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{b.name}</span>
                        <span className="font-medium text-destructive">K{b.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default CollectionsReport;
