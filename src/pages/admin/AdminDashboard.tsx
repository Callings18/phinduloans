import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Users,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const AdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [applications, profiles, disbursements] = await Promise.all([
        supabase.from('loan_applications').select('*'),
        supabase.from('profiles').select('id'),
        supabase.from('disbursements').select('*').eq('status', 'completed'),
      ]);

      const loans = applications.data || [];
      const totalDisbursed = (disbursements.data || []).reduce((sum, d) => sum + Number(d.amount), 0);
      
      return {
        totalApplications: loans.length,
        pendingApplications: loans.filter(l => l.status === 'pending').length,
        approvedApplications: loans.filter(l => l.status === 'approved').length,
        rejectedApplications: loans.filter(l => l.status === 'rejected').length,
        activeLoans: loans.filter(l => ['active', 'disbursed'].includes(l.status)).length,
        totalBorrowers: profiles.data?.length || 0,
        totalDisbursed,
        recentApplications: loans.slice(0, 5),
      };
    },
  });

  // Mock chart data
  const chartData = [
    { month: 'Jan', applications: 45, disbursements: 32 },
    { month: 'Feb', applications: 52, disbursements: 38 },
    { month: 'Mar', applications: 61, disbursements: 45 },
    { month: 'Apr', applications: 58, disbursements: 41 },
    { month: 'May', applications: 73, disbursements: 55 },
    { month: 'Jun', applications: 89, disbursements: 67 },
  ];

  const statCards = [
    {
      title: "Total Applications",
      value: stats?.totalApplications || 0,
      icon: FileText,
      trend: "+12%",
      trendUp: true,
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "Pending Review",
      value: stats?.pendingApplications || 0,
      icon: Clock,
      trend: "5 new",
      trendUp: true,
      color: "from-yellow-500 to-orange-500",
    },
    {
      title: "Total Borrowers",
      value: stats?.totalBorrowers || 0,
      icon: Users,
      trend: "+8%",
      trendUp: true,
      color: "from-emerald-500 to-teal-500",
    },
    {
      title: "Total Disbursed",
      value: `K${(stats?.totalDisbursed || 0).toLocaleString()}`,
      icon: Wallet,
      trend: "+15%",
      trendUp: true,
      color: "from-purple-500 to-pink-500",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your lending operations</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <Card key={index} className="glass border-border/50 overflow-hidden group hover:border-primary/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">{stat.title}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                    <div className={`flex items-center gap-1 mt-2 text-sm ${stat.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stat.trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      <span>{stat.trend}</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                    <stat.icon className="text-white" size={22} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <Card className="glass border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-foreground">Lending Overview</CardTitle>
              <CardDescription>Applications and disbursements over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(330, 90%, 55%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(330, 90%, 55%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDisbursements" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(160, 70%, 50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(160, 70%, 50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(280, 30%, 18%)" />
                    <XAxis dataKey="month" stroke="hsl(280, 10%, 60%)" />
                    <YAxis stroke="hsl(280, 10%, 60%)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(280, 50%, 8%)',
                        border: '1px solid hsl(280, 30%, 18%)',
                        borderRadius: '12px',
                        color: 'hsl(0, 0%, 98%)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="applications"
                      stroke="hsl(330, 90%, 55%)"
                      fillOpacity={1}
                      fill="url(#colorApplications)"
                    />
                    <Area
                      type="monotone"
                      dataKey="disbursements"
                      stroke="hsl(160, 70%, 50%)"
                      fillOpacity={1}
                      fill="url(#colorDisbursements)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">Quick Stats</CardTitle>
              <CardDescription>Application breakdown</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="text-emerald-400" size={20} />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Approved</p>
                    <p className="text-muted-foreground text-sm">This month</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.approvedApplications || 0}</span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <XCircle className="text-red-400" size={20} />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Rejected</p>
                    <p className="text-muted-foreground text-sm">This month</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.rejectedApplications || 0}</span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <TrendingUp className="text-blue-400" size={20} />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Active Loans</p>
                    <p className="text-muted-foreground text-sm">Currently running</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.activeLoans || 0}</span>
              </div>

              <Button variant="hero" className="w-full" asChild>
                <Link to="/admin/applications">View All Applications</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
