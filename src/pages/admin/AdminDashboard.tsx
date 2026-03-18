import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import QuickActions from "@/components/admin/QuickActions";
import {
  FileText,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Wallet,
  Banknote,
  Eye,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Receipt,
  User,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { format, differenceInDays, startOfDay } from "date-fns";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [applications, profiles, disbursements, repayments] = await Promise.all([
        supabase.from('loan_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id'),
        supabase.from('disbursements').select('*').eq('status', 'completed'),
        supabase.from('loan_repayments').select('*'),
      ]);

      const loans = applications.data || [];
      const allRepayments = repayments.data || [];
      const completedDisbursements = disbursements.data || [];
      
      const totalDisbursed = completedDisbursements.reduce((sum, d) => sum + Number(d.amount), 0);
      const activeLoans = loans.filter(l => ['active', 'disbursed'].includes(l.status));
      const paidRepayments = allRepayments.filter(r => r.status === 'paid');
      const amountRecovered = paidRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
      const pendingRepayments = allRepayments.filter(r => r.status === 'pending');
      const outstandingBalance = pendingRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
      
      const today = new Date();
      const overdueRepayments = pendingRepayments.filter(r => new Date(r.due_date) < today);
      const overdueAmount = overdueRepayments.reduce((sum, r) => sum + Number(r.amount), 0);

      return {
        totalApplications: loans.length,
        pendingApplications: loans.filter(l => l.status === 'pending').length,
        approvedApplications: loans.filter(l => l.status === 'approved').length,
        activeLoans: activeLoans.length,
        completedLoans: loans.filter(l => l.status === 'completed').length,
        totalBorrowers: (profiles.data || []).length,
        totalDisbursed,
        amountRecovered,
        outstandingBalance,
        overdueAmount,
        overdueCount: overdueRepayments.length,
        recentApplications: loans.slice(0, 6),
      };
    },
  });

  const { data: upcomingPayments } = useQuery({
    queryKey: ['upcoming-payments'],
    queryFn: async () => {
      const today = new Date();
      const { data, error } = await supabase
        .from('loan_repayments')
        .select(`*, loan:loan_applications (id, full_name, phone, loan_amount)`)
        .eq('status', 'pending')
        .gte('due_date', format(today, 'yyyy-MM-dd'))
        .order('due_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar size={14} />
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <Button asChild className="gradient-primary shadow-button">
            <Link to="/admin/applications">
              View Applications
              <ArrowUpRight size={16} className="ml-2" />
            </Link>
          </Button>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Key Stats */}
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
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning to-orange-600 flex items-center justify-center shadow-lg">
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
                  <p className="text-muted-foreground text-sm font-medium">Total Borrowers</p>
                  <p className="text-4xl font-bold text-foreground">{stats?.totalBorrowers || 0}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Users className="text-white" size={24} />
                </div>
              </div>
              <p className="text-sm text-success mt-3 flex items-center gap-1">
                <TrendingUp size={14} /> Active portfolio
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-purple-500/10 via-card to-card hover:border-purple-500/50 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Total Disbursed</p>
                  <p className="text-3xl font-bold text-foreground">K{(stats?.totalDisbursed || 0).toLocaleString()}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                  <Wallet className="text-white" size={24} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
                <Banknote size={14} /> Principal released
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
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

        {/* Upcoming Payments */}
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

        {/* Recent Applications */}
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
                    stats?.recentApplications?.map((app: any) => (
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
                            {app.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-muted-foreground text-sm">
                            {format(new Date(app.created_at), 'MMM d, yyyy')}
                          </span>
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
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
