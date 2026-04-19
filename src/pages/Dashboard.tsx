import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateAccountStatement } from "@/utils/generateStatement";
import { downloadLoanSchedule } from "@/utils/generateLoanSchedule";
import { toast } from "sonner";
import {
  Banknote,
  Loader2,
  Eye,
  Home,
  CreditCard,
  Receipt,
  User,
  PlusCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

import BorrowerHomeTab from "@/components/dashboard/BorrowerHomeTab";
import BorrowerKycSheet from "@/components/dashboard/BorrowerKycSheet";
import BorrowerLoansTab from "@/components/dashboard/BorrowerLoansTab";
import BorrowerPaymentsTab from "@/components/dashboard/BorrowerPaymentsTab";
import BorrowerProfileTab from "@/components/dashboard/BorrowerProfileTab";
import LoanApplicationForm from "@/components/dashboard/LoanApplicationForm";

import phinduLogo from "@/assets/phindu-logo-white.png";
import ThemeToggle from "@/components/common/ThemeToggle";
import NotificationCenter from "@/components/common/NotificationCenter";
import {
  fetchBorrowerPaymentClaims,
  submitPaymentClaim,
} from "@/services/repositories/workflowRepository";
import { borrowerIdentityKycSatisfiedFromVault } from "@/constants/borrowerKycDocs";
import {
  borrowerInterestPeriodLabel,
  borrowerSchedulePaymentColumnTitle,
  borrowerTermSummaryLabel,
} from "@/utils/repaymentFrequencyLabels";

import type { BorrowerTab } from "@/components/dashboard/BorrowerBottomNav";
export type { BorrowerTab };

const sidebarItems: { id: BorrowerTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Dashboard", icon: Home },
  { id: "loans", label: "My Loans", icon: CreditCard },
  { id: "apply", label: "Apply for Loan", icon: PlusCircle },
  { id: "payments", label: "Payments", icon: Receipt },
  { id: "profile", label: "My Profile", icon: User },
];

const Dashboard = () => {
  const { user, isLoading, isAdmin, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BorrowerTab>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [borrowerKycOpen, setBorrowerKycOpen] = useState(false);

  // Payment claim state
  const [submitPaymentRepayment, setSubmitPaymentRepayment] = useState<any>(null);
  const [claimAmount, setClaimAmount] = useState("");
  const [claimReference, setClaimReference] = useState("");
  const [claimReceiptFile, setClaimReceiptFile] = useState<File | null>(null);

  // Loan application form state
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applyProductId, setApplyProductId] = useState<string | undefined>();
  const [applyAmount, setApplyAmount] = useState<number | undefined>();
  const [applyTerm, setApplyTerm] = useState<number | undefined>();

  useEffect(() => {
    if (searchParams.get("apply") === "true") {
      setShowApplicationForm(true);
      setApplyProductId(searchParams.get("product") || undefined);
      setApplyAmount(searchParams.get("amount") ? Number(searchParams.get("amount")) : undefined);
      setApplyTerm(searchParams.get("term") ? Number(searchParams.get("term")) : undefined);
    }
    const tab = searchParams.get("tab") as BorrowerTab | null;
    if (tab && ["home", "loans", "apply", "payments", "profile"].includes(tab)) {
      setActiveTab(tab);
    }
    const kycTarget = searchParams.get("kyc");
    if (kycTarget && (kycTarget === "documents" || kycTarget === "workspace")) {
      setActiveTab("profile");
      setBorrowerKycOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading && !user) navigate('/auth');
    if (!isLoading && user && isStaff && !searchParams.has('view')) navigate('/admin');
  }, [user, isLoading, isStaff, navigate, searchParams]);

  // ─── Data Queries ────────────────────────────────────────────
  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ['user-loans', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('loan_applications')
        .select('*, loan_products(repayment_frequency, interest_period)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('loan-status-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_applications', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['user-loans', user.id] });
        queryClient.invalidateQueries({ queryKey: ['user-repayments', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const { data: repayments = [] } = useQuery({
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

  const { data: paymentClaims = [] } = useQuery({
    queryKey: ["user-payment-claims", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return fetchBorrowerPaymentClaims(user.id);
    },
    enabled: !!user?.id,
  });

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: kycVaultDocs = [] } = useQuery({
    queryKey: ["borrower-kyc-vault", user?.id, "dashboard-doc-status"],
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

  const { data: kycInfo } = useQuery({
    queryKey: ["borrower-kyc-info", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("borrower_kyc_info")
        .select(
          "is_verified, bank_name, bank_account_number, airtel_money_number, mtn_mobile_money_number, zamtel_kwacha_number",
        )
        .eq("borrower_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`borrower-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "borrower_document_vault", filter: `borrower_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["borrower-kyc-vault", user.id] });
          queryClient.invalidateQueries({ queryKey: ["borrower-kyc-statuses"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "borrower_kyc_info", filter: `borrower_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["borrower-kyc-info", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_claims", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-payment-claims", user.id] });
          queryClient.invalidateQueries({ queryKey: ["borrower-loan-events", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loan_events" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["borrower-loan-events", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const kycVerified = useMemo(() => {
    if (kycInfo?.is_verified === true) return true;
    return borrowerIdentityKycSatisfiedFromVault(kycVaultDocs);
  }, [kycVaultDocs, kycInfo]);

  const activeLoans = useMemo(() => loans.filter(l => ['active', 'disbursed'].includes(l.status)), [loans]);

  // ─── Actions ─────────────────────────────────────────────────
  const handleStartApplication = useCallback((productId?: string, amount?: number, term?: number) => {
    setApplyProductId(productId);
    setApplyAmount(amount);
    setApplyTerm(term);
    setShowApplicationForm(true);
  }, []);

  const handleCloseApplication = useCallback(() => {
    setShowApplicationForm(false);
    setApplyProductId(undefined);
    setApplyAmount(undefined);
    setApplyTerm(undefined);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("apply"); newParams.delete("product"); newParams.delete("amount"); newParams.delete("term");
    setSearchParams(newParams, { replace: true });
    queryClient.invalidateQueries({ queryKey: ['user-loans', user?.id] });
  }, [searchParams, setSearchParams, queryClient, user?.id]);

  const downloadStatement = useCallback(async (loan: any) => {
    setIsGenerating(loan.id);
    try {
      const loanRepayments = repayments.filter(r => r.loan_id === loan.id && r.status === 'paid');
      generateAccountStatement({ ...loan, repayments: loanRepayments });
    } catch (error) {
      const { handleError } = await import('@/utils/errorHandler');
      handleError(error, { component: 'Dashboard', action: 'generate_statement' });
    } finally {
      setIsGenerating(null);
    }
  }, [repayments]);

  const downloadSchedule = useCallback(async (loan: any) => {
    setIsGenerating(`schedule-${loan.id}`);
    try {
      const loanRepayments = repayments.filter(r => r.loan_id === loan.id);
      const product = loan.loan_products ?? {};
      const freqLoan = {
        term_unit: loan.term_unit,
        loan_term_months: loan.loan_term_months,
        repayment_frequency: product.repayment_frequency,
        interest_period: product.interest_period,
      };
      downloadLoanSchedule({
        borrowerName: loan.full_name,
        borrowerPhone: loan.phone || '',
        borrowerEmail: loan.email || '',
        loanReference: `LOAN-${loan.id.substring(0, 8).toUpperCase()}`,
        loanAmount: loan.loan_amount,
        interestRate: loan.interest_rate || 15,
        interestPeriod: borrowerInterestPeriodLabel(freqLoan),
        termMonths: loan.loan_term_months,
        monthlyPayment: loan.monthly_payment || 0,
        totalRepayment: loan.total_repayment || 0,
        disbursementDate: loan.created_at,
        firstRepaymentDate: loanRepayments[0]?.due_date || loan.created_at,
        termSummaryLabel: borrowerTermSummaryLabel(freqLoan),
        paymentColumnTitle: borrowerSchedulePaymentColumnTitle(freqLoan),
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
  }, [repayments]);

  const handleSubmitPayment = useCallback((rep: any) => {
    const remaining = Math.max(0, Number(rep.original_amount || rep.amount) - Number(rep.principal_paid || 0));
    setSubmitPaymentRepayment({ id: rep.id, loan_id: rep.loan_id, amount: remaining, due_date: rep.due_date, installment_number: rep.installment_number });
    setClaimAmount(String(remaining));
    setClaimReference("");
    setClaimReceiptFile(null);
  }, []);

  const submitPaymentClaimMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !submitPaymentRepayment) throw new Error("Missing data");
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

      await submitPaymentClaim(
        submitPaymentRepayment.id,
        {
          amount,
          reference: claimReference.trim(),
          receiptUrl,
        },
        {
          loanId: submitPaymentRepayment.loan_id,
          userId: user.id,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-repayments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["user-payment-claims", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["borrower-loan-events", user?.id] });
      toast.success("Payment reference submitted. Admin will verify it.");
      setSubmitPaymentRepayment(null);
      setClaimAmount(""); setClaimReference(""); setClaimReceiptFile(null);
    },
    onError: (e) => toast.error((e as Error).message || "Failed to submit"),
  });

  const { data: borrowerLoanEvents = [] } = useQuery({
    queryKey: ["borrower-loan-events", user?.id, loans.map((l) => l.id).join(",")],
    queryFn: async () => {
      if (!loans.length) return [];
      const { fetchBorrowerLoanEvents } = await import("@/services/repositories/workflowRepository");
      const byLoan = await Promise.all(loans.slice(0, 12).map((loan) => fetchBorrowerLoanEvents(loan.id)));
      return byLoan.flat();
    },
    enabled: !!user?.id && loans.length > 0,
  });

  const handleTabChange = useCallback((tab: BorrowerTab) => {
    setMobileSidebarOpen(false);
    if (tab === "apply") {
      handleStartApplication();
    } else {
      setActiveTab(tab);
      setShowApplicationForm(false);
    }
  }, [handleStartApplication]);

  const openBorrowerKycDocuments = useCallback(() => {
    const v = searchParams.get("view");
    if (v) {
      const qs = new URLSearchParams();
      qs.set("tab", "documents");
      qs.set("view", v);
      navigate(`/profile?${qs.toString()}`);
      return;
    }
    const qs = new URLSearchParams(searchParams);
    qs.set("tab", "profile");
    qs.set("kyc", "workspace");
    setSearchParams(qs, { replace: true });
    setBorrowerKycOpen(true);
  }, [navigate, searchParams, setSearchParams]);

  const handleBorrowerKycOpenChange = useCallback((open: boolean) => {
    setBorrowerKycOpen(open);
    if (!open) {
      const qs = new URLSearchParams(searchParams);
      qs.delete("kyc");
      setSearchParams(qs, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const tabTitle: Record<string, string> = {
    home: "Dashboard",
    loans: "My Loans",
    apply: "Apply for Loan",
    payments: "Payments",
    profile: "My Profile",
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <BorrowerKycSheet userId={user.id} open={borrowerKycOpen} onOpenChange={handleBorrowerKycOpenChange} />
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card/80 backdrop-blur-lg transition-all duration-300 sticky top-0 h-screen z-40",
          sidebarCollapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border shrink-0">
          <img src={phinduLogo} alt="Phindu" className={cn("transition-all", sidebarCollapsed ? "h-7" : "h-8")} />
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {sidebarItems.map((item) => {
            const isActive = showApplicationForm ? item.id === "apply" : activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={20} className="shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border p-2 space-y-1">
          <button
            onClick={async () => { await signOut(); navigate('/auth'); }}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title={sidebarCollapsed ? "Sign Out" : undefined}
          >
            <LogOut size={20} className="shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-all"
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} className="shrink-0" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* ── Main Area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-lg">
          <div className="flex h-16 items-center justify-between gap-2 px-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 hover:bg-muted/50 md:hidden"
                aria-label="Open menu"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
                  {showApplicationForm ? "Apply for Loan" : tabTitle[activeTab]}
                </h1>
                <p className="truncate text-xs text-muted-foreground" data-testid="borrower-dashboard-welcome">
                  Welcome back, {profile?.full_name || "Customer"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <ThemeToggle variant="minimal" />
              <NotificationCenter />
              {isStaff && (
                <Button size="sm" variant="outline" className="h-9 shrink-0 px-2 text-xs sm:px-3" asChild>
                  <Link to="/admin" className="inline-flex items-center gap-1 sm:gap-1.5">
                    <Eye size={14} className="shrink-0" />
                    <span className="hidden sm:inline">Admin Panel</span>
                    <span className="sm:hidden">Admin</span>
                  </Link>
                </Button>
              )}
              <div className="ml-1 hidden items-center gap-2 border-l border-border pl-2 sm:flex">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary text-sm font-semibold text-primary-foreground">
                  {(profile?.full_name || "U").charAt(0).toUpperCase()}
                </div>
                <span className="hidden max-w-[8rem] truncate text-sm font-medium text-foreground lg:inline">
                  {profile?.full_name || "User"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
          <div className="flex h-14 items-center justify-around px-1">
            {sidebarItems.map((item) => {
              const isActive = showApplicationForm ? item.id === "apply" : activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                  <span className="text-[10px] font-medium">{item.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 md:pb-6">
          <div className="mx-auto max-w-6xl">
            {showApplicationForm ? (
              <LoanApplicationForm
                initialProductId={applyProductId}
                initialAmount={applyAmount}
                initialTerm={applyTerm}
                onClose={handleCloseApplication}
              />
            ) : (
              <>
                {activeTab === "home" && (
                  <BorrowerHomeTab
                    user={user}
                    profile={profile}
                    kycInfo={kycInfo}
                    loans={loans}
                    repayments={repayments}
                    activeLoans={activeLoans}
                    kycVerified={kycVerified}
                    isStaff={isStaff}
                    onTabChange={handleTabChange}
                    onOpenKycDocuments={openBorrowerKycDocuments}
                  />
                )}
                {activeTab === "loans" && (
                  <BorrowerLoansTab
                    userId={user.id}
                    loans={loans}
                    repayments={repayments}
                    loanEvents={borrowerLoanEvents}
                    onDownloadStatement={downloadStatement}
                    onDownloadSchedule={downloadSchedule}
                    onSubmitPayment={handleSubmitPayment}
                    isGenerating={isGenerating}
                    onApply={() => handleStartApplication()}
                  />
                )}
                {activeTab === "payments" && (
                  <BorrowerPaymentsTab
                    repayments={repayments}
                    loans={loans}
                    paymentClaims={paymentClaims}
                    onSubmitPayment={handleSubmitPayment}
                  />
                )}
                {activeTab === "profile" && (
                  <BorrowerProfileTab
                    user={user}
                    profile={profile}
                    kycVerified={kycVerified}
                    onOpenKycWorkspace={openBorrowerKycDocuments}
                    onSignOut={async () => { await signOut(); navigate('/auth'); }}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Payment Claim Dialog */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="flex w-[min(100vw-1rem,20rem)] flex-col gap-0 p-0 sm:max-w-xs">
          <SheetHeader className="space-y-0 border-b border-border px-4 py-4 text-left">
            <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
            <img src={phinduLogo} alt="Phindu" className="h-9 w-auto object-contain" />
          </SheetHeader>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Dashboard sections">
            {sidebarItems.map((item) => {
              const isActive = showApplicationForm ? item.id === "apply" : activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "border border-primary/20 bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <item.icon size={20} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <Dialog open={!!submitPaymentRepayment} onOpenChange={(open) => { if (!open) { setSubmitPaymentRepayment(null); setClaimAmount(""); setClaimReference(""); setClaimReceiptFile(null); } }}>
        <DialogContent className="sm:max-w-md" data-testid="borrower-payment-claim-dialog">
          <DialogHeader>
            <DialogTitle>Submit Payment Claim</DialogTitle>
            <DialogDescription>
              Enter the amount paid and transaction reference. Admin will verify it.
            </DialogDescription>
          </DialogHeader>
          {submitPaymentRepayment && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="claim-amount">Amount (K)</Label>
                <Input id="claim-amount" type="number" min="0" step="0.01" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="claim-reference">Transaction Reference *</Label>
                <Input id="claim-reference" value={claimReference} onChange={(e) => setClaimReference(e.target.value)} placeholder="e.g. MM123456789" />
              </div>
              <div className="space-y-1.5">
                <Label>Receipt (optional)</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => setClaimReceiptFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSubmitPaymentRepayment(null); setClaimAmount(""); setClaimReference(""); setClaimReceiptFile(null); }}>Cancel</Button>
            <Button
              data-testid="borrower-payment-claim-submit"
              onClick={() => submitPaymentClaimMutation.mutate()}
              disabled={submitPaymentClaimMutation.isPending || !claimReference.trim() || !claimAmount}
            >
              {submitPaymentClaimMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} className="mr-1.5" />}
              Submit Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
