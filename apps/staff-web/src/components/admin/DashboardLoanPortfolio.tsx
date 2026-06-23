import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Button } from "@phinduloans/shared/components/ui/button";
import { format } from "date-fns";
import { Activity, CheckCircle, ArrowUpRight, Loader2, User } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

type PortfolioStatus = "active" | "completed";

const STATUS_GROUPS: Record<PortfolioStatus, string[]> = {
  active: ["active", "disbursed"],
  completed: ["completed"],
};

interface PortfolioLoan {
  id: string;
  full_name: string | null;
  loan_amount: number | null;
  loan_term_months: number | null;
  term_unit: string | null;
  status: string | null;
  created_at: string;
}

interface DashboardLoanPortfolioProps {
  loanProductId: string | null;
}

export default function DashboardLoanPortfolio({ loanProductId }: DashboardLoanPortfolioProps) {
  // Active loans are shown by default; completed loans live behind the filter.
  const [statusFilter, setStatusFilter] = useState<PortfolioStatus>("active");

  useRealtimeInvalidate(
    ["loan_applications"],
    [["dashboard-portfolio"]],
    "dashboard-portfolio-realtime",
  );

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-portfolio", loanProductId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("loan_applications")
        .select("id, full_name, loan_amount, loan_term_months, term_unit, status, created_at", {
          count: "exact",
        })
        .in("status", STATUS_GROUPS[statusFilter] as any)
        .order("created_at", { ascending: false })
        .limit(8);
      if (loanProductId) q = q.eq("loan_product_id", loanProductId);
      const { data: rows, error, count } = await q;
      if (error) throw error;
      return { rows: (rows || []) as PortfolioLoan[], count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Activity size={18} className="shrink-0 text-primary" />
              Loan Portfolio
            </CardTitle>
            <CardDescription>
              Active loans by default — switch to view completed ones
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Segmented Active / Completed filter */}
            <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === "active"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Activity size={14} /> Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === "completed"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckCircle size={14} /> Completed
              </button>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0 text-primary hover:text-primary">
              <Link to={statusFilter === "active" ? "/admin/loans" : "/admin/loans"}>
                View All
                <ArrowUpRight size={14} className="ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin opacity-70" />
            <p className="text-sm">Loading loans…</p>
          </div>
        ) : rows.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Showing {rows.length} of {total} {statusFilter} loan{total === 1 ? "" : "s"}
            </p>
            {rows.map((loan) => (
              <div
                key={loan.id}
                className="flex flex-col gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User size={18} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{loan.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      K{Number(loan.loan_amount || 0).toLocaleString()} • {loan.loan_term_months}{" "}
                      {loan.term_unit || "months"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end">
                  <Badge
                    variant="outline"
                    className={
                      statusFilter === "active"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-primary/20 text-primary border-primary/30"
                    }
                  >
                    {loan.status?.replace(/_/g, " ")}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(loan.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Activity size={32} className="mx-auto mb-2 opacity-50" />
            <p>No {statusFilter} loans{loanProductId ? " for this loan house" : ""}.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
