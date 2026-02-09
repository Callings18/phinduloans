import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth, isAfter } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Users,
  Wallet,
  FileText,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  AlertTriangle,
} from "lucide-react";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--info))'];

const AdminReports = () => {
  const { can } = usePermissions();
  const [dateRange, setDateRange] = useState("6months");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: staffList = [] } = useQuery({
    queryKey: ["reports-staff"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").neq("role", "user").neq("role", "employer");
      if (!roles?.length) return [];
      const ids = roles.map((r: { user_id: string }) => r.user_id);
      const { data: p } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return p ?? [];
    },
  });

  const { data: loanProducts = [] } = useQuery({
    queryKey: ["reports-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_products").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["admin-reports", dateRange, filterEmployee, filterProduct, filterStatus],
    queryFn: async () => {
      let appQuery = supabase.from("loan_applications").select("*").order("created_at", { ascending: true });
      if (filterEmployee !== "all") appQuery = appQuery.eq("assigned_to", filterEmployee);
      if (filterProduct !== "all") appQuery = appQuery.eq("loan_product_id", filterProduct);
      if (filterStatus !== "all") appQuery = appQuery.eq("status", filterStatus as any);
      const monthsBack = dateRange === "3months" ? 3 : dateRange === "12months" ? 12 : 6;
      const from = subMonths(new Date(), monthsBack);
      appQuery = appQuery.gte("created_at", from.toISOString());
      const [applications, disbursements, repayments, profiles] = await Promise.all([
        appQuery,
        supabase.from("disbursements").select("*"),
        supabase.from("loan_repayments").select("*"),
        supabase.from("profiles").select("id, created_at"),
      ]);

      const loans = applications.data || [];
      const disb = disbursements.data || [];
      const reps = repayments.data || [];
      const users = profiles.data || [];

      // Calculate monthly data
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const monthLoans = loans.filter(l => {
          const created = new Date(l.created_at);
          return created >= start && created <= end;
        });

        const monthDisbursements = disb.filter(d => {
          const created = new Date(d.created_at);
          return created >= start && created <= end && d.status === 'completed';
        });

        months.push({
          month: format(date, 'MMM'),
          applications: monthLoans.length,
          approved: monthLoans.filter(l => l.status === 'approved').length,
          disbursed: monthDisbursements.length,
          amount: monthDisbursements.reduce((sum, d) => sum + Number(d.amount), 0),
          volume: monthLoans.reduce((sum, l) => sum + Number(l.loan_amount), 0),
        });
      }

      // Status distribution
      const statusDistribution = [
        { name: 'Pending', value: loans.filter(l => l.status === 'pending').length, color: 'hsl(var(--warning))' },
        { name: 'Approved', value: loans.filter(l => l.status === 'approved').length, color: 'hsl(var(--success))' },
        { name: 'Rejected', value: loans.filter(l => l.status === 'rejected').length, color: 'hsl(var(--destructive))' },
        { name: 'Disbursed', value: loans.filter(l => ['disbursed', 'active'].includes(l.status)).length, color: 'hsl(var(--primary))' },
        { name: 'Completed', value: loans.filter(l => l.status === 'completed').length, color: 'hsl(var(--emerald-500))' },
      ].filter(s => s.value > 0);

      // Collection Data (Scheduled vs Paid)
      const collectionHistory = [];
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(today, i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const scheduledReps = reps.filter(r => {
          const due = new Date(r.due_date);
          return due >= start && due <= end;
        });

        const paidReps = scheduledReps.filter(r => r.status === 'paid');

        collectionHistory.push({
          month: format(date, 'MMM'),
          target: scheduledReps.reduce((sum, r) => sum + Number(r.amount), 0),
          collected: paidReps.reduce((sum, r) => sum + Number(r.amount), 0),
        });
      }

      // Portfolio Quality (PAR)
      const activeLoans = loans.filter(l => ['active', 'disbursed'].includes(l.status));
      const activeBalance = activeLoans.reduce((sum, l) => sum + Number(l.loan_amount), 0);

      const overdueReps = reps.filter(r => r.status === 'pending' && isAfter(today, new Date(r.due_date)));
      const overdueAmount = overdueReps.reduce((sum, r) => sum + Number(r.amount), 0);

      const parPercentage = activeBalance > 0 ? (overdueAmount / activeBalance) * 100 : 0;

      // Financials
      const totalInterestRevenue = loans
        .filter(l => ['disbursed', 'active', 'completed'].includes(l.status))
        .reduce((sum, l) => sum + (Number(l.total_repayment) - Number(l.loan_amount)), 0);

      // Employment type distribution
      const employmentTypes = [
        { name: 'Employed', value: loans.filter(l => l.employment_type === 'employed').length },
        { name: 'Self Employed', value: loans.filter(l => l.employment_type === 'self_employed').length },
        { name: 'Contract', value: loans.filter(l => l.employment_type === 'contract').length },
        { name: 'Other', value: loans.filter(l => l.employment_type === 'other').length },
      ].filter(e => e.value > 0);

      // Loan purpose distribution
      const purposeMap: Record<string, number> = {};
      loans.forEach(l => {
        const purpose = l.loan_purpose || 'Other';
        purposeMap[purpose] = (purposeMap[purpose] || 0) + 1;
      });
      const loanPurposes = Object.entries(purposeMap).map(([name, value]) => ({ name, value }));

      // Calculate stats
      const totalDisbursed = disb.filter(d => d.status === 'completed').reduce((sum, d) => sum + Number(d.amount), 0);
      const avgLoanAmount = loans.length > 0
        ? loans.reduce((sum, l) => sum + Number(l.loan_amount), 0) / loans.length
        : 0;
      const approvalRate = loans.length > 0
        ? (loans.filter(l => ['approved', 'disbursed', 'active', 'completed'].includes(l.status)).length / loans.length) * 100
        : 0;

      return {
        monthlyData: months,
        collectionHistory,
        statusDistribution,
        employmentTypes,
        loanPurposes,
        stats: {
          totalApplications: loans.length,
          totalDisbursed,
          avgLoanAmount: Math.round(avgLoanAmount),
          approvalRate: Math.round(approvalRate),
          totalUsers: users.length,
          pendingReview: loans.filter(l => l.status === 'pending').length,
          parPercentage: Math.round(parPercentage * 10) / 10,
          totalInterestRevenue: Math.round(totalInterestRevenue),
          overdueAmount: Math.round(overdueAmount),
        },
      };
    },
  });

  const exportReport = () => {
    // Create CSV data
    const csvContent = [
      ['Month', 'Applications', 'Approved', 'Disbursed', 'Amount (K)'],
      ...(reportData?.monthlyData.map(m => [m.month, m.applications, m.approved, m.disbursed, m.amount]) || [])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive insights into lending operations
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <Calendar size={14} className="mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="12months">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {staffList.map((s: { id: string; full_name: string | null }) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name || s.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {loanProducts.map((p: { id: string; name: string }) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="disbursed">Disbursed</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="defaulted">Defaulted</SelectItem>
              </SelectContent>
            </Select>
            {can("reports", "export") && (
              <Button variant="outline" onClick={exportReport}>
                <Download size={16} className="mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-gradient-to-br from-primary/10 via-card to-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Portfolio At Risk (PAR)</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {reportData?.stats.parPercentage || 0}%
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${(reportData?.stats.parPercentage || 0) > 10 ? 'text-destructive' : 'text-success'}`}>
                    <Activity size={14} />
                    <span>{reportData?.stats.parPercentage || 0 > 10 ? 'Needs Attention' : 'Healthy Range'}</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-destructive to-red-600 flex items-center justify-center">
                  <AlertTriangle className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-gradient-to-br from-success/10 via-card to-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Disbursed</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    K{(reportData?.stats.totalDisbursed || 0).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-sm text-success">
                    <ArrowUpRight size={14} />
                    <span>Total Cash Out</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success to-emerald-600 flex items-center justify-center">
                  <Wallet className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-gradient-to-br from-info/10 via-card to-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Revenue (Interest)</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    K{(reportData?.stats.totalInterestRevenue || 0).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-sm text-info">
                    <TrendingUp size={14} />
                    <span>Projected Yield</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-info to-blue-600 flex items-center justify-center">
                  <Banknote className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-gradient-to-br from-purple-500/10 via-card to-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Overdue Amount</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    K{(reportData?.stats.overdueAmount || 0).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-sm text-destructive">
                    <Clock size={14} />
                    <span>Awaiting Collection</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <Activity className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Applications Trend */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 size={20} />
                Applications Trend
              </CardTitle>
              <CardDescription>Monthly application volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reportData?.monthlyData || []}>
                    <defs>
                      <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="applications"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorApps)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon size={20} />
                Application Status
              </CardTitle>
              <CardDescription>Distribution by current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center">
                {reportData?.statusDistribution && reportData.statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportData.statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {reportData.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground">No data available</p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {reportData?.statusDistribution.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.name}: {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Collection Performance */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} />
                Collection vs Target
              </CardTitle>
              <CardDescription>Scheduled repayments vs actual collections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportData?.collectionHistory || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" name="Scheduled" />
                    <Line type="monotone" dataKey="collected" stroke="hsl(var(--success))" strokeWidth={3} name="Collected" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Disbursement Trends */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet size={20} />
                Disbursement Trend
              </CardTitle>
              <CardDescription>Monthly capital outflow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData?.monthlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`K${value.toLocaleString()}`, 'Amount']}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Summary */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
            <CardDescription>Key metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                    <CheckCircle className="text-success" size={20} />
                  </div>
                  <span className="text-muted-foreground text-sm">Approval Rate</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{reportData?.stats.approvalRate || 0}%</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                    <Clock className="text-warning" size={20} />
                  </div>
                  <span className="text-muted-foreground text-sm">Pending Review</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{reportData?.stats.pendingReview || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
                    <Users className="text-info" size={20} />
                  </div>
                  <span className="text-muted-foreground text-sm">Total Users</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{reportData?.stats.totalUsers || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <TrendingUp className="text-primary" size={20} />
                  </div>
                  <span className="text-muted-foreground text-sm">Growth Rate</span>
                </div>
                <p className="text-2xl font-bold text-foreground">+15%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;