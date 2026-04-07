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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateAccountStatement } from "@/utils/generateStatement";
import { downloadLoanSchedule } from "@/utils/generateLoanSchedule";
import { toast } from "sonner";
import { Banknote, Loader2, Eye } from "lucide-react";

import BorrowerBottomNav, { type BorrowerTab } from "@/components/dashboard/BorrowerBottomNav";
import BorrowerHomeTab from "@/components/dashboard/BorrowerHomeTab";
import BorrowerLoansTab from "@/components/dashboard/BorrowerLoansTab";
import BorrowerPaymentsTab from "@/components/dashboard/BorrowerPaymentsTab";
import BorrowerProfileTab from "@/components/dashboard/BorrowerProfileTab";
import QuickApply from "@/components/dashboard/QuickApply";
import LoanApplicationForm from "@/components/dashboard/LoanApplicationForm";

import phinduLogo from "@/assets/phindu-logo-white.png";
import ThemeToggle from "@/components/common/ThemeToggle";
import NotificationCenter from "@/components/common/NotificationCenter";

const Dashboard = () => {
  const { user, isLoading, isAdmin, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BorrowerTab>("home");

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

  // Check URL params for apply mode
  useEffect(() => {
    if (searchParams.get("apply") === "true") {
      setShowApplicationForm(true);
      setApplyProductId(searchParams.get("product") || undefined);
      setApplyAmount(searchParams.get("amount") ? Number(searchParams.get("amount")) : undefined);
      setApplyTerm(searchParams.get("term") ? Number(searchParams.get("term")) : undefined);
    }
    // If navigating to a specific tab
    const tab = searchParams.get("tab") as BorrowerTab | null;
    if (tab && ["home", "loans", "apply", "payments", "profile"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
    if (!isLoading && user && isStaff && !searchParams.has('view')) {
      navigate('/admin');
    }
  }, [user, isLoading, isStaff, navigate, searchParams]);

  // ─── Data Queries ────────────────────────────────────────────
  const { data: loans = [], isLoading: loansLoading } = useQuery({
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
      const { data, error } = await supabase
        .from("payment_claims")
        .select("id, repayment_id, amount, reference, status, created_at, verified_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
    if (kycInfo?.is_verified === true) return true;
    const KYC_TYPES = ["nrc_front", "nrc_back", "selfie"];
    const docsByType: Record<string, boolean> = {};
    kycVaultDocs.forEach((d) => {
      if (!docsByType.hasOwnProperty(d.doc_type)) docsByType[d.doc_type] = !!d.is_verified;
    });
    return KYC_TYPES.every((t) => docsByType[t] === true);
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
      const { data: existingClaims, error: existingError } = await supabase
        .from("payment_claims")
        .select("id")
        .eq("repayment_id", submitPaymentRepayment.id)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1);
      if (existingError) throw existingError;
      if (existingClaims?.length) {
        throw new Error("You already have a pending claim for this installment.");
      }

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

      const { error } = await supabase.from("payment_claims").insert({
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
      queryClient.invalidateQueries({ queryKey: ["user-payment-claims", user?.id] });
      toast.success("Payment reference submitted. Admin will verify it.");
      setSubmitPaymentRepayment(null);
      setClaimAmount(""); setClaimReference(""); setClaimReceiptFile(null);
    },
    onError: (e) => toast.error((e as Error).message || "Failed to submit"),
  });

  const handleTabChange = useCallback((tab: BorrowerTab) => {
    if (tab === "apply") {
      handleStartApplication();
    } else {
      setActiveTab(tab);
      setShowApplicationForm(false);
    }
  }, [handleStartApplication]);

  // ─── Loading / Auth Guard ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Compact top header — mobile-friendly */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          <img src={phinduLogo} alt="Phindu" className="h-8" />
          <div className="flex items-center gap-1">
            <ThemeToggle variant="minimal" />
            <NotificationCenter />
          </div>
        </div>

        {/* Admin preview banner */}
        {isStaff && (
          <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-primary/10 border-b border-primary/20">
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Eye size={12} />
              <span className="font-medium">Admin Preview</span>
            </div>
            <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" asChild>
              <Link to="/admin">← Back to Admin</Link>
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 max-w-lg mx-auto">
        {/* Application Form Overlay */}
        {showApplicationForm ? (
          <div>
            <LoanApplicationForm
              initialProductId={applyProductId}
              initialAmount={applyAmount}
              initialTerm={applyTerm}
              onClose={handleCloseApplication}
            />
          </div>
        ) : (
          <>
            {activeTab === "home" && (
              <BorrowerHomeTab
                user={user}
                profile={profile}
                loans={loans}
                repayments={repayments}
                activeLoans={activeLoans}
                kycVerified={kycVerified}
                isStaff={isStaff}
                onTabChange={handleTabChange}
              />
            )}

            {activeTab === "loans" && (
              <BorrowerLoansTab
                userId={user.id}
                loans={loans}
                repayments={repayments}
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
                onSignOut={async () => { await signOut(); navigate('/auth'); }}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      {!showApplicationForm && (
        <BorrowerBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          badgeCounts={{
            loans: activeLoans.length,
            payments: repayments.filter(r => ["pending", "overdue"].includes(r.status)).length,
          }}
        />
      )}

      {/* Payment Claim Dialog */}
      <Dialog open={!!submitPaymentRepayment} onOpenChange={(open) => { if (!open) { setSubmitPaymentRepayment(null); setClaimAmount(""); setClaimReference(""); setClaimReceiptFile(null); } }}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Submit Payment</DialogTitle>
            <DialogDescription className="text-xs">
              Enter the amount paid and transaction reference. Admin will verify it.
            </DialogDescription>
          </DialogHeader>
          {submitPaymentRepayment && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="claim-amount" className="text-xs">Amount (K)</Label>
                <Input id="claim-amount" type="number" min="0" step="0.01" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="claim-reference" className="text-xs">Transaction Reference *</Label>
                <Input id="claim-reference" value={claimReference} onChange={(e) => setClaimReference(e.target.value)} placeholder="e.g. MM123456789" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Receipt (optional)</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => setClaimReceiptFile(e.target.files?.[0] ?? null)} className="h-9 text-xs" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSubmitPaymentRepayment(null); setClaimAmount(""); setClaimReference(""); setClaimReceiptFile(null); }}>Cancel</Button>
            <Button size="sm" onClick={() => submitPaymentClaimMutation.mutate()} disabled={submitPaymentClaimMutation.isPending || !claimReference.trim() || !claimAmount}>
              {submitPaymentClaimMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} className="mr-1" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
