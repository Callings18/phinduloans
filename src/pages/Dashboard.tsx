import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import GuidedTour from "@/components/common/GuidedTour";
import { ApplicationStatusTracker } from "@/components/dashboard/ApplicationStatusTracker";
import PaymentReminder from "@/components/dashboard/PaymentReminder";
import QuickApply from "@/components/dashboard/QuickApply";
import WalletWidget from "@/components/dashboard/WalletWidget";
import ContractSigningWidget from "@/components/dashboard/ContractSigningWidget";
import DocumentChecklist from "@/components/dashboard/DocumentChecklist";
import KYCStatusWidget from "@/components/dashboard/KYCStatusWidget";
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
  Download,
  HelpCircle,
  Receipt,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
  Activity,
  User,
  LogOut,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateAccountStatement } from "@/utils/generateStatement";
import { downloadLoanSchedule } from "@/utils/generateLoanSchedule";
import { format, isAfter, differenceInDays } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Upload } from "lucide-react";

const statusConfig = {
  pending: { label: "Submitted", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  under_review: { label: "Under Review", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: FileText },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  contract_signing: { label: "Contract Signing", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: FileText },
  awaiting_disbursement: { label: "Awaiting Disbursement", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", icon: Banknote },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertCircle },
  disbursed: { label: "Disbursed", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: CreditCard },
  active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: TrendingUp },
  completed: { label: "Completed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: CheckCircle },
  defaulted: { label: "Defaulted", color: "bg-red-600/20 text-red-500 border-red-600/30", icon: AlertCircle },
};

const Dashboard = () => {
  const { user, isLoading, isAdmin, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [runTour, setRunTour] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [submitPaymentRepayment, setSubmitPaymentRepayment] = useState<{ id: string; loan_id: string; amount: number; due_date: string; installment_number?: number } | null>(null);
  const [claimAmount, setClaimAmount] = useState("");
  const [claimReference, setClaimReference] = useState("");
  const [claimReceiptFile, setClaimReceiptFile] = useState<File | null>(null);

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
      content: "Track the real-time status of all your applications here. Expand any loan to see your repayment schedule.",
      placement: "top",
    },
  ];

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
    if (!isLoading && user && isStaff) {
      navigate('/admin');
    }
  }, [user, isLoading, isStaff, navigate]);

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

  // Real-time subscription for loan status changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('loan-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loan_applications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[Dashboard] Real-time update received:', payload);
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['user-loans', user.id] });
          queryClient.invalidateQueries({ queryKey: ['user-repayments', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const { data: repayments } = useQuery({
    queryKey: ['user-repayments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('loan_repayments')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });

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

  // Check if KYC documents are all verified
  const { data: kycVaultDocs = [] } = useQuery({
    queryKey: ["borrower-kyc-vault-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("borrower_document_vault")
        .select("doc_type, is_verified")
        .eq("borrower_id", user.id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Also check borrower_kyc_info for admin-level KYC approval
  const { data: kycInfo } = useQuery({
    queryKey: ["borrower-kyc-info-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("borrower_kyc_info")
        .select("is_verified")
        .eq("borrower_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const kycVerified = useMemo(() => {
    // If admin has approved KYC via borrower_kyc_info, consider it verified
    if (kycInfo?.is_verified === true) return true;

    // Otherwise check individual document verification in vault
    const KYC_TYPES = ["nrc_front", "nrc_back", "selfie", "proof_of_residence"];
    const docsByType: Record<string, boolean> = {};
    kycVaultDocs.forEach((d) => {
      if (!docsByType.hasOwnProperty(d.doc_type)) docsByType[d.doc_type] = !!d.is_verified;
    });
    return KYC_TYPES.every((t) => docsByType[t] === true);
  }, [kycVaultDocs, kycInfo]);

  const submitPaymentClaimMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !submitPaymentRepayment) throw new Error("Missing user or repayment");
      const amount = parseFloat(claimAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Enter a valid amount");
      if (!claimReference.trim()) throw new Error("Enter transaction reference");

      let receiptUrl: string | null = null;
      if (claimReceiptFile) {
        const ext = claimReceiptFile.name.split(".").pop() || "bin";
        const path = `payment-receipts/${user.id}/claim_${submitPaymentRepayment.id}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("loan-documents")
          .upload(path, claimReceiptFile, { contentType: claimReceiptFile.type, upsert: true });
        if (uploadError) throw uploadError;
        receiptUrl = path;
      }

      const { error } = await (supabase.from as any)("payment_claims").insert({
        loan_id: submitPaymentRepayment.loan_id,
        repayment_id: submitPaymentRepayment.id,
        user_id: user.id,
        amount,
        reference: claimReference.trim(),
        receipt_url: receiptUrl,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-repayments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["payment-claims", user?.id] });
      toast.success("Payment reference submitted. Admin will verify and record it.");
      setSubmitPaymentRepayment(null);
      setClaimAmount("");
      setClaimReference("");
      setClaimReceiptFile(null);
    },
    onError: (e) => toast.error((e as Error).message || "Failed to submit"),
  });

  const downloadStatement = async (loan: any) => {
    setIsGenerating(loan.id);
    try {
      const loanRepayments = repayments?.filter(r => r.loan_id === loan.id && r.status === 'paid') || [];
      generateAccountStatement({
        ...loan,
        repayments: loanRepayments
      });
    } catch (error) {
      const { handleError } = await import('@/utils/errorHandler');
      handleError(error, { component: 'Dashboard', action: 'generate_statement' });
    } finally {
      setIsGenerating(null);
    }
  };

  const downloadSchedule = async (loan: any) => {
    setIsGenerating(`schedule-${loan.id}`);
    try {
      const loanRepayments = repayments?.filter(r => r.loan_id === loan.id) || [];
      downloadLoanSchedule({
        borrowerName: loan.full_name,
        borrowerPhone: loan.phone || '',
        borrowerEmail: loan.email || '',
        loanReference: `LOAN-${loan.id.substring(0, 8).toUpperCase()}`,
        loanAmount: loan.loan_amount,
        interestRate: loan.interest_rate || 15,
        interestPeriod: 'monthly',
        termMonths: loan.loan_term_months,
        monthlyPayment: loan.monthly_payment || 0,
        totalRepayment: loan.total_repayment || 0,
        disbursementDate: loan.created_at,
        firstRepaymentDate: loanRepayments[0]?.due_date || loan.created_at,
        repayments: loanRepayments.map((r: any) => ({
          installmentNumber: r.installment_number || 1,
          dueDate: r.due_date,
          amount: Number(r.amount),
          status: r.status,
          paidDate: r.paid_date || undefined,
        })),
      });
    } catch (error) {
      const { handleError } = await import('@/utils/errorHandler');
      handleError(error, { component: 'Dashboard', action: 'generate_schedule' });
    } finally {
      setIsGenerating(null);
    }
  };

  const getLoanProgress = (loanId: string) => {
    const loanRepayments = repayments?.filter(r => r.loan_id === loanId) || [];
    const paid = loanRepayments.filter(r => r.status === 'paid').length;
    const total = loanRepayments.length;
    return total > 0 ? (paid / total) * 100 : 0;
  };

  const getRepaymentStatus = (repayment: any) => {
    const today = new Date();
    const dueDate = new Date(repayment.due_date);
    const isOverdue = repayment.status === 'pending' && isAfter(today, dueDate);
    const daysOverdue = isOverdue ? differenceInDays(today, dueDate) : 0;

    if (repayment.status === 'paid') {
      return { label: 'Paid', color: 'bg-success/20 text-success border-success/30', icon: CheckCircle };
    }
    if (isOverdue) {
      return { label: `${daysOverdue}d overdue`, color: 'bg-destructive/20 text-destructive border-destructive/30', icon: AlertTriangle };
    }
    return { label: 'Pending', color: 'bg-warning/20 text-warning border-warning/30', icon: Clock };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeLoans = loans?.filter(l => ['active', 'disbursed'].includes(l.status)) || [];
  const completedLoans = loans?.filter(l => l.status === 'completed') || [];
  const totalBorrowed = activeLoans.reduce((sum, l) => sum + Number(l.loan_amount), 0);
  const pendingApps = loans?.filter(l => ['pending', 'under_review'].includes(l.status)) || [];

  // Calculate upcoming payment
  const upcomingRepayments = repayments?.filter(r => r.status === 'pending' && new Date(r.due_date) >= new Date()) || [];
  const nextPayment = upcomingRepayments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  // Calculate overdue amount
  const overdueRepayments = repayments?.filter(r => r.status === 'pending' && isAfter(new Date(), new Date(r.due_date))) || [];
  const totalOverdue = overdueRepayments.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GuidedTour
        steps={tourSteps}
        tourKey="borrower-dashboard"
        externalRun={runTour}
        onFinish={() => setRunTour(false)}
      />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8 tour-welcome flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Welcome back, <span className="text-gradient">{profile?.full_name || 'User'}</span>
              </h1>
              <p className="text-muted-foreground">Manage your loans and track your repayments</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="glass border-border/50"
                asChild
              >
                <Link to="/profile">
                  <User size={18} className="mr-2 text-primary" />
                  My Profile
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="glass border-border/50"
                onClick={() => setRunTour(true)}
              >
                <HelpCircle size={18} className="mr-2 text-primary" />
                How it works
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="glass border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={async () => { await signOut(); navigate('/auth'); }}
              >
                <LogOut size={18} className="mr-2" />
                Log Out
              </Button>
            </div>
          </div>

          {/* Payment Reminders */}
          {repayments && repayments.length > 0 && (
            <PaymentReminder repayments={repayments} className="mb-8" />
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 tour-stats">
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
                    <p className="text-muted-foreground text-sm">Next Payment</p>
                    {nextPayment ? (
                      <>
                        <p className="text-2xl font-bold text-foreground">K{Number(nextPayment.amount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(nextPayment.due_date), 'MMM dd, yyyy')}</p>
                      </>
                    ) : (
                      <p className="text-lg font-medium text-muted-foreground">No upcoming</p>
                    )}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Calendar className="text-blue-400" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`glass border-border/50 ${totalOverdue > 0 ? 'border-destructive/50' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Overdue Amount</p>
                    <p className={`text-3xl font-bold ${totalOverdue > 0 ? 'text-destructive' : 'text-foreground'}`}>
                      K{totalOverdue.toLocaleString()}
                    </p>
                    {totalOverdue > 0 && (
                      <p className="text-xs text-destructive">{overdueRepayments.length} payment(s)</p>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${totalOverdue > 0 ? 'bg-destructive/20' : 'bg-gray-500/20'}`}>
                    <AlertTriangle className={totalOverdue > 0 ? 'text-destructive' : 'text-gray-400'} size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KYC Status Widget */}
          {user && (
            <div className="mb-6">
              <KYCStatusWidget userId={user.id} />
            </div>
          )}

          {/* Contract Signing Widget - Show if any contracts need signing */}
          {user && (
            <div className="mb-6">
              <ContractSigningWidget userId={user.id} />
            </div>
          )}

          {/* Quick Actions and Wallet - Use QuickApply for logged-in users */}
          <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="tour-apply">
              {user && profile && (
                <QuickApply
                  userId={user.id}
                  profile={profile}
                  kycVerified={kycVerified}
                  hasActiveLoan={activeLoans.length > 0}
                  onSuccess={() => queryClient.invalidateQueries({ queryKey: ['user-loans'] })}
                />
              )}
            </div>
            <div className="tour-wallet">
              {user && <WalletWidget />}
            </div>
          </div>

          {/* Loan Tabs */}
          <div className="tour-applications">
            <Tabs defaultValue="tracker" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="tracker" className="flex items-center gap-2">
                  <Activity size={16} />
                  Status Tracker
                </TabsTrigger>
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <TrendingUp size={16} />
                  Active ({activeLoans.length})
                </TabsTrigger>
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock size={16} />
                  Pending ({pendingApps.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  Completed ({completedLoans.length})
                </TabsTrigger>
              </TabsList>

              {/* Real-time Status Tracker Tab */}
              <TabsContent value="tracker" className="space-y-4">
                {user?.id && <ApplicationStatusTracker userId={user.id} />}
                
                {/* Document Checklist for Under Review loans */}
                {user?.id && loans?.filter(l => l.status === 'under_review').map(loan => (
                  <DocumentChecklist key={loan.id} loanId={loan.id} userId={user.id} />
                ))}
              </TabsContent>

              {/* Active Loans Tab */}
              <TabsContent value="active" className="space-y-4">
                {activeLoans.length === 0 ? (
                  <Card className="glass border-border/50">
                    <CardContent className="p-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                        <CreditCard className="text-muted-foreground" size={32} />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Active Loans</h3>
                      <p className="text-muted-foreground mb-6">You don't have any active loans at the moment</p>
                      <Button variant="hero" asChild>
                        <Link to="/apply">Apply for a Loan</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  activeLoans.map((loan) => {
                    const config = statusConfig[loan.status as keyof typeof statusConfig];
                    const StatusIcon = config?.icon || Clock;
                    const loanRepayments = repayments?.filter(r => r.loan_id === loan.id) || [];
                    const progress = getLoanProgress(loan.id);
                    const isExpanded = expandedLoan === loan.id;
                    const paidAmount = loanRepayments.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.amount), 0);
                    const remainingAmount = Number(loan.total_repayment || 0) - paidAmount;

                    return (
                      <Collapsible key={loan.id} open={isExpanded} onOpenChange={() => setExpandedLoan(isExpanded ? null : loan.id)}>
                        <Card className="glass border-border/50">
                          <CardContent className="p-6">
                            <div className="flex flex-col gap-4">
                              {/* Loan Header */}
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                                    <StatusIcon className="text-primary" size={24} />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-foreground">K{Number(loan.loan_amount).toLocaleString()}</h4>
                                    <p className="text-muted-foreground text-sm">{loan.loan_purpose} • {loan.loan_term_months} months</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className={`${config?.color} border text-xs`}>
                                        {config?.label}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadSchedule(loan)}
                                    disabled={isGenerating === `schedule-${loan.id}`}
                                  >
                                    {isGenerating === `schedule-${loan.id}` ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <Receipt size={14} className="mr-1" />
                                    )}
                                    Schedule
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadStatement(loan)}
                                    disabled={isGenerating === loan.id}
                                  >
                                    {isGenerating === loan.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <Download size={14} className="mr-1" />
                                    )}
                                    Statement
                                  </Button>
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      {isExpanded ? 'Hide' : 'View'} Schedule
                                    </Button>
                                  </CollapsibleTrigger>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Repayment Progress</span>
                                  <span className="text-foreground font-medium">{Math.round(progress)}%</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Paid: K{paidAmount.toLocaleString()}</span>
                                  <span>Remaining: K{remainingAmount.toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Repayment Schedule */}
                              <CollapsibleContent>
                                <div className="mt-4 border-t border-border/50 pt-4">
                                  <h5 className="font-medium text-foreground mb-3">Repayment Schedule</h5>
                                  <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {loanRepayments.length === 0 ? (
                                      <p className="text-muted-foreground text-sm">No repayments scheduled yet</p>
                                    ) : (
                                      loanRepayments.map((rep) => {
                                        const status = getRepaymentStatus(rep);
                                        const StatusIcon = status.icon;
                                        return (
                                          <div key={rep.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-xs font-medium">
                                                #{rep.installment_number}
                                              </div>
                                              <div>
                                                <p className="font-medium text-foreground">K{Number(rep.amount).toLocaleString()}</p>
                                                <p className="text-xs text-muted-foreground">
                                                  Due: {format(new Date(rep.due_date), 'MMM dd, yyyy')}
                                                  {rep.paid_date && ` • Paid: ${format(new Date(rep.paid_date), 'MMM dd, yyyy')}`}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {rep.status === 'pending' && (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="text-xs"
                                                  onClick={() => {
                                                    setSubmitPaymentRepayment({ id: rep.id, loan_id: rep.loan_id, amount: rep.amount, due_date: rep.due_date, installment_number: rep.installment_number });
                                                    setClaimAmount(String(rep.amount));
                                                    setClaimReference("");
                                                    setClaimReceiptFile(null);
                                                  }}
                                                >
                                                  <Banknote size={12} className="mr-1" />
                                                  I've paid
                                                </Button>
                                              )}
                                              <Badge className={`${status.color} border text-xs`}>
                                                <StatusIcon size={10} className="mr-1" />
                                                {status.label}
                                              </Badge>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </CardContent>
                        </Card>
                      </Collapsible>
                    );
                  })
                )}
              </TabsContent>

              {/* Pending Tab */}
              <TabsContent value="pending" className="space-y-4">
                {pendingApps.length === 0 ? (
                  <Card className="glass border-border/50">
                    <CardContent className="p-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                        <Clock className="text-muted-foreground" size={32} />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Pending Applications</h3>
                      <p className="text-muted-foreground">All your applications have been processed</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingApps.map((loan) => {
                    const config = statusConfig[loan.status as keyof typeof statusConfig];
                    const StatusIcon = config?.icon || Clock;

                    return (
                      <Card key={loan.id} className="glass border-border/50">
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
                                  Applied: {format(new Date(loan.created_at), 'MMM dd, yyyy')}
                                </div>
                              </div>
                            </div>
                            <Badge className={`${config?.color} border`}>
                              {config?.label}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              {/* Completed Tab */}
              <TabsContent value="completed" className="space-y-4">
                {completedLoans.length === 0 ? (
                  <Card className="glass border-border/50">
                    <CardContent className="p-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                        <CheckCircle className="text-muted-foreground" size={32} />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Completed Loans</h3>
                      <p className="text-muted-foreground">Completed loans will appear here</p>
                    </CardContent>
                  </Card>
                ) : (
                  completedLoans.map((loan) => (
                    <Card key={loan.id} className="glass border-border/50">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                              <CheckCircle className="text-success" size={24} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">K{Number(loan.loan_amount).toLocaleString()}</h4>
                              <p className="text-muted-foreground text-sm">{loan.loan_purpose} • {loan.loan_term_months} months</p>
                              <p className="text-xs text-success mt-1">Successfully completed</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadStatement(loan)}
                            disabled={isGenerating === loan.id}
                          >
                            {isGenerating === loan.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} className="mr-1" />
                            )}
                            Statement
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          <Dialog open={!!submitPaymentRepayment} onOpenChange={(open) => { if (!open) { setSubmitPaymentRepayment(null); setClaimAmount(""); setClaimReference(""); setClaimReceiptFile(null); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Submit payment reference</DialogTitle>
                <DialogDescription>
                  Enter the amount you paid and the transaction reference (e.g. mobile money code). Optionally attach a receipt. Admin will verify and record the payment.
                </DialogDescription>
              </DialogHeader>
              {submitPaymentRepayment && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="claim-amount">Amount (K)</Label>
                    <Input id="claim-amount" type="number" min="0" step="0.01" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder="e.g. 50000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claim-reference">Transaction reference *</Label>
                    <Input id="claim-reference" value={claimReference} onChange={(e) => setClaimReference(e.target.value)} placeholder="e.g. MM123456789" />
                  </div>
                  <div className="space-y-2">
                    <Label>Receipt (optional)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="image/*,.pdf" onChange={(e) => setClaimReceiptFile(e.target.files?.[0] ?? null)} className="max-w-xs" />
                      {claimReceiptFile && <span className="text-xs text-muted-foreground truncate">{claimReceiptFile.name}</span>}
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setSubmitPaymentRepayment(null); setClaimAmount(""); setClaimReference(""); setClaimReceiptFile(null); }}>Cancel</Button>
                <Button onClick={() => submitPaymentClaimMutation.mutate()} disabled={submitPaymentClaimMutation.isPending || !claimReference.trim() || !claimAmount}>
                  {submitPaymentClaimMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} className="mr-1" />}
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>

      
    </div>
  );
};

export default Dashboard;
