import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Button } from "@phinduloans/shared/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { subDays, differenceInDays } from "date-fns";
import { Loader2, Trophy, ArrowUpDown } from "lucide-react";

type SortKey = "loansProcessed" | "totalDisbursed" | "avgApprovalDays" | "portfolioQuality" | "commission";
type Period = "7" | "30" | "90" | "all";

interface OfficerRow {
  userId: string;
  name: string;
  loansProcessed: number;
  totalDisbursed: number;
  avgApprovalDays: number | null;
  portfolioQuality: number | null;
  commission: number;
}

const LoanOfficerPerformanceTable = () => {
  const [period, setPeriod] = useState<Period>("30");
  const [sortKey, setSortKey] = useState<SortKey>("loansProcessed");
  const [sortAsc, setSortAsc] = useState(false);

  const cutoff = period === "all" ? null : subDays(new Date(), Number(period));

  const { data: officers, isLoading } = useQuery({
    queryKey: ["officer-performance", period],
    queryFn: async () => {
      // Fetch all needed data in parallel
      const [loansRes, repaymentsRes, employeesRes, payrollRes, profilesRes] = await Promise.all([
        supabase
          .from("loan_applications")
          .select("id, approved_by, disbursed_by, loan_amount, status, created_at, approved_at, disbursed_at"),
        supabase
          .from("loan_repayments")
          .select("loan_id, status, due_date"),
        supabase
          .from("employees")
          .select("id, user_id, full_name, is_active")
          .eq("is_active", true),
        supabase
          .from("payroll_records")
          .select("employee_id, commission_amount, payroll_year, payroll_month")
          .order("payroll_year", { ascending: false })
          .order("payroll_month", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, email"),
      ]);

      const loans = loansRes.data || [];
      const repayments = repaymentsRes.data || [];
      const employees = employeesRes.data || [];
      const payroll = payrollRes.data || [];
      const profiles = profilesRes.data || [];

      const cutoffStr = cutoff?.toISOString() || null;

      // Build a set of officer user_ids from employees
      const employeeByUserId = new Map(
        employees.filter((e) => e.user_id).map((e) => [e.user_id!, e])
      );
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const employeeById = new Map(employees.map((e) => [e.id, e]));

      // Find all unique officer IDs from loans (approved_by or disbursed_by)
      const officerIds = new Set<string>();
      loans.forEach((l) => {
        if (l.approved_by) officerIds.add(l.approved_by);
        if (l.disbursed_by) officerIds.add(l.disbursed_by);
      });

      // Build overdue map: loan_id -> has overdue
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const overdueLoans = new Set<string>();
      repayments.forEach((r) => {
        if (r.status === "pending" && r.due_date < todayStr) {
          overdueLoans.add(r.loan_id);
        }
      });

      // Latest payroll commission per employee
      const latestCommission = new Map<string, number>();
      payroll.forEach((pr) => {
        if (!latestCommission.has(pr.employee_id)) {
          latestCommission.set(pr.employee_id, Number(pr.commission_amount || 0));
        }
      });

      const results: OfficerRow[] = [];

      officerIds.forEach((uid) => {
        // Filter loans this officer touched in period
        const officerLoans = loans.filter((l) => {
          const isOfficer = l.approved_by === uid || l.disbursed_by === uid;
          if (!isOfficer) return false;
          if (!cutoffStr) return true;
          // Check if loan was processed (approved or disbursed) within period
          const actionDate = l.approved_by === uid ? l.approved_at : l.disbursed_at;
          return actionDate && actionDate >= cutoffStr;
        });

        if (officerLoans.length === 0) return;

        const loansProcessed = officerLoans.length;
        const totalDisbursed = officerLoans.reduce(
          (sum, l) => sum + Number(l.loan_amount || 0),
          0
        );

        // Average approval time (only for loans they approved)
        const approvedLoans = officerLoans.filter(
          (l) => l.approved_by === uid && l.approved_at && l.created_at
        );
        const avgApprovalDays =
          approvedLoans.length > 0
            ? approvedLoans.reduce((sum, l) => {
                return sum + differenceInDays(new Date(l.approved_at!), new Date(l.created_at));
              }, 0) / approvedLoans.length
            : null;

        // Portfolio quality: % of their active loans that are NOT overdue
        const activeLoans = loans.filter(
          (l) =>
            (l.approved_by === uid || l.disbursed_by === uid) &&
            ["active", "disbursed"].includes(l.status)
        );
        const currentLoans = activeLoans.filter((l) => !overdueLoans.has(l.id));
        const portfolioQuality =
          activeLoans.length > 0
            ? (currentLoans.length / activeLoans.length) * 100
            : null;

        // Get name
        const emp = employeeByUserId.get(uid);
        const profile = profileMap.get(uid);
        const name = emp?.full_name || profile?.full_name || profile?.email || uid.slice(0, 8);

        // Commission from latest payroll
        const empId = emp?.id;
        const commission = empId ? latestCommission.get(empId) || 0 : 0;

        results.push({
          userId: uid,
          name,
          loansProcessed,
          totalDisbursed,
          avgApprovalDays: avgApprovalDays !== null ? Math.round(avgApprovalDays * 10) / 10 : null,
          portfolioQuality: portfolioQuality !== null ? Math.round(portfolioQuality * 10) / 10 : null,
          commission,
        });
      });

      return results;
    },
  });

  const sorted = useMemo(() => {
    if (!officers) return [];
    return [...officers]
      .sort((a, b) => {
        const av = a[sortKey] ?? -Infinity;
        const bv = b[sortKey] ?? -Infinity;
        return sortAsc ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
      })
      .slice(0, 10);
  }, [officers, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const qualityBadge = (q: number | null) => {
    if (q === null) return <span className="text-muted-foreground">—</span>;
    if (q >= 95)
      return <Badge variant="outline" className="bg-success/20 text-success border-success/30">{q}%</Badge>;
    if (q >= 85)
      return <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">{q}%</Badge>;
    return <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">{q}%</Badge>;
  };

  const periods: { label: string; value: Period }[] = [
    { label: "7 days", value: "7" },
    { label: "30 days", value: "30" },
    { label: "90 days", value: "90" },
    { label: "All time", value: "all" },
  ];

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="text-right py-3 px-4 text-muted-foreground font-medium text-sm cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={sortKey === field ? "text-primary" : "opacity-40"} />
      </span>
    </th>
  );

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy size={18} className="text-primary" />
              Loan Officer Performance
            </CardTitle>
            <CardDescription>Top officers ranked by activity</CardDescription>
          </div>
          <div className="flex gap-1">
            {periods.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "outline"}
                size="sm"
                className={period === p.value ? "" : "border-border/50"}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading performance data…
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy size={32} className="mx-auto mb-2 opacity-40" />
            <p>No officer activity found for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">#</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Officer</th>
                  <SortHeader label="Loans" field="loansProcessed" />
                  <SortHeader label="Disbursed" field="totalDisbursed" />
                  <SortHeader label="Avg Approval (days)" field="avgApprovalDays" />
                  <SortHeader label="Portfolio Quality" field="portfolioQuality" />
                  <SortHeader label="Commission" field="commission" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((o, i) => (
                  <tr key={o.userId} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground font-medium">{i + 1}</td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-foreground">{o.name}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-foreground">{o.loansProcessed}</td>
                    <td className="py-3 px-4 text-right font-medium text-foreground">
                      K{o.totalDisbursed.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-foreground">
                      {o.avgApprovalDays !== null ? `${o.avgApprovalDays}d` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">{qualityBadge(o.portfolioQuality)}</td>
                    <td className="py-3 px-4 text-right font-medium text-foreground">
                      K{o.commission.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LoanOfficerPerformanceTable;
