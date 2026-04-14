import type { ReactNode } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Wrench,
  FlaskConical,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { format, differenceInDays, startOfDay } from "date-fns";
import { useAdminDashboardStats, useAdminUpcomingPayments } from "@/hooks/useAdminDashboardStats";
import { useLoanProductFilter } from "@/hooks/useLoanProductFilter";
import { anyBetaModuleActive, isBetaModule } from "@/config/featureRollout";
import { BetaBadge } from "@/components/admin/BetaBadge";

export type AdminDashboardContentProps = {
  loanProductId: string | null;
  title: ReactNode;
  productFilterSlot?: ReactNode;
  backLink?: ReactNode;
  afterContent?: ReactNode;
};

export function AdminDashboardContent({ loanProductId, title, productFilterSlot, backLink, afterContent }: AdminDashboardContentProps) {
  const navigate = useNavigate();
  const developerWhatsappLink =
    import.meta.env.VITE_DEV_SUPPORT_WHATSAPP ||
    "https://wa.me/260000000000?text=Hello%20Developer%2C%20I%20need%20help%20with%20the%20admin%20system.";

  const { data: stats, isLoading: statsLoading } = useAdminDashboardStats(loanProductId);
  const { data: upcomingPayments } = useAdminUpcomingPayments(loanProductId);

  const { data: operationalRisk } = useQuery({
    queryKey: ["admin-operational-risk"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [disbursements, disbursementTransactions, pendingClaims, staleKycDocs] = await Promise.all([
        supabase.from("disbursements").select("id, amount, status"),
        supabase
          .from("account_transactions")
          .select("id, amount, transaction_type, reference_type")
          .eq("transaction_type", "disbursement"),
        supabase.from("payment_claims").select("id, created_at, status").eq("status", "pending_review"),
        supabase
          .from("borrower_document_vault")
          .select("id, uploaded_at, is_verified")
          .eq("is_verified", false)
          .lt("uploaded_at", since),
      ]);
      if (disbursements.error) throw disbursements.error;
      if (disbursementTransactions.error) throw disbursementTransactions.error;
      if (pendingClaims.error) throw pendingClaims.error;
      if (staleKycDocs.error) throw staleKycDocs.error;

      const completedDisbursements = (disbursements.data || []).filter((d) => d.status === "completed");
      const completedTotal = completedDisbursements.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const accountTxTotal = (disbursementTransactions.data || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      return {
        pendingDisbursements: (disbursements.data || []).filter((d) => d.status === "pending").length,
        failedDisbursements: (disbursements.data || []).filter((d) => d.status === "failed").length,
        stalePaymentClaims: (pendingClaims.data || []).filter((c) => differenceInDays(new Date(), new Date(c.created_at)) >= 1).length,
        staleKycDocs: staleKycDocs.data?.length || 0,
        disbursementGap: Math.round((completedTotal - accountTxTotal) * 100) / 100,
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
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1">
            {backLink}
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{title}</h1>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Calendar size={14} />
              {format(new Date(), "EEEE, MMMM d, yyyy")}
              {statsLoading && loanProductId ? <span className="text-xs">(loading…)</span> : null}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 shrink-0">
            {productFilterSlot}
            <Button asChild className="gradient-primary shadow-button self-start sm:self-end">
              <Link to="/admin/applications">
                View Applications
                <ArrowUpRight size={16} className="ml-2" />
              </Link>
            </Button>
          </div>
        </div>

        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="py-2 px-0">
            <div className="marquee-wrap">
              <div className="marquee-track">
                <div className="inline-flex items-center gap-3 px-4">
                  <Badge className="bg-warning/20 text-warning border-warning/30 border">
                    <Wrench size={12} className="mr-1" />
                    Development Notice
                  </Badge>
                  <span className="text-sm text-foreground">
                    Some admin features may be unstable during ongoing development.
                  </span>
                  <a
                    href={developerWhatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    Need help? Contact developer on WhatsApp
                  </a>
                </div>
                <div className="inline-flex items-center gap-3 px-4" aria-hidden="true">
                  <Badge className="bg-warning/20 text-warning border-warning/30 border">
                    <Wrench size={12} className="mr-1" />
                    Development Notice
                  </Badge>
                  <span className="text-sm text-foreground">
                    Some admin features may be unstable during ongoing development.
                  </span>
                  <a
                    href={developerWhatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    Need help? Contact developer on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {anyBetaModuleActive() ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-2 px-0">
              <div className="marquee-wrap">
                <div className="marquee-track">
                  <div className="inline-flex items-center gap-3 px-4">
                    <Badge className="bg-primary/15 text-primary border-primary/30 border">
                      <FlaskConical size={12} className="mr-1" />
                      Beta features on
                    </Badge>
                    <span className="text-sm text-foreground">
                      Modules listed with a Beta label are still under testing. Set VITE_BETA_MODULES in .env to control
                      which items show the badge.
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-3 px-4" aria-hidden="true">
                    <Badge className="bg-primary/15 text-primary border-primary/30 border">
                      <FlaskConical size={12} className="mr-1" />
                      Beta features on
                    </Badge>
                    <span className="text-sm text-foreground">
                      Modules listed with a Beta label are still under testing.
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <QuickActions />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Operational Risk Strip</CardTitle>
              <CardDescription>Realtime blockers requiring action (organisation-wide)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daily Close Checklist</CardTitle>
              <CardDescription>Finance reconciliation before day close</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Disbursement ledger balanced</span>
                <Badge
                  variant="outline"
                  className={
                    Math.abs(operationalRisk?.disbursementGap ?? 0) < 0.01
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-destructive/20 text-destructive border-destructive/30"
                  }
                >
                  {Math.abs(operationalRisk?.disbursementGap ?? 0) < 0.01
                    ? "PASS"
                    : `GAP K${Math.abs(operationalRisk?.disbursementGap ?? 0).toLocaleString()}`}
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
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/50 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Total Applications</p>
                  <p className="text-4xl font-bold text-foreground">{stats?.totalApplications || 0}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-button">
                  <FileText className="text-primary-foreground" size={24} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">{stats?.pendingApplications || 0} pending review</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-warning/10 via-card to-card hover:border-warning/50 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Active Loans</p>
                  <p className="text-4xl font-bold text-foreground">{stats?.activeLoans || 0}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning to-warning/70 flex items-center justify-center shadow-lg">
                  <Clock className="text-white" size={24} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">{stats?.completedLoans || 0} completed</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-success/10 via-card to-card hover:border-success/50 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">
                    {loanProductId ? "Borrowers (this product)" : "Total Borrowers"}
                  </p>
                  <p className="text-4xl font-bold text-foreground">{stats?.totalBorrowers || 0}</p>
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
                  <p className="text-3xl font-bold text-foreground">K{(stats?.totalDisbursed || 0).toLocaleString()}</p>
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
              <p className="text-2xl font-bold text-success">K{(stats?.amountRecovered || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Payments received</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium mb-1">Outstanding Balance</p>
              <p className="text-2xl font-bold text-warning">K{(stats?.outstandingBalance || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Pending repayments</p>
            </CardContent>
          </Card>
          <Card className={`${(stats?.overdueCount || 0) > 0 ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-card/80"}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <p className="text-xl font-bold text-destructive">K{(stats?.overdueAmount || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stats?.overdueCount || 0} overdue payments</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                  <Calendar size={18} className="text-primary" />
                  Upcoming Payments
                </CardTitle>
                <CardDescription>Next payments due</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary">
                <Link to="/admin/repayments">
                  View All
                  <ArrowUpRight size={14} className="ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingPayments && upcomingPayments.length > 0 ? (
              <div className="space-y-3">
                {upcomingPayments.map((payment: { id: string; due_date: string; amount: number; loan_id: string; loan?: { full_name?: string | null } | null }) => {
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
                        if (e.key === "Enter" || e.key === " ") openLoan(payment.loan_id);
                      }}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openLoan(payment.loan_id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <User size={18} className="text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{payment.loan?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">K{Number(payment.amount).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={urgencyClass}>
                          {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(payment.due_date), "MMM d")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p>No upcoming payments</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-xl">Recent Applications</CardTitle>
                <CardDescription>Latest loan applications</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary">
                <Link to="/admin/applications">
                  View All
                  <ArrowUpRight size={14} className="ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
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
                  {stats?.recentApplications?.length === 0 ? (
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
                            {app.status.replace("_", " ")}
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
