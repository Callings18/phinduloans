import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, differenceInDays, subMonths } from "date-fns";
import { Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { exportReportPDF, exportReportExcel, formatK } from "@/utils/reportExportEngine";

interface Props {
  officers: { id: string; full_name: string | null }[];
}

const PerformanceReport = ({ officers }: Props) => {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 90), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedOfficer, setSelectedOfficer] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["performance-report", dateFrom, dateTo, selectedOfficer],
    queryFn: async () => {
      const fromISO = new Date(dateFrom).toISOString();
      const toISO = new Date(dateTo + "T23:59:59").toISOString();

      const [loansRes, repaymentsRes, payrollRes] = await Promise.all([
        supabase.from("loan_applications").select("id, loan_amount, status, created_at, approved_at, approved_by, disbursed_by, disbursed_at"),
        supabase.from("loan_repayments").select("loan_id, status, due_date"),
        supabase.from("payroll_records").select("employee_id, commission_amount, payroll_year, payroll_month").order("payroll_year", { ascending: false }).order("payroll_month", { ascending: false }),
      ]);
      if (loansRes.error) throw loansRes.error;
      if (repaymentsRes.error) throw repaymentsRes.error;
      if (payrollRes.error) throw payrollRes.error;

      const loans = loansRes.data || [];
      const repayments = repaymentsRes.data || [];
      const payroll = payrollRes.data || [];
      const today = format(new Date(), "yyyy-MM-dd");

      // Get employees to map user_id -> employee_id
      const { data: employees, error: empMapErr } = await supabase.from("employees").select("id, user_id").eq("is_active", true);
      if (empMapErr) throw empMapErr;
      const userToEmpId = new Map((employees || []).filter((e) => e.user_id).map((e) => [e.user_id!, e.id]));

      // Overdue loans set
      const overdueLoans = new Set<string>();
      repayments.forEach((r) => {
        if (r.status === "pending" && r.due_date < today) overdueLoans.add(r.loan_id);
      });

      // Latest commission per employee
      const latestCommission = new Map<string, number>();
      payroll.forEach((pr) => {
        if (!latestCommission.has(pr.employee_id)) latestCommission.set(pr.employee_id, Number(pr.commission_amount || 0));
      });

      // Build officer stats
      const officerIds = new Set<string>();
      loans.forEach((l) => {
        if (l.approved_by) officerIds.add(l.approved_by);
        if (l.disbursed_by) officerIds.add(l.disbursed_by);
      });

      const officerStats = [...officerIds].map((uid) => {
        const officerLoans = loans.filter((l) => {
          const isOfficer = l.approved_by === uid || l.disbursed_by === uid;
          if (!isOfficer) return false;
          const actionDate = l.approved_by === uid ? l.approved_at : l.disbursed_at;
          return actionDate && actionDate >= fromISO && actionDate <= toISO;
        });

        const loansProcessed = officerLoans.length;
        const totalDisbursed = officerLoans.reduce((s, l) => s + Number(l.loan_amount || 0), 0);

        const approvedLoans = officerLoans.filter((l) => l.approved_by === uid && l.approved_at);
        const avgApprovalDays = approvedLoans.length > 0
          ? approvedLoans.reduce((s, l) => s + differenceInDays(new Date(l.approved_at!), new Date(l.created_at)), 0) / approvedLoans.length
          : null;

        const activeLoans = loans.filter((l) => (l.approved_by === uid || l.disbursed_by === uid) && ["active", "disbursed"].includes(l.status));
        const currentLoans = activeLoans.filter((l) => !overdueLoans.has(l.id));
        const portfolioQuality = activeLoans.length > 0 ? (currentLoans.length / activeLoans.length) * 100 : null;

        const name = officers.find((o) => o.id === uid)?.full_name || uid.slice(0, 8);
        const empId = userToEmpId.get(uid);
        const commission = empId ? latestCommission.get(empId) || 0 : 0;

        return { userId: uid, name, loansProcessed, totalDisbursed, avgApprovalDays: avgApprovalDays !== null ? Math.round(avgApprovalDays * 10) / 10 : null, portfolioQuality: portfolioQuality !== null ? Math.round(portfolioQuality * 10) / 10 : null, commission };
      }).filter((o) => o.loansProcessed > 0).sort((a, b) => b.loansProcessed - a.loansProcessed);

      // Monthly trend for selected officer
      let monthlyTrend: { month: string; loans: number; value: number }[] = [];
      if (selectedOfficer !== "all") {
        for (let i = 5; i >= 0; i--) {
          const d = subMonths(new Date(), i);
          const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
          const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
          const mLoans = loans.filter((l) => {
            const isOfficer = l.approved_by === selectedOfficer || l.disbursed_by === selectedOfficer;
            const actionDate = l.approved_by === selectedOfficer ? l.approved_at : l.disbursed_at;
            return isOfficer && actionDate && actionDate >= mStart && actionDate <= mEnd;
          });
          monthlyTrend.push({ month: format(d, "MMM yy"), loans: mLoans.length, value: mLoans.reduce((s, l) => s + Number(l.loan_amount), 0) });
        }
      }

      return { officerStats, monthlyTrend };
    },
  });

  const doExport = (type: "pdf" | "excel") => {
    if (!data) return;
    const opts = {
      title: "Performance Report",
      subtitle: `${dateFrom} to ${dateTo}`,
      filters: { "Date Range": `${dateFrom} to ${dateTo}`, Officer: selectedOfficer === "all" ? "All" : officers.find((o) => o.id === selectedOfficer)?.full_name || selectedOfficer },
      headers: ["Officer", "Loans Processed", "Value Disbursed", "Avg Approval (days)", "Portfolio Quality", "Commission"],
      rows: data.officerStats.map((o) => [o.name, o.loansProcessed, formatK(o.totalDisbursed), o.avgApprovalDays !== null ? `${o.avgApprovalDays}d` : "—", o.portfolioQuality !== null ? `${o.portfolioQuality}%` : "—", formatK(o.commission)]),
      summaryRows: [
        { label: "Total Officers", value: String(data.officerStats.length) },
        { label: "Total Loans", value: String(data.officerStats.reduce((s, o) => s + o.loansProcessed, 0)) },
        { label: "Total Disbursed", value: formatK(data.officerStats.reduce((s, o) => s + o.totalDisbursed, 0)) },
      ],
      filename: `performance-${dateFrom}-to-${dateTo}`,
    };
    type === "pdf" ? exportReportPDF(opts) : exportReportExcel(opts);
  };

  const qualityBadge = (q: number | null) => {
    if (q === null) return <span className="text-muted-foreground">—</span>;
    if (q >= 95) return <Badge variant="outline" className="bg-success/20 text-success border-success/30">{q}%</Badge>;
    if (q >= 85) return <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">{q}%</Badge>;
    return <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">{q}%</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" /></div>
            <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" /></div>
            <div>
              <Label className="text-xs text-muted-foreground">Officer</Label>
              <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Officers</SelectItem>{officers.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name || o.id.slice(0, 8)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => doExport("pdf")} disabled={!data}><FileText size={14} className="mr-1" /> PDF</Button>
              <Button variant="outline" size="sm" onClick={() => doExport("excel")} disabled={!data}><FileSpreadsheet size={14} className="mr-1" /> Excel</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…</div>
      ) : data ? (
        <>
          {/* Comparison table */}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {data.officerStats.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><p>No officer activity in this period</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border/50">{["#", "Officer", "Loans", "Disbursed", "Avg Approval", "Quality", "Commission"].map((h) => <th key={h} className="text-left py-3 px-4 text-muted-foreground font-medium">{h}</th>)}</tr></thead>
                    <tbody>
                      {data.officerStats.map((o, i) => (
                        <tr key={o.userId} className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${selectedOfficer === o.userId ? "bg-primary/5" : ""}`}>
                          <td className="py-2.5 px-4 text-muted-foreground">{i + 1}</td>
                          <td className="py-2.5 px-4 font-medium text-foreground">{o.name}</td>
                          <td className="py-2.5 px-4 text-foreground">{o.loansProcessed}</td>
                          <td className="py-2.5 px-4 text-foreground">K{o.totalDisbursed.toLocaleString()}</td>
                          <td className="py-2.5 px-4 text-foreground">{o.avgApprovalDays !== null ? `${o.avgApprovalDays}d` : "—"}</td>
                          <td className="py-2.5 px-4">{qualityBadge(o.portfolioQuality)}</td>
                          <td className="py-2.5 px-4 text-foreground">K{o.commission.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly trend for selected officer */}
          {selectedOfficer !== "all" && data.monthlyTrend.length > 0 && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  Monthly Trend – {officers.find((o) => o.id === selectedOfficer)?.full_name || selectedOfficer.slice(0, 8)}
                </p>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `K${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Line yAxisId="left" type="monotone" dataKey="loans" stroke="hsl(var(--primary))" strokeWidth={2} name="Loans" />
                      <Line yAxisId="right" type="monotone" dataKey="value" stroke="hsl(var(--success))" strokeWidth={2} name="Value" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
};

export default PerformanceReport;
