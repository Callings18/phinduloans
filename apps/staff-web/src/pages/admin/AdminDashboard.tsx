import type { ReactNode } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import DisbursementTrendsChart from "@/components/admin/DisbursementTrendsChart";
import RepaymentPerformanceChart from "@/components/admin/RepaymentPerformanceChart";
import ProductMixChart from "@/components/admin/ProductMixChart";
import DashboardLoanPortfolio from "@/components/admin/DashboardLoanPortfolio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Button } from "@phinduloans/shared/components/ui/button";
import QuickActions from "@/components/admin/QuickActions";
import { LoanProductFilterSelect } from "@/components/admin/LoanProductFilterSelect";
import {
  FileText,
  Users,
  Clock,
  ArrowUpRight,
  Wallet,
  Banknote,
  Eye,
  TrendingUp,
  Calendar,
  AlertTriangle,
  User,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { format, differenceInDays, startOfDay } from "date-fns";
import { useAdminDashboardStats, useAdminUpcomingPayments } from "@/hooks/useAdminDashboardStats";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useLoanProductFilter } from "@/hooks/useLoanProductFilter";
import { isBetaModule } from "@phinduloans/shared/config/featureRollout";
import { BetaBadge } from "@/components/admin/BetaBadge";
import SmsPackageUsageCard from "@/components/admin/SmsPackageUsageCard";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";

export type AdminDashboardContentProps = {
  loanProductId: string | null;
  title: ReactNode;
  productFilterSlot?: ReactNode;
  backLink?: ReactNode;
  afterContent?: ReactNode;
};

export function AdminDashboardContent({ loanProductId, title, productFilterSlot, backLink, afterContent }: AdminDashboardContentProps) {
  const navigate = useNavigate();
  const { isStaff } = useAuth();

  const { data: stats, isLoading: statsLoading, isError: statsLoadError } = useAdminDashboardStats(loanProductId);
  const {
    data: upcomingPayments,
    isLoading: upcomingPaymentsLoading,
    isError: upcomingPaymentsError,
  } = useAdminUpcomingPayments(loanProductId);

  // Live updates: refresh dashboard stats, upcoming payments and operational
  // risk strip whenever loans, repayments, disbursements or payment claims
  // change anywhere in the system.
  useRealtimeInvalidate(
    [
      "loan_applications",
      "loan_repayments",
      "disbursements",
      "payment_claims",
      "account_transactions",
      "accounts",
    ],
    [
      ["admin-stats", loanProductId || null],
      ["upcoming-payments", loanProductId || null],
      ["admin-operational-risk"],
      ["module-stats"],
    ],
    "admin-dashboard-realtime",
  );

  const { data: operationalRisk, isError: operationalRiskFailed } = useQuery({
    queryKey: ["admin-operational-risk"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [disbursements, pendingClaims, staleKycDocs, accountReconciliation] = await Promise.all([
        supabase.from("disbursements").select("id, amount, status"),
        supabase.from("payment_claims").select("id, created_at, status").eq("status", "pending_review"),
        supabase
          .from("borrower_document_vault")
          .select("id, uploaded_at, is_verified")
          .eq("is_verified", false)
          .lt("uploaded_at", since),
        supabase.from("account_balance_reconciliation").select("account_id, variance"),
      ]);
      if (disbursements.error) throw disbursements.error;
      if (pendingClaims.error) throw pendingClaims.error;
      if (staleKycDocs.error) throw staleKycDocs.error;
      if (accountReconciliation.error) throw accountReconciliation.error;

      const accountBalanceMismatches = (accountReconciliation.data || []).filter(
        (account) => Math.abs(Number(account.variance || 0)) > 0.01,
      );
      const accountBalanceVariance = accountBalanceMismatches.reduce(
        (sum, account) => sum + Math.abs(Number(account.variance || 0)),
        0,
      );

      const completedDisbursements = (disbursements.data || []).filter((d) => d.status === "completed");
      const completedIds = completedDisbursements.map((d) => d.id);
      const ledgerResult = completedIds.length
        ? await supabase
            .from("account_transactions")
            .select("amount, reference_id")
            .eq("transaction_type", "disbursement")
            .eq("reference_type", "disbursement")
            .in("reference_id", completedIds)
        : { data: [], error: null };
      if (ledgerResult.error) throw ledgerResult.error;

      // Compare each current completed disbursement to its own immutable ledger
      // reference. Historical rows for applications, reversals and legacy
      // records must not be mixed into today's disbursement total.
      const ledgerByDisbursement = new Map<string, number>();
      for (const transaction of ledgerResult.data || []) {
        if (!transaction.reference_id) continue;
        ledgerByDisbursement.set(
          transaction.reference_id,
          (ledgerByDisbursement.get(transaction.reference_id) || 0) + Number(transaction.amount || 0),
        );
      }
      const missingLedger = completedDisbursements.filter((d) => !ledgerByDisbursement.has(d.id));
      const mismatchedLedger = completedDisbursements.filter((d) => {
        const ledgerAmount = ledgerByDisbursement.get(d.id);
        return ledgerAmount !== undefined && Math.abs(ledgerAmount - Number(d.amount || 0)) > 0.01;
      });
      const ledgerGap = completedDisbursements.reduce(
        (sum, d) => sum + Number(d.amount || 0) - (ledgerByDisbursement.get(d.id) || 0),
        0,
      );

      return {
        pendingDisbursements: (disbursements.data || []).filter((d) => d.status === "pending").length,
        failedDisbursements: (disbursements.data || []).filter((d) => d.status === "failed").length,
        stalePaymentClaims: (pendingClaims.data || []).filter((c) => differenceInDays(new Date(), new Date(c.created_at)) >= 1).length,
        staleKycDocs: staleKycDocs.data?.length || 0,
        disbursementGap: Math.round(ledgerGap * 100) / 100,
        missingLedgerCount: missingLedger.length,
        missingLedgerAmount: Math.round(missingLedger.reduce((sum, d) => sum + Number(d.amount || 0), 0) * 100) / 100,
        mismatchedLedgerCount: mismatchedLedger.length,
        accountBalanceMismatchCount: accountBalanceMismatches.length,
        accountBalanceVariance: Math.round(accountBalanceVariance * 100) / 100,
      };
    },
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-warning/20 text-warning border-warning/30",
      approved: "bg-success/20 text-success border-success/30",
      rejected: "bg-destructive/20 text-destructive border-destructive/30",
      under_review: "bg-info/20 text-info border-info/30",
      disbursed: "bg-primary/20 text-primary border-primary/30",
      active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  const openLoan = (loanId: string) => {
    const qp = new URLSearchParams();
    if (loanProductId) qp.set("productId", loanProductId);
    qp.set("id", loanId);
    navigate(`/admin/loans?${qp.toString()}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            {backLink}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] uppercase tracking-wide">
                Pilot
              </Badge>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Calendar size={14} />
              {format(new Date(), "EEEE, MMMM d, yyyy")}
              {statsLoading && loanProductId ? <span className="text-xs">(loading…)</span> : null}
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            {productFilterSlot}
            <Button asChild className="gradient-primary shadow-button w-full self-start sm:w-auto sm:self-end">
              <Link to="/admin/applications">
                View Applications
                <ArrowUpRight size={16} className="ml-2" />
              </Link>
            </Button>
          </div>
        </div>

        <QuickActions />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Operational Risk Strip</CardTitle>
              <CardDescription>Realtime blockers requiring action (organisation-wide)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {operationalRiskFailed ? (
                <p className="text-sm text-muted-foreground">
                  Operational metrics could not be loaded. Refresh the page or try again shortly.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pending disbursements</span>
                    <Badge variant="outline">{operationalRisk?.pendingDisbursements ?? 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Failed disbursements</span>
                    <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                      {operationalRisk?.failedDisbursements ?? 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Claims {" > "} 24h pending</span>
                    <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                      {operationalRisk?.stalePaymentClaims ?? 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">KYC docs {" > "} 24h unreviewed</span>
                    <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                      {operationalRisk?.staleKycDocs ?? 0}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daily Close Checklist</CardTitle>
              <CardDescription>Finance reconciliation before day close</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {operationalRiskFailed ? (
                <p className="text-muted-foreground">Daily close checks unavailable until metrics load.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Disbursement ledger reconciliation</span>
                    <Badge
                      variant="outline"
                      className={
                        Math.abs(operationalRisk?.disbursementGap ?? 0) < 0.01
                          ? "bg-success/20 text-success border-success/30"
                          : "bg-destructive/20 text-destructive border-destructive/30"
                      }
                    >
                      {Math.abs(operationalRisk?.disbursementGap ?? 0) < 0.01 &&
                      (operationalRisk?.missingLedgerCount ?? 0) === 0 &&
                      (operationalRisk?.mismatchedLedgerCount ?? 0) === 0
                        ? "PASS"
                        : `REVIEW K${Math.abs(operationalRisk?.disbursementGap ?? 0).toLocaleString()}`}
                    </Badge>
                  </div>
                  {(operationalRisk?.missingLedgerCount ?? 0) > 0 || (operationalRisk?.mismatchedLedgerCount ?? 0) > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {operationalRisk?.missingLedgerCount ?? 0} missing ledger rows (K{(operationalRisk?.missingLedgerAmount ?? 0).toLocaleString()}); {operationalRisk?.mismatchedLedgerCount ?? 0} amount mismatches.
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account balance reconciliation</span>
                    <Badge
                      variant="outline"
                      className={
                        (operationalRisk?.accountBalanceMismatchCount ?? 0) === 0
                          ? "bg-success/20 text-success border-success/30"
                          : "bg-destructive/20 text-destructive border-destructive/30"
                      }
                    >
                      {(operationalRisk?.accountBalanceMismatchCount ?? 0) === 0
                        ? "PASS"
                        : `REVIEW K${(operationalRisk?.accountBalanceVariance ?? 0).toLocaleString()} · ${operationalRisk?.accountBalanceMismatchCount} account(s)`}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">No failed disbursements outstanding</span>
                    <Badge variant="outline">{(operationalRisk?.failedDisbursements ?? 0) === 0 ? "PASS" : "REVIEW"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">No stale payment claims</span>
                    <Badge variant="outline">{(operationalRisk?.stalePaymentClaims ?? 0) === 0 ? "PASS" : "REVIEW"}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/50 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Total Applications</p>
                  <p className="text-4xl font-bold text-foreground flex items-center min-h-[2.5rem]">
                    {statsLoadError ? "—" : statsLoading ? <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" /> : stats?.totalApplications ?? 0}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-button">
                  <FileText className="text-primary-foreground" size={24} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {statsLoadError || statsLoading ? "—" : `${stats?.pendingApplications ?? 0} pending review`}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-warning/10 via-card to-card hover:border-warning/50 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Active Loans</p>
                  <p className="text-4xl font-bold text-foreground flex items-center min-h-[2.5rem]">
                    {statsLoadError ? "—" : statsLoading ? <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" /> : stats?.activeLoans ?? 0}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning to-warning/70 flex items-center justify-center shadow-lg">
                  <Clock className="text-white" size={24} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {statsLoadError || statsLoading ? "—" : `${stats?.completedLoans ?? 0} completed`}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-success/10 via-card to-card hover:border-success/50 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">
                    {loanProductId ? "Borrowers (this product)" : "Total Borrowers"}
                  </p>
                  <p className="text-4xl font-bold text-foreground flex items-center min-h-[2.5rem]">
                    {statsLoadError ? "—" : statsLoading ? <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" /> : stats?.totalBorrowers ?? 0}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success to-success/70 flex items-center justify-center shadow-lg">
                  <Users className="text-white" size={24} />
                </div>
              </div>
              <p className="text-sm text-success mt-3 flex items-center gap-1">
                <TrendingUp size={14} /> {loanProductId ? "Distinct applicants in view" : "Active portfolio"}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/50 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Total Disbursed</p>
                  <p className="text-3xl font-bold text-foreground flex items-center min-h-[2rem]">
                    {statsLoadError ? "—" : statsLoading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : `K${(stats?.totalDisbursed ?? 0).toLocaleString()}`}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                  <Wallet className="text-white" size={24} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
                <Banknote size={14} /> Principal released
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium mb-1">Amount Recovered</p>
              <p className="text-2xl font-bold text-success flex items-center min-h-[2rem]">
                {statsLoadError ? "—" : statsLoading ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /> : `K${(stats?.amountRecovered ?? 0).toLocaleString()}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Payments received</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium mb-1">Outstanding Balance</p>
              <p className="text-2xl font-bold text-warning flex items-center min-h-[2rem]">
                {statsLoadError ? "—" : statsLoading ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /> : `K${(stats?.outstandingBalance ?? 0).toLocaleString()}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pending repayments</p>
            </CardContent>
          </Card>
          <Card
            className={`${
              !statsLoading && !statsLoadError && (stats?.overdueCount ?? 0) > 0
                ? "border-destructive/30 bg-destructive/5"
                : "border-border/50 bg-card/80"
            }`}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <p className="text-xl font-bold text-destructive flex items-center min-h-[1.75rem]">
                  {statsLoadError ? "—" : statsLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : `K${(stats?.overdueAmount ?? 0).toLocaleString()}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {statsLoadError || statsLoading ? "—" : `${stats?.overdueCount ?? 0} overdue payments`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                  <Calendar size={18} className="shrink-0 text-primary" />
                  Upcoming Payments
                </CardTitle>
                <CardDescription>Live — all payments due in the next 7 days, across every loan type</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="shrink-0 self-start text-primary hover:text-primary sm:self-auto">
                <Link to="/admin/repayments">
                  View All
                  <ArrowUpRight size={14} className="ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingPaymentsError ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Upcoming payments could not be loaded. Try refreshing the page.
              </div>
            ) : upcomingPaymentsLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin opacity-70" />
                <p className="text-sm">Loading payments…</p>
              </div>
            ) : upcomingPayments && upcomingPayments.length > 0 ? (
              <div className="space-y-3">
                {upcomingPayments.slice(0, 8).map((payment: { id: string; due_date: string; amount: number; loan_id: string; loan?: { full_name?: string | null } | null }) => {
                  const daysUntil = differenceInDays(startOfDay(new Date(payment.due_date)), startOfDay(new Date()));
                  const urgencyClass =
                    daysUntil === 0
                      ? "text-destructive bg-destructive/10 border-destructive/30"
                      : daysUntil <= 3
                        ? "text-warning bg-warning/10 border-warning/30"
                        : "text-success bg-success/10 border-success/30";

                  return (
                    <div
                      key={payment.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openLoan(payment.loan_id);
                        }
                      }}
                      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                      onClick={() => openLoan(payment.loan_id)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                          <User size={18} className="text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{payment.loan?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">K{Number(payment.amount).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end sm:text-right">
                        <Badge variant="outline" className={urgencyClass}>
                          {daysUntil === 0 ? "Due today" : daysUntil === 1 ? "Due tomorrow" : `Due in ${daysUntil} days`}
                        </Badge>
                        <p className="text-xs text-muted-foreground sm:mt-1">{format(new Date(payment.due_date), "MMM d")}</p>
                      </div>
                    </div>
                  );
                })}
                {upcomingPayments.length > 8 && (
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    +{upcomingPayments.length - 8} more due in the next 7 days — see Repayments
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p>No upcoming payments</p>
              </div>
            )}
          </CardContent>
        </Card>

        <DashboardLoanPortfolio loanProductId={loanProductId} />

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-xl text-foreground">Recent Applications</CardTitle>
                <CardDescription>Latest loan applications</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="shrink-0 self-start text-primary hover:text-primary sm:self-auto">
                <Link to="/admin/applications">
                  View All
                  <ArrowUpRight size={14} className="ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="overflow-x-auto rounded-md border border-border/40">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Applicant</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Amount</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Status</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Date</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {statsLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin opacity-70" />
                        <p>Loading applications…</p>
                      </td>
                    </tr>
                  ) : statsLoadError ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <p>Recent applications could not be loaded.</p>
                      </td>
                    </tr>
                  ) : (stats?.recentApplications?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <FileText size={40} className="mx-auto mb-3 opacity-50" />
                        <p>No applications yet</p>
                      </td>
                    </tr>
                  ) : (
                    stats?.recentApplications?.map((app: { id: string; full_name: string; phone: string; loan_amount: number; status: string; created_at: string }) => (
                      <tr key={app.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-foreground">{app.full_name}</p>
                            <p className="text-sm text-muted-foreground">{app.phone}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-foreground">K{Number(app.loan_amount).toLocaleString()}</span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className={`${getStatusBadge(app.status)} capitalize`}>
                            {app.status.split("_").join(" ")}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-muted-foreground text-sm">{format(new Date(app.created_at), "MMM d, yyyy")}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link to={`/admin/applications?id=${app.id}`}>
                              <Eye size={16} />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DisbursementTrendsChart />
          <RepaymentPerformanceChart />
        </div>

        <ProductMixChart />

        {isStaff && !loanProductId ? <SmsPackageUsageCard compact /> : null}

        {afterContent}
      </div>
    </AdminLayout>
  );
}

const AdminDashboard = () => {
  const { selectedProductId, setSelectedProductId } = useLoanProductFilter();

  return (
    <AdminDashboardContent
      loanProductId={selectedProductId}
      title="Dashboard"
      productFilterSlot={
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
          <LoanProductFilterSelect value={selectedProductId} onChange={setSelectedProductId} id="admin-dash-product" />
          {isBetaModule("loans_by_product") ? <BetaBadge className="self-start sm:mb-1" /> : null}
        </div>
      }
    />
  );
};

export default AdminDashboard;
