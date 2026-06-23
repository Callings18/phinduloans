import { useState } from "react";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { format, subDays, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportReportPDF, exportReportExcel, formatK } from "@/utils/reportExportEngine";
import { reportDateRangeError, REPORT_MAX_LOAN_ROWS } from "@/utils/reportQueryGuards";

interface Props {
  products: { id: string; name: string }[];
  officers: { id: string; full_name: string | null }[];
  canExport?: boolean;
}

const DisbursementReport = ({ products, officers, canExport = true }: Props) => {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [product, setProduct] = useState("all");
  const [officer, setOfficer] = useState("all");

  const rangeError = reportDateRangeError(dateFrom, dateTo);

  const { data, isLoading } = useQuery({
    queryKey: ["disbursement-report", dateFrom, dateTo, product, officer],
    enabled: !rangeError,
    queryFn: async () => {
      let query = supabase
        .from("loan_applications")
        .select("id, full_name, loan_amount, loan_product_id, disbursed_at, disbursed_by, status")
        .not("disbursed_at", "is", null)
        .gte("disbursed_at", new Date(dateFrom).toISOString())
        .lte("disbursed_at", new Date(dateTo + "T23:59:59").toISOString())
        .order("disbursed_at", { ascending: false })
        .limit(REPORT_MAX_LOAN_ROWS);

      if (product !== "all") query = query.eq("loan_product_id", product);
      if (officer !== "all") query = query.eq("disbursed_by", officer);

      const { data: loans, error: disbErr } = await query;
      if (disbErr) throw disbErr;
      const rows = (loans || []).map((l) => ({
        date: l.disbursed_at ? format(new Date(l.disbursed_at), "dd MMM yy") : "—",
        borrower: l.full_name,
        product: l.loan_product_id ? products.find((p) => p.id === l.loan_product_id)?.name || "—" : "—",
        amount: Number(l.loan_amount),
        officer: l.disbursed_by ? officers.find((o) => o.id === l.disbursed_by)?.full_name || l.disbursed_by.slice(0, 8) : "—",
        status: l.status,
      }));

      const totalCount = rows.length;
      const totalValue = rows.reduce((s, r) => s + r.amount, 0);
      const avgSize = totalCount > 0 ? totalValue / totalCount : 0;

      // By product
      const byProduct = new Map<string, { count: number; value: number }>();
      rows.forEach((r) => {
        const entry = byProduct.get(r.product) || { count: 0, value: 0 };
        entry.count++;
        entry.value += r.amount;
        byProduct.set(r.product, entry);
      });

      // Daily trend
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      let trendData: { label: string; count: number; amount: number }[] = [];

      if (diffDays <= 31) {
        const days = eachDayOfInterval({ start: from, end: to });
        trendData = days.map((d) => {
          const dStr = format(d, "yyyy-MM-dd");
          const dayRows = (loans || []).filter((l) => l.disbursed_at && format(new Date(l.disbursed_at), "yyyy-MM-dd") === dStr);
          return { label: format(d, "dd MMM"), count: dayRows.length, amount: dayRows.reduce((s, l) => s + Number(l.loan_amount), 0) };
        });
      } else {
        const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
        trendData = weeks.map((ws, i) => {
          const we = i < weeks.length - 1 ? new Date(weeks[i + 1].getTime() - 1) : to;
          const weekRows = (loans || []).filter((l) => {
            if (!l.disbursed_at) return false;
            const d = new Date(l.disbursed_at);
            return d >= ws && d <= we;
          });
          return { label: `W${i + 1}`, count: weekRows.length, amount: weekRows.reduce((s, l) => s + Number(l.loan_amount), 0) };
        });
      }

      // Officer comparison
      const byOfficer = new Map<string, { count: number; value: number }>();
      rows.forEach((r) => {
        const entry = byOfficer.get(r.officer) || { count: 0, value: 0 };
        entry.count++;
        entry.value += r.amount;
        byOfficer.set(r.officer, entry);
      });

      return {
        rows,
        totalCount,
        totalValue,
        avgSize,
        byProduct: [...byProduct.entries()].map(([name, d]) => ({ name, ...d })),
        trendData,
        byOfficer: [...byOfficer.entries()]
          .map(([name, d]) => ({ name, ...d }))
          .sort((a, b) => b.value - a.value),
        truncatedLoans: (loans || []).length >= REPORT_MAX_LOAN_ROWS,
      };
    },
  });

  const doExport = (type: "pdf" | "excel") => {
    if (!data) return;
    const opts = {
      title: "Disbursement Report",
      subtitle: `${dateFrom} to ${dateTo}`,
      filters: {
        "Date Range": `${dateFrom} to ${dateTo}`,
        Product: product === "all" ? "All" : products.find((p) => p.id === product)?.name || product,
        Officer: officer === "all" ? "All" : officers.find((o) => o.id === officer)?.full_name || officer,
      },
      headers: ["Date", "Borrower", "Product", "Amount", "Officer", "Status"],
      rows: data.rows.map((r) => [r.date, r.borrower, r.product, formatK(r.amount), r.officer, r.status]),
      summaryRows: [
        { label: "Total Count", value: String(data.totalCount) },
        { label: "Total Value", value: formatK(data.totalValue) },
        { label: "Average Size", value: formatK(data.avgSize) },
      ],
      filename: `disbursements-${dateFrom}-to-${dateTo}`,
    };
    type === "pdf" ? exportReportPDF(opts) : exportReportExcel(opts);
  };

  return (
    <div className="space-y-4">
      {rangeError && (
        <p className="text-sm text-destructive" role="alert">
          {rangeError}
        </p>
      )}
      {data?.truncatedLoans && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Results capped at {REPORT_MAX_LOAN_ROWS} disbursements — narrow filters or shorten the date range.
        </p>
      )}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" /></div>
            <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" /></div>
            <div>
              <Label className="text-xs text-muted-foreground">Product</Label>
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Officer</Label>
              <Select value={officer} onValueChange={setOfficer}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{officers.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name || o.id.slice(0, 8)}</SelectItem>)}</SelectContent>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Count</p><p className="text-2xl font-bold text-foreground">{data.totalCount}</p></CardContent></Card>
            <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Value</p><p className="text-2xl font-bold text-foreground">K{data.totalValue.toLocaleString()}</p></CardContent></Card>
            <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Average Size</p><p className="text-2xl font-bold text-foreground">K{Math.round(data.avgSize).toLocaleString()}</p></CardContent></Card>
          </div>

          {/* Trend chart */}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3">Disbursement Trend</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `K${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(v: number) => `K${v.toLocaleString()}`} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* By product + officer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-3">By Product</p>
                <div className="space-y-2">
                  {data.byProduct.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{p.name}</span>
                      <div className="flex gap-4"><span className="text-foreground">{p.count} loans</span><span className="font-medium text-foreground">K{p.value.toLocaleString()}</span></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-3">By Officer</p>
                <div className="space-y-2">
                  {data.byOfficer.map((o) => (
                    <div key={o.name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{o.name}</span>
                      <div className="flex gap-4"><span className="text-foreground">{o.count} loans</span><span className="font-medium text-foreground">K{o.value.toLocaleString()}</span></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data table */}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">{["Date", "Borrower", "Product", "Amount", "Officer", "Status"].map((h) => <th key={h} className="text-left py-3 px-4 text-muted-foreground font-medium">{h}</th>)}</tr></thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 text-muted-foreground">{r.date}</td>
                        <td className="py-2.5 px-4 font-medium text-foreground">{r.borrower}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{r.product}</td>
                        <td className="py-2.5 px-4 text-foreground">K{r.amount.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{r.officer}</td>
                        <td className="py-2.5 px-4 text-muted-foreground capitalize">{r.status.replace("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default DisbursementReport;
