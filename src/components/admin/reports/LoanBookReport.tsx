import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, differenceInDays } from "date-fns";
import { Loader2, Download, FileText, FileSpreadsheet } from "lucide-react";
import { exportReportPDF, exportReportExcel, formatK } from "@/utils/reportExportEngine";

interface Props {
  products: { id: string; name: string }[];
  officers: { id: string; full_name: string | null }[];
}

const LoanBookReport = ({ products, officers }: Props) => {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 90), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [product, setProduct] = useState("all");
  const [status, setStatus] = useState("all");
  const [officer, setOfficer] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["loan-book-report", dateFrom, dateTo, product, status, officer],
    queryFn: async () => {
      let query = supabase
        .from("loan_applications")
        .select("id, full_name, loan_amount, status, disbursed_at, created_at, approved_by, loan_product_id, total_repayment")
        .gte("created_at", new Date(dateFrom).toISOString())
        .lte("created_at", new Date(dateTo + "T23:59:59").toISOString())
        .order("created_at", { ascending: false });

      if (product !== "all") query = query.eq("loan_product_id", product);
      if (status !== "all") query = query.eq("status", status as any);
      if (officer !== "all") query = query.or(`approved_by.eq.${officer},assigned_to.eq.${officer}`);

      const [loansRes, repaymentsRes] = await Promise.all([
        query,
        supabase.from("loan_repayments").select("loan_id, amount, status, due_date"),
      ]);

      const loans = loansRes.data || [];
      const repayments = repaymentsRes.data || [];
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");

      // Build repayment info per loan
      const repByLoan = new Map<string, { overdue: number; daysOutstanding: number }>();
      repayments.forEach((r) => {
        const entry = repByLoan.get(r.loan_id) || { overdue: 0, daysOutstanding: 0 };
        if (r.status === "pending" && r.due_date < todayStr) {
          entry.overdue += Number(r.amount || 0);
          const days = differenceInDays(today, new Date(r.due_date));
          if (days > entry.daysOutstanding) entry.daysOutstanding = days;
        }
        repByLoan.set(r.loan_id, entry);
      });

      const productMap = new Map(products.map((p) => [p.id, p.name]));
      const officerMap = new Map(officers.map((o) => [o.id, o.full_name || o.id.slice(0, 8)]));

      const rows = loans.map((l) => {
        const rep = repByLoan.get(l.id) || { overdue: 0, daysOutstanding: 0 };
        return {
          id: l.id.slice(0, 8),
          borrower: l.full_name,
          product: l.loan_product_id ? productMap.get(l.loan_product_id) || "—" : "—",
          amount: Number(l.loan_amount),
          disbursedDate: l.disbursed_at ? format(new Date(l.disbursed_at), "dd MMM yy") : "—",
          status: l.status,
          daysOutstanding: rep.daysOutstanding,
          overdueAmount: rep.overdue,
          officer: l.approved_by ? officerMap.get(l.approved_by) || l.approved_by.slice(0, 8) : "—",
        };
      });

      // Aging analysis
      const aging = { current: { count: 0, value: 0 }, d31_60: { count: 0, value: 0 }, d61_90: { count: 0, value: 0 }, d90plus: { count: 0, value: 0 } };
      rows.forEach((r) => {
        if (r.daysOutstanding <= 0) { aging.current.count++; aging.current.value += r.amount; }
        else if (r.daysOutstanding <= 60) { aging.d31_60.count++; aging.d31_60.value += r.amount; }
        else if (r.daysOutstanding <= 90) { aging.d61_90.count++; aging.d61_90.value += r.amount; }
        else { aging.d90plus.count++; aging.d90plus.value += r.amount; }
      });

      return { rows, aging, totalLoans: rows.length, totalValue: rows.reduce((s, r) => s + r.amount, 0), totalOverdue: rows.reduce((s, r) => s + r.overdueAmount, 0) };
    },
  });

  const getFilters = () => ({
    "Date Range": `${dateFrom} to ${dateTo}`,
    Product: product === "all" ? "All" : products.find((p) => p.id === product)?.name || product,
    Status: status === "all" ? "All" : status,
    Officer: officer === "all" ? "All" : officers.find((o) => o.id === officer)?.full_name || officer,
  });

  const doExport = (type: "pdf" | "excel") => {
    if (!data) return;
    const opts = {
      title: "Loan Book Report",
      subtitle: `Period: ${dateFrom} to ${dateTo}`,
      filters: getFilters(),
      headers: ["ID", "Borrower", "Product", "Amount", "Disbursed", "Status", "Days Outstanding", "Overdue", "Officer"],
      rows: data.rows.map((r) => [r.id, r.borrower, r.product, formatK(r.amount), r.disbursedDate, r.status, r.daysOutstanding, formatK(r.overdueAmount), r.officer]),
      summaryRows: [
        { label: "Total Loans", value: String(data.totalLoans) },
        { label: "Total Value", value: formatK(data.totalValue) },
        { label: "Total Overdue", value: formatK(data.totalOverdue) },
        { label: "Average Loan Size", value: formatK(data.totalLoans > 0 ? data.totalValue / data.totalLoans : 0) },
      ],
      filename: `loan-book-${dateFrom}-to-${dateTo}`,
    };
    type === "pdf" ? exportReportPDF(opts) : exportReportExcel(opts);
  };

  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      active: "bg-success/20 text-success border-success/30",
      disbursed: "bg-primary/20 text-primary border-primary/30",
      completed: "bg-info/20 text-info border-info/30",
      defaulted: "bg-destructive/20 text-destructive border-destructive/30",
      pending: "bg-warning/20 text-warning border-warning/30",
    };
    return <Badge variant="outline" className={styles[s] || ""}>{s.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
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
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Officer</Label>
              <Select value={officer} onValueChange={setOfficer}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Officers</SelectItem>
                  {officers.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name || o.id.slice(0, 8)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => doExport("pdf")} disabled={!data}>
                <FileText size={14} className="mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => doExport("excel")} disabled={!data}>
                <FileSpreadsheet size={14} className="mr-1" /> Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aging Analysis */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Current (0-30d)", ...data.aging.current, color: "text-success" },
            { label: "31-60 days", ...data.aging.d31_60, color: "text-warning" },
            { label: "61-90 days", ...data.aging.d61_90, color: "text-orange-500" },
            { label: "90+ days", ...data.aging.d90plus, color: "text-destructive" },
          ].map((a) => (
            <Card key={a.label} className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{a.label}</p>
                <p className={`text-xl font-bold ${a.color}`}>{a.count} loans</p>
                <p className="text-xs text-muted-foreground">K{a.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Loans</p><p className="text-2xl font-bold text-foreground">{data.totalLoans}</p></CardContent></Card>
          <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Value</p><p className="text-2xl font-bold text-foreground">K{data.totalValue.toLocaleString()}</p></CardContent></Card>
          <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Overdue</p><p className="text-2xl font-bold text-destructive">K{data.totalOverdue.toLocaleString()}</p></CardContent></Card>
          <Card className="border-border/50 bg-card/80"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg Loan Size</p><p className="text-2xl font-bold text-foreground">K{data.totalLoans > 0 ? Math.round(data.totalValue / data.totalLoans).toLocaleString() : 0}</p></CardContent></Card>
        </div>
      )}

      {/* Table */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><FileText size={32} className="mx-auto mb-2 opacity-40" /><p>No loans match these filters</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["ID", "Borrower", "Product", "Amount", "Disbursed", "Status", "Days O/S", "Overdue", "Officer"].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">{r.id}</td>
                      <td className="py-2.5 px-4 font-medium text-foreground">{r.borrower}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{r.product}</td>
                      <td className="py-2.5 px-4 text-foreground">K{r.amount.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{r.disbursedDate}</td>
                      <td className="py-2.5 px-4">{statusBadge(r.status)}</td>
                      <td className="py-2.5 px-4 text-foreground">{r.daysOutstanding > 0 ? r.daysOutstanding : "—"}</td>
                      <td className={`py-2.5 px-4 font-medium ${r.overdueAmount > 0 ? "text-destructive" : "text-foreground"}`}>
                        {r.overdueAmount > 0 ? `K${r.overdueAmount.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">{r.officer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoanBookReport;
