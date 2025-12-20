import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format } from "date-fns";

const AdminDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [applications, profiles, disbursements] = await Promise.all([
        supabase.from('loan_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id'),
        supabase.from('disbursements').select('*').eq('status', 'completed'),
      ]);

      const loans = applications.data || [];
      const totalDisbursed = (disbursements.data || []).reduce((sum, d) => sum + Number(d.amount), 0);
      const totalLoanAmount = loans.reduce((sum, l) => sum + Number(l.loan_amount), 0);
      
      return {
        totalApplications: loans.length,
        pendingApplications: loans.filter(l => l.status === 'pending').length,
        approvedApplications: loans.filter(l => l.status === 'approved').length,
        rejectedApplications: loans.filter(l => l.status === 'rejected').length,
        activeLoans: loans.filter(l => ['active', 'disbursed'].includes(l.status)).length,
        totalBorrowers: profiles.data?.length || 0,
        totalDisbursed,
        totalLoanAmount,
        recentApplications: loans.slice(0, 6),
      };
    },
  });

  // Chart data
  const chartData = [
    { month: 'Jan', applications: 45, disbursements: 32, amount: 125000 },
    { month: 'Feb', applications: 52, disbursements: 38, amount: 145000 },
    { month: 'Mar', applications: 61, disbursements: 45, amount: 180000 },
    { month: 'Apr', applications: 58, disbursements: 41, amount: 165000 },
    { month: 'May', applications: 73, disbursements: 55, amount: 210000 },
    { month: 'Jun', applications: 89, disbursements: 67, amount: 285000 },
  ];

  const weeklyData = [
    { day: 'Mon', count: 12 },
    { day: 'Tue', count: 19 },
    { day: 'Wed', count: 15 },
    { day: 'Thu', count: 22 },
    { day: 'Fri', count: 18 },
    { day: 'Sat', count: 8 },
    { day: 'Sun', count: 5 },
  ];

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
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar size={14} />
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <span className="font-medium">+12%</span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-warning/10 via-card to-card group hover:border-warning/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Pending Review</p>
                  <p className="text-4xl font-bold text-foreground">{stats?.pendingApplications || 0}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning to-orange-600 flex items-center justify-center shadow-lg">
                  <Clock className="text-white" size={24} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 text-sm">
                <span className="px-2 py-1 rounded-full bg-warning/20 text-warning font-medium text-xs">
                  {stats?.pendingApplications || 0} awaiting
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
                <span className="font-medium">+8%</span>
                <span className="text-muted-foreground">new users</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-purple-500/10 via-card to-card group hover:border-purple-500/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm font-medium">Total Disbursed</p>
                  <p className="text-4xl font-bold text-foreground">K{(stats?.totalDisbursed || 0).toLocaleString()}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                  <Wallet className="text-white" size={24} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm text-success">
                <Banknote size={14} />
                <span className="font-medium">+15%</span>
                <span className="text-muted-foreground">this quarter</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm lg:col-span-2">
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

        {/* Recent Applications */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
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
                          <span className="text-muted-foreground">{app.loan_term_months} months</span>
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
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal size={16} />
                            </Button>
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