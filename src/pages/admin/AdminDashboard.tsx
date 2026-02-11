import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GuidedTour from "@/components/common/GuidedTour";
import QuickActions from "@/components/admin/QuickActions";
import ModuleWidgets from "@/components/admin/ModuleWidgets";
import CapitalPoolWidget from "@/components/dashboard/CapitalPoolWidget";
import PortfolioHealthCards from "@/components/admin/PortfolioHealthCards";
import RepaymentPerformanceChart from "@/components/admin/RepaymentPerformanceChart";
import ProductMixChart from "@/components/admin/ProductMixChart";
import DisbursementTrendsChart from "@/components/admin/DisbursementTrendsChart";
import LoanOfficerPerformanceTable from "@/components/admin/LoanOfficerPerformanceTable";
import { Step } from "react-joyride";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Wallet,
  Activity,
  Banknote,
  Eye,
  MoreHorizontal,
  TrendingUp,
  Calendar,
  HelpCircle,
  AlertTriangle,
  Receipt,
  User,
  CreditCard,
  Loader2,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [runTour, setRunTour] = useState(false);
  const periodStart = startOfMonth(subMonths(new Date(), 0));
  const periodEnd = endOfMonth(subMonths(new Date(), 0));
  const tourSteps: Step[] = [
    {
      target: ".tour-admin-header",
      content: "Welcome to the Admin Command Center! Here you have a bird's-eye view of your entire lending operation.",
      placement: "bottom",
    },
    {
      target: ".tour-admin-stats",
      content: "Monitor key metrics like total applications, pending reviews, and your active loan portfolio in real-time.",
      placement: "bottom",
    },
    {
      target: ".tour-admin-charts",
      content: "Visualize your growth trends with advanced analytics for applications and disbursements.",
      placement: "top",
    },
    {
      target: ".tour-admin-recent",
      content: "Review the latest activities. Access application details directly to perform risk assessments or approve disbursements.",
      placement: "top",
    },
    {
      target: ".tour-admin-nav",
      content: "Use the sidebar to navigate between borrowers, applications, repayments, and system settings.",
      placement: "right",
    },
  ];

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [applications, profiles, disbursements, repayments] = await Promise.all([
        supabase.from('loan_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, is_blacklisted, blacklist_expires_at'),
        supabase.from('disbursements').select('*').eq('status', 'completed'),
        supabase.from('loan_repayments').select('*'),
      ]);

      const loans = applications.data || [];
      const allRepayments = repayments.data || [];
      const completedDisbursements = disbursements.data || [];
      const allProfiles = profiles.data || [];
      
      // Financial calculations
      const totalDisbursed = completedDisbursements.reduce((sum, d) => sum + Number(d.amount), 0);
      const activeLoans = loans.filter(l => ['active', 'disbursed'].includes(l.status));
      
      // Expected returns (total_repayment from all active/disbursed loans)
      const expectedReturns = activeLoans.reduce((sum, l) => sum + Number(l.total_repayment || 0), 0);
      
      // Total principal from active loans
      const totalPrincipal = activeLoans.reduce((sum, l) => sum + Number(l.loan_amount || 0), 0);
      
      // Expected interest (total_repayment - loan_amount)
      const expectedInterest = activeLoans.reduce((sum, l) => 
        sum + (Number(l.total_repayment || 0) - Number(l.loan_amount || 0)), 0);
      
      // Amount recovered (paid repayments)
      const paidRepayments = allRepayments.filter(r => r.status === 'paid');
      const amountRecovered = paidRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
      
      // Outstanding balance (pending repayments)
      const pendingRepayments = allRepayments.filter(r => r.status === 'pending');
      const outstandingBalance = pendingRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
      
      // Principal outstanding vs Interest outstanding
      const principalOutstanding = Math.max(0, totalPrincipal - paidRepayments.reduce((sum, r) => sum + Number(r.amount), 0));
      const interestOutstanding = Math.max(0, outstandingBalance - principalOutstanding);
      
      // Overdue amount
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const overdueRepayments = pendingRepayments.filter(r => new Date(r.due_date) < today);
      const overdueAmount = overdueRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
      // Loans due today (pending, due_date = today)
      const loansDueToday = pendingRepayments.filter(
        r => format(new Date(r.due_date), 'yyyy-MM-dd') === todayStr
      ).length;
      // Blacklisted borrowers count (exclude expired)
      const now = new Date().toISOString();
      const blacklistedCount = (profiles.data || []).filter(
        (p: { is_blacklisted?: boolean; blacklist_expires_at?: string | null }) =>
          p.is_blacklisted === true &&
          (p.blacklist_expires_at == null || p.blacklist_expires_at > now)
      ).length;

      return {
        totalApplications: loans.length,
        pendingApplications: loans.filter(l => l.status === 'pending').length,
        approvedApplications: loans.filter(l => l.status === 'approved').length,
        rejectedApplications: loans.filter(l => l.status === 'rejected').length,
        activeLoans: activeLoans.length,
        completedLoans: loans.filter(l => l.status === 'completed').length,
        defaultedLoans: loans.filter(l => l.status === 'defaulted').length,
        totalBorrowers: allProfiles.length,
        totalDisbursed,
        expectedReturns,
        expectedInterest,
        totalPrincipal,
        principalOutstanding,
        interestOutstanding,
        amountRecovered,
        outstandingBalance,
        overdueAmount,
        overdueCount: overdueRepayments.length,
        loansDueToday,
        blacklistedCount,
        blacklistedBorrowers: blacklistedCount,
        recentApplications: loans.slice(0, 6),
      };
    },
  });

  // Query for upcoming payments (nearest loans due)
  const { data: upcomingPayments } = useQuery({
    queryKey: ['upcoming-payments'],
    queryFn: async () => {
      const today = new Date();
      const { data, error } = await supabase
        .from('loan_repayments')
        .select(`
          *,
          loan:loan_applications (
            id,
            full_name,
            phone,
            email,
            loan_amount
          )
        `)
        .eq('status', 'pending')
        .gte('due_date', format(today, 'yyyy-MM-dd'))
        .order('due_date', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  // Fetch chart data from database
  const { data: chartData } = useQuery({
    queryKey: ['admin-chart-data'],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Get applications and disbursements for last 6 months
      const [applicationsResult, disbursementsResult] = await Promise.all([
        supabase
          .from('loan_applications')
          .select('created_at, loan_amount')
          .gte('created_at', sixMonthsAgo.toISOString()),
        supabase
          .from('disbursements')
          .select('created_at, amount')
          .eq('status', 'completed')
          .gte('created_at', sixMonthsAgo.toISOString()),
      ]);

      const applications = applicationsResult.data || [];
      const disbursements = disbursementsResult.data || [];

      // Group by month
      const monthMap = new Map<string, { applications: number; disbursements: number; amount: number }>();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthMap.set(key, { applications: 0, disbursements: 0, amount: 0 });
      }

      // Process applications
      applications.forEach((app: any) => {
        const date = new Date(app.created_at);
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        const existing = monthMap.get(key);
        if (existing) {
          existing.applications++;
        }
      });

      // Process disbursements
      disbursements.forEach((disb: any) => {
        const date = new Date(disb.created_at);
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        const existing = monthMap.get(key);
        if (existing) {
          existing.disbursements++;
          existing.amount += Number(disb.amount || 0);
        }
      });

      return Array.from(monthMap.entries()).map(([month, data]) => ({
        month,
        applications: data.applications,
        disbursements: data.disbursements,
        amount: data.amount,
      }));
    },
  });

  // Fetch weekly data
  const { data: weeklyData } = useQuery({
    queryKey: ['admin-weekly-data'],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from('loan_applications')
        .select('created_at')
        .gte('created_at', weekAgo.toISOString());

      if (error) throw error;

      const dayCounts: Record<string, number> = {
        'Mon': 0,
        'Tue': 0,
        'Wed': 0,
        'Thu': 0,
        'Fri': 0,
        'Sat': 0,
        'Sun': 0,
      };

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      (data || []).forEach((app: any) => {
        const date = new Date(app.created_at);
        const dayName = dayNames[date.getDay()];
        if (dayCounts[dayName] !== undefined) {
          dayCounts[dayName]++;
        }
      });

      return Object.entries(dayCounts).map(([day, count]) => ({ day, count }));
    },
  });

  const { data: officerStats = [] } = useQuery({
    queryKey: ["officer-loan-stats", periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("officer_loan_stats", {
        p_period_start: periodStart.toISOString().slice(0, 10),
        p_period_end: periodEnd.toISOString().slice(0, 10),
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: parData } = useQuery({
    queryKey: ["portfolio-at-risk"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("portfolio_at_risk", { p_as_of_date: new Date().toISOString().slice(0, 10) });
      if (error) throw error;
      return Array.isArray(data) && data[0] ? data[0] : null;
    },
  });

  const officerIds = [...new Set((officerStats as any[]).map((s: any) => s.officer_id).filter(Boolean))];
  const { data: officerProfiles = [] } = useQuery({
    queryKey: ["officer-profiles", officerIds],
    queryFn: async () => {
      if (officerIds.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", officerIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: officerIds.length > 0,
  });
  const getOfficerName = (id: string) => officerProfiles.find((p: { id: string }) => p.id === id)?.full_name || (officerProfiles.find((p: { id: string }) => p.id === id)?.email) || id?.slice(0, 8);

  const myStats = user ? (officerStats as any[]).find((s: any) => s.officer_id === user.id) : null;

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

  return (
    <AdminLayout>
      <GuidedTour
        steps={tourSteps}
        tourKey="admin-dashboard"
        externalRun={runTour}
        onFinish={() => setRunTour(false)}
      />
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 tour-admin-header">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar size={14} />
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-border/50"
              onClick={() => setRunTour(true)}
            >
              <HelpCircle size={16} className="mr-2 text-primary" />
              Tour
            </Button>
            <Button variant="outline" size="sm" className="border-border/50">
              <Activity size={16} className="mr-2" />
              Live Updates
            </Button>
            <Button asChild className="gradient-primary shadow-button">
              <Link to="/admin/applications">
                View Applications
                <ArrowUpRight size={16} className="ml-2" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Capital Pool Widget - Show available funds */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Wallet size={18} className="text-primary" />
            Available Capital Pool
          </h2>
          <CapitalPoolWidget />
        </div>

        {/* Module Widgets - Action Required */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity size={18} className="text-primary" />
            Needs Attention
          </h2>
          <ModuleWidgets />
        </div>

        {/* Portfolio Health KPIs */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            Portfolio Health
          </h2>
          <PortfolioHealthCards />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tour-admin-stats">
          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-primary/10 via-card to-card group hover:border-primary/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Total Applications</p>
                  <p className="text-4xl font-bold text-foreground">{stats?.totalApplications || 0}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-button">
                  <FileText className="text-primary-foreground" size={24} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm text-success">
                <TrendingUp size={14} />
                <span className="font-medium">{stats?.pendingApplications || 0} pending</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-warning/10 via-card to-card group hover:border-warning/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Active Loans</p>
                  <p className="text-4xl font-bold text-foreground">{stats?.activeLoans || 0}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning to-orange-600 flex items-center justify-center shadow-lg">
                  <Clock className="text-white" size={24} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 text-sm">
                <span className="px-2 py-1 rounded-full bg-success/20 text-success font-medium text-xs">
                  {stats?.completedLoans || 0} completed
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-success/10 via-card to-card group hover:border-success/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Total Borrowers</p>
                  <p className="text-4xl font-bold text-foreground">{stats?.totalBorrowers || 0}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Users className="text-white" size={24} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm text-success">
                <TrendingUp size={14} />
                <span className="font-medium">Active portfolio</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-purple-500/10 via-card to-card group hover:border-purple-500/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Total Disbursed</p>
                  <p className="text-3xl font-bold text-foreground">K{(stats?.totalDisbursed || 0).toLocaleString()}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                  <Wallet className="text-white" size={24} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm text-muted-foreground">
                <Banknote size={14} />
                <span className="font-medium">Principal released</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium mb-1">Expected Returns</p>
              <p className="text-2xl font-bold text-foreground">K{(stats?.expectedReturns || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Principal + Interest</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium mb-1">Amount Recovered</p>
              <p className="text-2xl font-bold text-success">K{(stats?.amountRecovered || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Payments received</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium mb-1">Principal Outstanding</p>
              <p className="text-2xl font-bold text-warning">K{(stats?.principalOutstanding || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Remaining principal</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium mb-1">Interest Outstanding</p>
              <p className="text-2xl font-bold text-primary">K{(stats?.interestOutstanding || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Revenue pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Operational Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
                <Calendar size={18} className="text-info" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats?.loansDueToday || 0}</p>
                <p className="text-xs text-muted-foreground">Loans Due Today</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                <XCircle size={18} className="text-destructive" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats?.defaultedLoans || 0}</p>
                <p className="text-xs text-muted-foreground">Defaulted Loans</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/30 bg-destructive/5">
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
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                <Users size={18} className="text-warning" />
              </div>
              <div>
                <p className="text-xl font-bold text-warning">{stats?.blacklistedBorrowers || 0}</p>
                <p className="text-xs text-muted-foreground">Blacklisted Borrowers</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium mb-1">PAR (Portfolio at Risk)</p>
              <p className="text-2xl font-bold text-foreground">{(parData as any)?.par_percent != null ? `${(parData as any).par_percent}%` : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">Overdue / outstanding</p>
            </CardContent>
          </Card>
        </div>

        {/* My performance (for staff) */}
        {myStats && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User size={18} />
                My performance (this month)
              </CardTitle>
              <CardDescription>Applications, approvals, disbursements, and portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs">Applications</p>
                  <p className="text-xl font-bold">{(myStats as { applications_submitted?: number }).applications_submitted ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Approved</p>
                  <p className="text-xl font-bold">{(myStats as { approved_count?: number }).approved_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Disbursed</p>
                  <p className="text-xl font-bold">{(myStats as { disbursed_count?: number }).disbursed_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Portfolio</p>
                  <p className="text-xl font-bold">K{Number((myStats as { portfolio_outstanding?: number }).portfolio_outstanding ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team performance */}
        {(officerStats as any[]).length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp size={18} />
                    Team performance
                  </CardTitle>
                  <CardDescription>Per-officer stats for {format(periodStart, "MMM yyyy")}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const rows = (officerStats as any[]).map((row: any) => ({
                      Officer: getOfficerName(row.officer_id as string),
                      Apps: row.applications_submitted ?? 0,
                      Approved: row.approved_count ?? 0,
                      Rejected: row.rejected_count ?? 0,
                      Disbursed: row.disbursed_count ?? 0,
                      "Approval %": row.approval_rate != null ? `${row.approval_rate}%` : "—",
                      "Default %": row.default_rate != null ? `${row.default_rate}%` : "—",
                      "Avg size": row.avg_loan_size != null ? Number(row.avg_loan_size) : null,
                      Portfolio: row.portfolio_outstanding != null ? Number(row.portfolio_outstanding) : null,
                    }));
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Team performance");
                    XLSX.writeFile(wb, `officer-stats-${format(periodStart, "yyyy-MM")}.xlsx`);
                  }}
                >
                  <Download size={14} className="mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Officer</th>
                      <th className="text-right py-2 font-medium">Apps</th>
                      <th className="text-right py-2 font-medium">Approved</th>
                      <th className="text-right py-2 font-medium">Rejected</th>
                      <th className="text-right py-2 font-medium">Disbursed</th>
                      <th className="text-right py-2 font-medium">Approval %</th>
                      <th className="text-right py-2 font-medium">Default %</th>
                      <th className="text-right py-2 font-medium">Avg size</th>
                      <th className="text-right py-2 font-medium">Portfolio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(officerStats as any[]).map((row: any) => (
                      <tr key={row.officer_id as string} className="border-b border-border/50">
                        <td className="py-2 font-medium">{getOfficerName(row.officer_id as string)}</td>
                        <td className="text-right py-2">{row.applications_submitted ?? 0}</td>
                        <td className="text-right py-2">{row.approved_count ?? 0}</td>
                        <td className="text-right py-2">{row.rejected_count ?? 0}</td>
                        <td className="text-right py-2">{row.disbursed_count ?? 0}</td>
                        <td className="text-right py-2">{row.approval_rate != null ? `${row.approval_rate}%` : "—"}</td>
                        <td className="text-right py-2">{row.default_rate != null ? `${row.default_rate}%` : "—"}</td>
                        <td className="text-right py-2">{row.avg_loan_size != null ? `K${Number(row.avg_loan_size).toLocaleString()}` : "—"}</td>
                        <td className="text-right py-2">{row.portfolio_outstanding != null ? `K${Number(row.portfolio_outstanding).toLocaleString()}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loans due today & Blacklisted */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          <Link to="/admin/repayments">
            <Card className="border-border/50 bg-card/80 hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs font-medium mb-1">Loans Due Today</p>
                <p className="text-2xl font-bold text-foreground">{stats?.loansDueToday || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Pending payments due today</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin/borrowers">
            <Card className="border-border/50 bg-card/80 hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs font-medium mb-1">Blacklisted Borrowers</p>
                <p className="text-2xl font-bold text-foreground">{stats?.blacklistedCount || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Cannot apply for new loans</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Upcoming Payments Widget */}
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
                {upcomingPayments.map((payment: any) => {
                  const daysUntil = differenceInDays(new Date(payment.due_date), new Date());
                  const urgencyClass = daysUntil === 0 ? 'text-destructive bg-destructive/10 border-destructive/30' :
                    daysUntil <= 3 ? 'text-warning bg-warning/10 border-warning/30' :
                    'text-success bg-success/10 border-success/30';
                  
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/loans?id=${payment.loan_id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <User size={18} className="text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{payment.loan?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">K{Number(payment.amount).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={urgencyClass}>
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(payment.due_date), 'MMM d')}
                        </p>
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

        {/* KPI Charts: Disbursement Trends + Repayment Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DisbursementTrendsChart />
          <RepaymentPerformanceChart />
        </div>

        {/* Product Mix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ProductMixChart />
          </div>
          <div className="lg:col-span-2">
            {/* Existing Lending Analytics chart kept below */}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm lg:col-span-2 tour-admin-charts">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground text-xl">Lending Analytics</CardTitle>
                  <CardDescription>Applications vs disbursements trend</CardDescription>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Applications</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <span className="text-muted-foreground">Disbursements</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                {chartData && chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDisb" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="applications"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorApps)"
                    />
                    <Area
                      type="monotone"
                      dataKey="disbursements"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorDisb)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p>Loading chart data...</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Activity */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-xl">Weekly Activity</CardTitle>
              <CardDescription>Applications this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {weeklyData && weeklyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <Bar
                        dataKey="count"
                        fill="hsl(var(--primary))"
                        radius={[6, 6, 0, 0]}
                        opacity={0.9}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
                <div className="text-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-success/20 mx-auto mb-2">
                    <CheckCircle className="text-success" size={18} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats?.approvedApplications || 0}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-destructive/20 mx-auto mb-2">
                    <XCircle className="text-destructive" size={18} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats?.rejectedApplications || 0}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-info/20 mx-auto mb-2">
                    <Activity className="text-info" size={18} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats?.activeLoans || 0}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loan Officer Performance */}
        <LoanOfficerPerformanceTable />

        {/* Recent Applications */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm tour-admin-recent">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-xl">Recent Applications</CardTitle>
                <CardDescription>Latest loan applications submitted</CardDescription>
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
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Term</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Status</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Date</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentApplications?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <FileText size={40} className="mx-auto mb-3 opacity-50" />
                        <p>No applications yet</p>
                      </td>
                    </tr>
                  ) : (
                    stats?.recentApplications?.map((app: any) => (
                      <tr key={app.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-foreground">{app.full_name}</p>
                            <p className="text-sm text-muted-foreground">{app.email}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-foreground">K{Number(app.loan_amount).toLocaleString()}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-muted-foreground">{app.loan_term_months} {(app as any).term_unit || 'months'}</span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className={`${getStatusBadge(app.status)} capitalize`}>
                            {app.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-muted-foreground text-sm">
                            {format(new Date(app.created_at), 'MMM d, yyyy')}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link to={`/admin/applications?id=${app.id}`}>
                                <Eye size={16} />
                              </Link>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover border-border">
                                <DropdownMenuItem onClick={() => navigate(`/admin/loans?id=${app.id}`)}>
                                  <CreditCard size={14} className="mr-2" />
                                  Loan Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/admin/repayments?loan_id=${app.id}`)}>
                                  <Receipt size={14} className="mr-2" />
                                  Payment Schedule
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/admin/borrowers?id=${app.user_id}`)}>
                                  <User size={14} className="mr-2" />
                                  Borrower Profile
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
