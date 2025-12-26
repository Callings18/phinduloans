import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import GuidedTour from "@/components/common/GuidedTour";
import { Step } from "react-joyride";
import {
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  FileText,
  Plus,
  ArrowRight,
  Wallet,
  Calendar,
  Loader2,
  Download
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateAccountStatement } from "@/utils/generateStatement";

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  under_review: { label: "Under Review", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: FileText },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertCircle },
  disbursed: { label: "Disbursed", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: CreditCard },
  active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: TrendingUp },
  completed: { label: "Completed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: CheckCircle },
  defaulted: { label: "Defaulted", color: "bg-red-600/20 text-red-500 border-red-600/30", icon: AlertCircle },
};

const Dashboard = () => {
  const { user, isLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  const tourSteps: Step[] = [
    {
      target: ".tour-welcome",
      content: "Welcome to your Phindu dashboard! Here you can manage your loans and track your financial progress at a glance.",
      placement: "bottom",
    },
    {
      target: ".tour-stats",
      content: "Quickly view your active loans, total amount borrowed, and see how many applications are currently under review.",
      placement: "bottom",
    },
    {
      target: ".tour-apply",
      content: "Need quick funds? Use this section to start a new loan application. The process is fast and fully transparent.",
      placement: "top",
    },
    {
      target: ".tour-applications",
      content: "Track the real-time status of all your applications here. You can also download account statements for disbursed loans.",
      placement: "top",
    },
  ];

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
    if (!isLoading && user && isAdmin) {
      navigate('/admin');
    }
  }, [user, isLoading, isAdmin, navigate]);

  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['user-loans', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('loan_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const downloadStatement = async (loan: any) => {
    setIsGenerating(loan.id);
    try {
      const { data: repayments, error } = await supabase
        .from('loan_repayments')
        .select('*')
        .eq('loan_id', loan.id)
        .eq('status', 'paid')
        .order('paid_date', { ascending: true });

      if (error) throw error;

      generateAccountStatement({
        ...loan,
        repayments: repayments || []
      });
    } catch (error) {
      console.error("Failed to generate statement", error);
    } finally {
      setIsGenerating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeLoans = loans?.filter(l => ['active', 'disbursed'].includes(l.status)) || [];
  const totalBorrowed = activeLoans.reduce((sum, l) => sum + Number(l.loan_amount), 0);
  const pendingApps = loans?.filter(l => ['pending', 'under_review'].includes(l.status)) || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <GuidedTour steps={tourSteps} tourKey="borrower-dashboard" />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8 tour-welcome">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Welcome back, <span className="text-gradient">{profile?.full_name || 'User'}</span>
            </h1>
            <p className="text-muted-foreground">Manage your loans and track your repayments</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 tour-stats">
            <Card className="glass border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Active Loans</p>
                    <p className="text-3xl font-bold text-foreground">{activeLoans.length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                    <CreditCard className="text-primary-foreground" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Total Borrowed</p>
                    <p className="text-3xl font-bold text-foreground">K{totalBorrowed.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Wallet className="text-emerald-400" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Pending Applications</p>
                    <p className="text-3xl font-bold text-foreground">{pendingApps.length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <Clock className="text-yellow-400" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="mb-8 tour-apply">
            <Card className="glass border-border/50 overflow-hidden">
              <div className="gradient-primary p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-primary-foreground mb-1">Need Funds?</h3>
                    <p className="text-primary-foreground/80 text-sm">Apply for a new loan in minutes</p>
                  </div>
                  <Button variant="secondary" asChild className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                    <Link to="/apply" className="flex items-center gap-2">
                      <Plus size={18} />
                      Apply Now
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Applications */}
          <div className="tour-applications">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Your Loan Applications</h2>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                View All <ArrowRight size={16} className="ml-1" />
              </Button>
            </div>

            {loansLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : loans && loans.length > 0 ? (
              <div className="space-y-4">
                {loans.slice(0, 5).map((loan) => {
                  const config = statusConfig[loan.status as keyof typeof statusConfig];
                  const StatusIcon = config?.icon || Clock;

                  return (
                    <Card key={loan.id} className="glass border-border/50 hover:border-primary/30 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                              <StatusIcon className="text-primary" size={24} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">K{Number(loan.loan_amount).toLocaleString()}</h4>
                              <p className="text-muted-foreground text-sm">{loan.loan_purpose} • {loan.loan_term_months} months</p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <Calendar size={12} />
                                {new Date(loan.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={`${config?.color} border`}>
                              {config?.label}
                            </Badge>
                            {['active', 'disbursed', 'completed'].includes(loan.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadStatement(loan)}
                                disabled={isGenerating === loan.id}
                              >
                                {isGenerating === loan.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Download size={16} className="mr-1" />
                                )}
                                Statement
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="glass border-border/50">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                    <FileText className="text-muted-foreground" size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Applications Yet</h3>
                  <p className="text-muted-foreground mb-6">Start your financial journey by applying for a loan</p>
                  <Button variant="hero" asChild>
                    <Link to="/apply">Apply for a Loan</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
