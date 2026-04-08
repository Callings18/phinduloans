import { useState, useEffect } from "react";
import { format, addMonths, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  RefreshCw,
  Undo2,
  CreditCard,
  Loader2,
  Plus,
  Banknote,
  TrendingUp,
  History,
  MessageSquare,
  Activity,
  Settings,
  Receipt,
  RotateCcw,
  Calculator,
  AlertCircle,
  ArrowRight,
  Shield,
  FolderCheck,
  XCircle as XCircleIcon,
  Download,
  Share2,
  Send,
  FileDown,
  Edit,
  Smartphone,
  Upload,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DocumentVerificationTab from "./DocumentVerificationTab";
import GuarantorTab from "./GuarantorTab";
import ApprovalWorkflowTab from "./ApprovalWorkflowTab";
import WriteOffTab from "./WriteOffTab";
import { downloadLoanSchedule } from "@/utils/generateLoanSchedule";
import { downloadLoanContract, shareContractViaWhatsApp, emailContract, smsContract, uploadContractAndSaveUrl } from "@/utils/generateLoanContract";
import { logAudit } from "@/utils/auditLog";
import { downloadRepaymentReceipt } from "@/utils/generateRepaymentReceipt";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { getCanonicalStatusLabel } from "@/constants/loanStatusLabels";
import { createRepaymentScheduleForLoan } from "@/utils/createRepaymentSchedule";
import { calculateLoan } from "@/utils/loanCalculations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import LoanHistoryTimeline from "./LoanHistoryTimeline";
import LoanChain from "./LoanChain";

/** Allowed next stages per current status (Move to). Same sections for all loans; only these buttons vary. */
const ALLOWED_NEXT_STATUSES: Record<string, string[]> = {
  pending: ["under_review", "rejected"],
  under_review: ["approved", "rejected", "crb_failed", "pmic_pending"],
  approved: ["contract_signing"],
  contract_signing: [],
  awaiting_disbursement: [],
  disbursed: ["active"],
  active: ["defaulted"], // "completed" is auto-set when fully paid
  completed: [],
  defaulted: [],
  rejected: [],
  crb_failed: [],
  pmic_pending: [],
};

interface Loan {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  nrc_number: string;
  address?: string | null;
  city?: string | null;
  loan_amount: number;
  loan_term_months: number;
  interest_rate: number;
  total_repayment: number;
  monthly_payment: number;
  status: string;
  created_at: string;
  loan_purpose: string;
  employment_type: string;
  monthly_income?: number;
  employer_name?: string | null;
  employer_id?: string | null;
  job_title?: string | null;
  date_of_birth?: string | null;
  employment_duration?: string | null;
  admin_notes?: string | null;
  total_penalties?: number;
  settlement_date?: string | null;
  settlement_type?: string | null;
  early_settlement_fee?: number;
  loan_product_id?: string | null;
  contract_url?: string | null;
  // Contract signing fields
  signed_contract_url?: string | null;
  signed_contract_uploaded_at?: string | null;
  borrower_signed?: boolean;
  borrower_signed_at?: string | null;
  admin_signed?: boolean;
  admin_signed_at?: string | null;
  // Approval workflow fields
  approval_stage?: string | null;
  document_verified_by?: string | null;
  document_verified_at?: string | null;
  finance_verified_by?: string | null;
  finance_verified_at?: string | null;
  recommended_by?: string | null;
  recommended_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  disbursed_by?: string | null;
  disbursed_at?: string | null;
}

interface Repayment {
  id: string;
  loan_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  installment_number: number | null;
  payment_method: string | null;
  transaction_reference: string | null;
  penalty_amount?: number;
  principal_paid?: number;
  interest_paid?: number;
  penalty_paid?: number;
  is_reversed?: boolean;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  original_amount?: number;
}

interface Props {
  loan: Loan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EarlySettlement {
  outstanding_principal: number;
  outstanding_interest: number;
  total_penalties: number;
  early_settlement_fee: number;
  total_payoff_amount: number;
}

export default function LoanDetailsModal({ loan, open, onOpenChange }: Props) {
  const { user, isAdmin } = useAuth();
  const { can } = usePermissions();
  const canApprove = can("loans", "approve");
  const canFinanceApprove = can("loans", "finance_approve");
  const [activeTab, setActiveTab] = useState("overview");
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedRepayment, setSelectedRepayment] = useState<Repayment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isRestructureOpen, setIsRestructureOpen] = useState(false);
  const [newTermMonths, setNewTermMonths] = useState("");
  const [newInterestRate, setNewInterestRate] = useState("");
  const [restructureReason, setRestructureReason] = useState("");
  const [isUndoDisbursementOpen, setIsUndoDisbursementOpen] = useState(false);
  const [isGenerateScheduleOpen, setIsGenerateScheduleOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState(loan?.admin_notes || "");
  const [isReloanOpen, setIsReloanOpen] = useState(false);
  const [reloanTopUpAmount, setReloanTopUpAmount] = useState("");
  const [reloanReason, setReloanReason] = useState("");
  const [reloanSourceAccountId, setReloanSourceAccountId] = useState("");
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpReason, setTopUpReason] = useState("");
  const [topUpSourceAccountId, setTopUpSourceAccountId] = useState("");

  // Disbursement from detail view
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [disburseSourceAccountId, setDisburseSourceAccountId] = useState("");
  const [disburseMethod, setDisburseMethod] = useState("bank_transfer");
  const [disburseTransactionRef, setDisburseTransactionRef] = useState("");

  // Phase 1 new states
  const [isReversalOpen, setIsReversalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [selectedPaidRepayment, setSelectedPaidRepayment] = useState<Repayment | null>(null);
  const [isEarlySettlementOpen, setIsEarlySettlementOpen] = useState(false);
  const [earlySettlement, setEarlySettlement] = useState<EarlySettlement | null>(null);
  const [isApplyPenaltiesOpen, setIsApplyPenaltiesOpen] = useState(false);
  const [isContractEditOpen, setIsContractEditOpen] = useState(false);
  const [contractNotes, setContractNotes] = useState("");
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  // Custom messaging state
  const [customMessage, setCustomMessage] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");

  const queryClient = useQueryClient();
  const { data: settings } = useSystemSettings();

  // Fetch loan product to determine payment frequency
  const { data: loanProduct } = useQuery({
    queryKey: ["loan-product", loan?.loan_product_id],
    queryFn: async () => {
      if (!loan?.loan_product_id) return null;
      const { data, error } = await supabase
        .from("loan_products")
        .select("name, term_unit, interest_period, repayment_frequency, interest_type")
        .eq("id", loan.loan_product_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!loan?.loan_product_id,
  });

  // Fetch accounts for top-up source selection
  const { data: fundingAccounts } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, account_type, balance, account_number")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && isAdmin,
  });


  const { data: repayments, isLoading: repaymentsLoading } = useQuery({
    queryKey: ["loan-repayments", loan?.id],
    queryFn: async () => {
      if (!loan) return [];
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("*")
        .eq("loan_id", loan.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Repayment[];
    },
    enabled: !!loan,
  });

  // Real-time subscription for repayments
  useEffect(() => {
    if (!loan?.id || !open) return;
    const channel = supabase
      .channel(`loan-repayments-rt-${loan.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loan_repayments', filter: `loan_id=eq.${loan.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan.id] });
          queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
          queryClient.invalidateQueries({ queryKey: ["admin-repayments"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loan?.id, open, queryClient]);

  // Determine payment frequency
  const termUnit = (loan as any)?.term_unit || loanProduct?.term_unit || 'months';
  const interestPeriod = loanProduct?.interest_period || 'monthly';
  const repaymentFrequency = loanProduct?.repayment_frequency || 'monthly';
  const isWeekly = termUnit === 'weeks' || (termUnit === 'months' && (interestPeriod === 'weekly' || repaymentFrequency === 'weekly'));
  const isDaily = termUnit === 'days' || (termUnit === 'months' && (interestPeriod === 'daily' || repaymentFrequency === 'daily'));

  // Fetch disbursement
  const { data: disbursement } = useQuery({
    queryKey: ["loan-disbursement", loan?.id],
    queryFn: async () => {
      if (!loan) return null;
      const { data, error } = await supabase
        .from("disbursements")
        .select("*")
        .eq("loan_id", loan.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!loan,
  });

  const isPreDisbursement = loan?.status === "awaiting_disbursement" || loan?.status === "approved" || loan?.status === "pending" || loan?.status === "under_review";
  const isDisbursed = loan?.status === "disbursed" || loan?.status === "active";
  const isFullySigned = !!(loan?.borrower_signed && loan?.admin_signed);
  const contractMessageNotSigned = isDisbursed
    ? "This loan was disbursed without a fully signed contract. Please upload the signed contract by both parties and verify signatures to ensure compliance. This loan cannot be marked as completed until the contract is fully signed."
    : "No disbursement until both parties have signed. The loan will not be active until the contract is fully signed.";

  // Fetch collection activities
  const { data: collectionActivities } = useQuery({
    queryKey: ["loan-collection-activities", loan?.id],
    queryFn: async () => {
      if (!loan) return [];
      const { data, error } = await supabase
        .from("collection_activities")
        .select("*")
        .eq("loan_id", loan.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!loan,
  });

  // Calculate penalty on the PRINCIPAL sum (loan_amount), not the installment amount
  const calculatePenalty = (repayment: Repayment, penaltyRate: number = 5): number => {
    if (repayment.status !== "pending") return 0;
    const daysOverdue = differenceInDays(new Date(), new Date(repayment.due_date));
    if (daysOverdue <= 0) return 0;
    const monthsOverdue = Math.ceil(daysOverdue / 30);
    // Penalty is calculated on the loan's principal amount, not the installment due
    const principalAmount = loan?.loan_amount || 0;
    return principalAmount * (penaltyRate / 100) * monthsOverdue;
  };

  // Enhanced record payment mutation with partial/overpayment support
  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRepayment || !loan) throw new Error("No repayment selected");

      const paidAmount = Number(paymentAmount) || selectedRepayment.amount;
      const savedOriginalAmount = selectedRepayment.original_amount || selectedRepayment.amount;

      // Only count UNPAID penalty portion (total penalty minus already-paid penalty)
      const totalPenalty = Number(selectedRepayment.penalty_amount || 0);
      const alreadyPaidPenalty = Number(selectedRepayment.penalty_paid || 0);
      const remainingPenalty = Math.max(0, totalPenalty - alreadyPaidPenalty);
      const dueAmount = selectedRepayment.amount + remainingPenalty;

      // Calculate allocation (remaining penalty first, then principal/interest)
      const penaltyPaid = Math.min(paidAmount, remainingPenalty);
      const remainingAfterPenalty = paidAmount - penaltyPaid;
      const principalPaid = remainingAfterPenalty;

      let newStatus = "pending";
      let adjustedAmount = selectedRepayment.amount;

      if (paidAmount >= dueAmount) {
        // Full payment or overpayment
        newStatus = "paid";
        adjustedAmount = Number(savedOriginalAmount); // restore original on full pay

        // Handle overpayment - apply to next pending installments
        if (paidAmount > dueAmount) {
          let excess = paidAmount - dueAmount;
          const pendingList = repayments?.filter(
            r => (r.status === "pending" || r.status === "overdue") && r.id !== selectedRepayment.id
          ) || [];

          for (const np of pendingList) {
            if (excess <= 0) break;
            const npAmount = Number(np.amount);
            const npOriginal = np.original_amount || np.amount;
            const applied = Math.min(excess, npAmount);

            if (applied >= npAmount) {
              const { error: npFullErr } = await supabase
                .from("loan_repayments")
                .update({
                  status: "paid",
                  paid_date: new Date().toISOString().split("T")[0],
                  payment_method: paymentMethod,
                  principal_paid: Number(npOriginal),
                  original_amount: npOriginal,
                  amount: Number(npOriginal),
                })
                .eq("id", np.id);
              if (npFullErr) throw npFullErr;
            } else {
              const { error: npPartErr } = await supabase
                .from("loan_repayments")
                .update({
                  amount: npAmount - applied,
                  original_amount: npOriginal,
                  principal_paid: (Number(np.principal_paid) || 0) + applied,
                })
                .eq("id", np.id);
              if (npPartErr) throw npPartErr;
            }
            excess -= applied;
          }
        }
      } else {
        // Partial payment - reduce amount owed
        adjustedAmount = selectedRepayment.amount - remainingAfterPenalty;
        newStatus = adjustedAmount > 0 ? "pending" : "paid";
        if (newStatus === "paid") adjustedAmount = Number(savedOriginalAmount);
      }

      const { error } = await supabase
        .from("loan_repayments")
        .update({
          status: newStatus,
          paid_date: newStatus === "paid" ? new Date().toISOString().split("T")[0] : null,
          payment_method: paymentMethod,
          transaction_reference: transactionRef || null,
          amount: adjustedAmount,
          principal_paid: (Number(selectedRepayment.principal_paid) || 0) + principalPaid,
          penalty_paid: alreadyPaidPenalty + penaltyPaid,
          original_amount: savedOriginalAmount,
        })
        .eq("id", selectedRepayment.id);

      if (error) throw error;

      // Check if all repayments are paid — auto-complete loan (no contract signing requirement)
      const { data: remainingUnpaid, error: remUnpaidErr } = await supabase
        .from("loan_repayments")
        .select("id")
        .eq("loan_id", loan.id)
        .in("status", ["pending", "overdue"]);
      if (remUnpaidErr) throw remUnpaidErr;

      if (remainingUnpaid && remainingUnpaid.length === 0) {
        const { error: loanCompleteErr } = await supabase
          .from("loan_applications")
          .update({ status: "completed" as any })
          .eq("id", loan.id);
        if (loanCompleteErr) throw loanCompleteErr;
        toast.success("🎉 All payments complete — loan marked as completed!");
      }

      return { paidAmount, isPartial: paidAmount < dueAmount, isOverpayment: paidAmount > dueAmount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-repayments"] });

      if (result.isPartial) {
        toast.success(`Partial payment of K${result.paidAmount.toLocaleString()} recorded. Remaining balance updated.`);
      } else if (result.isOverpayment) {
        toast.success(`Payment recorded. Excess amount applied to next installment.`);
      } else {
        toast.success("Payment recorded successfully");
      }

      setIsRecordPaymentOpen(false);
      setSelectedRepayment(null);
      setPaymentMethod("cash");
      setTransactionRef("");
      setPaymentAmount("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  // Payment reversal mutation
  const reversePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPaidRepayment || !loan) throw new Error("No repayment selected");

      const { error } = await supabase
        .from("loan_repayments")
        .update({
          status: "pending",
          paid_date: null,
          payment_method: null,
          transaction_reference: null,
          is_reversed: true,
          reversed_at: new Date().toISOString(),
          reversal_reason: reversalReason,
          principal_paid: 0,
          interest_paid: 0,
          penalty_paid: 0,
          amount: selectedPaidRepayment.original_amount || selectedPaidRepayment.amount,
        })
        .eq("id", selectedPaidRepayment.id);

      if (error) throw error;

      // If loan was completed, revert to active
      if (loan.status === "completed") {
        const { error: revLoanStatusErr } = await supabase
          .from("loan_applications")
          .update({ status: "active" })
          .eq("id", loan.id);
        if (revLoanStatusErr) throw revLoanStatusErr;
      }

      // Log the reversal
      const { error: revCollErr } = await supabase.from("collection_activities").insert({
        loan_id: loan.id,
        activity_type: "payment_reversal",
        notes: `Payment of K${selectedPaidRepayment.amount.toLocaleString()} reversed. Reason: ${reversalReason}`,
        outcome: "Payment reverted to pending",
      });
      if (revCollErr) throw revCollErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["loan-collection-activities", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Payment reversed successfully");
      setIsReversalOpen(false);
      setSelectedPaidRepayment(null);
      setReversalReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reverse payment");
    },
  });

  // Apply penalties mutation
  const applyPenaltiesMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");

      // Use the database function to apply penalties
      const { data, error } = await supabase.rpc("apply_loan_penalties", {
        p_loan_id: loan.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (totalPenalty) => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success(`Penalties applied: K${Number(totalPenalty).toLocaleString()}`);
      setIsApplyPenaltiesOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to apply penalties");
    },
  });

  // Early settlement calculation
  const calculateEarlySettlementMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");

      const { data, error } = await supabase.rpc("calculate_early_settlement", {
        p_loan_id: loan.id,
      });

      if (error) throw error;
      return data?.[0] as EarlySettlement;
    },
    onSuccess: (data) => {
      setEarlySettlement(data);
      setIsEarlySettlementOpen(true);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to calculate settlement");
    },
  });

  // Process early settlement
  const processEarlySettlementMutation = useMutation({
    mutationFn: async () => {
      if (!loan || !earlySettlement) throw new Error("No loan or settlement data");

      // Fetch pending AND overdue repayments to set principal_paid correctly
      const { data: pendingRepsForSettle } = await supabase
        .from("loan_repayments")
        .select("id, amount, original_amount")
        .eq("loan_id", loan.id)
        .in("status", ["pending", "overdue"]);

      // Mark each pending repayment as paid with correct principal_paid
      for (const pr of (pendingRepsForSettle || [])) {
        const origAmt = pr.original_amount || pr.amount;
        await supabase
          .from("loan_repayments")
          .update({
            status: "paid",
            paid_date: new Date().toISOString().split("T")[0],
            payment_method: "early_settlement",
            principal_paid: Number(origAmt),
            original_amount: origAmt,
            amount: Number(origAmt),
          })
          .eq("id", pr.id);
      }
      const repaymentError = null; // handled per-row above

      if (repaymentError) throw repaymentError;

      // Update loan with settlement info
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          status: "completed",
          settlement_date: new Date().toISOString().split("T")[0],
          settlement_type: "early",
          early_settlement_fee: earlySettlement.early_settlement_fee,
          admin_notes: `${loan.admin_notes || ""}\n\n[EARLY SETTLEMENT ${format(new Date(), "yyyy-MM-dd")}]: Loan settled early. Payoff amount: K${earlySettlement.total_payoff_amount.toLocaleString()}`,
        })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      // Log the settlement
      await supabase.from("collection_activities").insert({
        loan_id: loan.id,
        activity_type: "early_settlement",
        notes: `Early settlement processed. Total payoff: K${earlySettlement.total_payoff_amount.toLocaleString()}`,
        outcome: "Loan closed",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["loan-collection-activities", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Early settlement processed - loan closed");
      setIsEarlySettlementOpen(false);
      setEarlySettlement(null);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process settlement");
    },
  });

  // Generate repayment schedule mutation (uses shared createRepaymentScheduleForLoan)
  const generateScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");
      await createRepaymentScheduleForLoan(
        {
          id: loan.id,
          user_id: loan.user_id,
          loan_term_months: loan.loan_term_months,
          total_repayment: loan.total_repayment,
          monthly_payment: loan.monthly_payment,
          loan_product_id: loan.loan_product_id,
          term_unit: (loan as any).term_unit,
        },
        supabase
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Repayment schedule generated successfully");
      setIsGenerateScheduleOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate schedule");
    },
  });

  // Disburse loan from detail view mutation
  const disburseLoanFromDetailMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");
      if (!disburseSourceAccountId) throw new Error("Select a source account");

      // Fetch product fees
      let processingFeePercent = 0, insurancePercent = 0, enforcementPercent = 0, vatPercent = 0, platformPercent = 0;
      if (loan.loan_product_id) {
        const { data: prod } = await supabase
          .from("loan_products")
          .select("processing_fee_percent, insurance_percent, enforcement_fee_percent, vat_percent, platform_fee_percent")
          .eq("id", loan.loan_product_id)
          .single();
        if (prod) {
          processingFeePercent = Number(prod.processing_fee_percent) || 0;
          insurancePercent = Number(prod.insurance_percent) || 0;
          enforcementPercent = Number(prod.enforcement_fee_percent) || 0;
          vatPercent = Number(prod.vat_percent) || 0;
          platformPercent = Number(prod.platform_fee_percent) || 0;
        }
      }

      const principal = loan.loan_amount;
      const processingFee = principal * (processingFeePercent / 100);
      const insuranceFee = principal * (insurancePercent / 100);
      const enforcementFee = principal * (enforcementPercent / 100);
      const platformFee = principal * (platformPercent / 100);
      const vatableAmount = processingFee + enforcementFee + platformFee;
      const vatFee = vatableAmount * (vatPercent / 100);
      const totalFees = processingFee + insuranceFee + enforcementFee + platformFee + vatFee;
      const netDisbursement = principal - totalFees;

      if (netDisbursement <= 0) throw new Error("Net disbursement is zero or negative after fees");

      // Fresh balance check
      const { data: freshAccount, error: accErr } = await supabase
        .from("accounts")
        .select("id, account_name, balance")
        .eq("id", disburseSourceAccountId)
        .single();
      if (accErr || !freshAccount) throw new Error("Source account not found");
      if (Number(freshAccount.balance) < netDisbursement) {
        throw new Error(`Insufficient balance in ${freshAccount.account_name}. Available: K${Number(freshAccount.balance).toLocaleString()}, Required: K${netDisbursement.toLocaleString()}`);
      }

      // Deduct from source account
      const newBalance = Number(freshAccount.balance) - netDisbursement;
      const { error: accUpdateErr } = await supabase
        .from("accounts")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", freshAccount.id);
      if (accUpdateErr) throw accUpdateErr;

      // Record transaction
      const { error: txErr } = await supabase.from("account_transactions").insert({
        account_id: freshAccount.id,
        transaction_type: "disbursement",
        amount: netDisbursement,
        balance_before: Number(freshAccount.balance),
        balance_after: newBalance,
        reference_type: "loan_disbursement",
        reference_id: loan.id,
        source: freshAccount.account_name,
        destination: `${loan.full_name} (Loan Disbursement)`,
        notes: `Principal K${principal.toLocaleString()}, Fees K${totalFees.toLocaleString()}, Net K${netDisbursement.toLocaleString()}`,
        created_by: user?.id,
      });
      if (txErr) throw txErr;

      // Record disbursement
      const { error: disbErr } = await supabase.from("disbursements").insert({
        loan_id: loan.id,
        amount: netDisbursement,
        disbursement_method: disburseMethod,
        source_account_id: freshAccount.id,
        transaction_reference: disburseTransactionRef || null,
        status: "completed",
        disbursed_at: new Date().toISOString(),
      });
      if (disbErr) throw disbErr;

      await createRepaymentScheduleForLoan(
        {
          id: loan.id,
          user_id: loan.user_id,
          loan_term_months: loan.loan_term_months,
          total_repayment: loan.total_repayment,
          monthly_payment: loan.monthly_payment,
          loan_product_id: loan.loan_product_id,
          term_unit: (loan as any).term_unit,
        },
        supabase,
      );

      // Record disbursement metadata (trigger already set status to active via generate_repayment_schedule)
      const { error: loanErr } = await supabase
        .from("loan_applications")
        .update({
          disbursed_by: user?.id,
          disbursed_at: new Date().toISOString(),
        })
        .eq("id", loan.id);
      if (loanErr) throw loanErr;

      await logAudit({
        action: "LOAN_DISBURSED",
        entity_type: "loan_application",
        entity_id: loan.id,
        details: {
          net_disbursement: netDisbursement,
          total_fees: totalFees,
          source_account: freshAccount.account_name,
          method: disburseMethod,
        },
      });

      return { netDisbursement, totalFees, accountName: freshAccount.account_name };
    },
    onSuccess: ({ netDisbursement, accountName }) => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["loan-disbursement", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
      toast.success(`Loan disbursed! K${netDisbursement.toLocaleString()} from ${accountName}`);
      setIsDisburseOpen(false);
      setDisburseSourceAccountId("");
      setDisburseTransactionRef("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to disburse loan");
    },
  });

  const reloanMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");

      // Fetch all repayments to calculate what's been paid
      const { data: allReps } = await supabase
        .from("loan_repayments")
        .select("*")
        .eq("loan_id", loan.id);

      const paidReps = (allReps || []).filter(r => r.status === "paid" && !r.is_reversed);
      const pendingReps = (allReps || []).filter(r => r.status === "pending" || r.status === "overdue");
      
      // Calculate total paid (principal_paid from paid installments + partial payments on pending)
      const totalPaidFromPaid = paidReps.reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0);
      const totalPartialOnPending = pendingReps.reduce((sum, r) => sum + Number(r.principal_paid || 0), 0);
      const totalAllPaid = totalPaidFromPaid + totalPartialOnPending;
      
      // Outstanding carry-forward = remaining installment balances (after any partial payments)
      const outstandingBalance = pendingReps.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      
      // Check for unpaid penalties only (ignore penalties already settled)
      const totalUnpaidPenalties = pendingReps.reduce(
        (sum, r) => sum + Math.max(0, Number(r.penalty_amount || 0) - Number(r.penalty_paid || 0)),
        0
      );

      // Block if penalties are still outstanding
      if (totalUnpaidPenalties > 0) {
        throw new Error(`Cannot reloan: K${totalUnpaidPenalties.toLocaleString()} in penalties must be cleared first.`);
      }

      if (outstandingBalance <= 0) {
        throw new Error("No outstanding balance to reloan. The borrower has fully paid.");
      }

      const optionalTopUpAmount = Number(reloanTopUpAmount || 0);
      if (!Number.isFinite(optionalTopUpAmount) || optionalTopUpAmount < 0) {
        throw new Error("Invalid optional top-up amount");
      }

      // Load latest product settings so fee/disbursement math is deterministic.
      let processingFeePercent = 0;
      let insurancePercent = 0;
      let enforcementPercent = 0;
      let vatPercent = 0;
      let platformPercent = 0;
      let interestRate = loan.interest_rate;
      let interestPeriod = loanProduct?.interest_period || "monthly";
      let interestType = loanProduct?.interest_type || "flat";
      let termUnit = (loan as any).term_unit || "months";
      if (loan.loan_product_id) {
        const { data: product } = await supabase
          .from("loan_products")
          .select("processing_fee_percent, insurance_percent, enforcement_fee_percent, vat_percent, platform_fee_percent, interest_rate, interest_period, interest_type, term_unit")
          .eq("id", loan.loan_product_id)
          .single();
        if (product) {
          processingFeePercent = Number(product.processing_fee_percent) || 0;
          insurancePercent = Number(product.insurance_percent) || 0;
          enforcementPercent = Number(product.enforcement_fee_percent) || 0;
          vatPercent = Number(product.vat_percent) || 0;
          platformPercent = Number(product.platform_fee_percent) || 0;
          interestRate = Number(product.interest_rate) || interestRate;
          interestPeriod = (product as any).interest_period || interestPeriod;
          interestType = (product as any).interest_type || interestType;
          termUnit = (product as any).term_unit || termUnit;
        }
      }

      let sourceAccount: { id: string; account_name: string; balance: number } | null = null;
      let topUpFees = 0;
      let topUpNetDisbursement = 0;
      if (optionalTopUpAmount > 0) {
        if (!reloanSourceAccountId) throw new Error("Select a source account for the optional top-up");
        const { data: freshAccount, error: sourceErr } = await supabase
          .from("accounts")
          .select("id, account_name, balance")
          .eq("id", reloanSourceAccountId)
          .single();
        if (sourceErr || !freshAccount) throw new Error("Source account not found");
        sourceAccount = freshAccount;

        const processingFee = optionalTopUpAmount * (processingFeePercent / 100);
        const insuranceFee = optionalTopUpAmount * (insurancePercent / 100);
        const enforcementFee = optionalTopUpAmount * (enforcementPercent / 100);
        const platformFee = optionalTopUpAmount * (platformPercent / 100);
        const vatFee = (processingFee + enforcementFee + platformFee) * (vatPercent / 100);
        topUpFees = processingFee + insuranceFee + enforcementFee + platformFee + vatFee;
        topUpNetDisbursement = optionalTopUpAmount - topUpFees;
        if (topUpNetDisbursement <= 0) {
          throw new Error("Optional top-up is too small after fees. Increase amount.");
        }
        if (Number(freshAccount.balance) < topUpNetDisbursement) {
          throw new Error(`Insufficient balance in ${freshAccount.account_name}. Available: K${Number(freshAccount.balance).toLocaleString()}`);
        }
      }

      // New principal is carry-forward outstanding + optional extra cash top-up.
      const outstandingPrincipal = outstandingBalance;
      const newPrincipal = outstandingPrincipal + optionalTopUpAmount;

      // Mark current loan as completed
      const { error: closeError } = await supabase
        .from("loan_applications")
        .update({
          status: "completed" as any,
          admin_notes: `${loan.admin_notes || ""}\n\n[RELOANED ${format(new Date(), "yyyy-MM-dd")}]: Outstanding K${outstandingPrincipal.toLocaleString()} carried to new loan.${optionalTopUpAmount > 0 ? ` Optional top-up K${optionalTopUpAmount.toLocaleString()} (net disbursed K${topUpNetDisbursement.toLocaleString()}, fees K${topUpFees.toLocaleString()}).` : ""} Original principal K${loan.loan_amount.toLocaleString()}, paid K${totalAllPaid.toLocaleString()}.${reloanReason.trim() ? ` Reason: ${reloanReason.trim()}.` : ""}`,
        })
        .eq("id", loan.id);
      if (closeError) throw closeError;

      // DB trigger `cancel_repayments_on_loan_closure` will automatically
      // cancel pending/overdue repayments when loan status changes to "completed".

      // Recalculate new loan terms with carry-forward outstanding plus optional top-up.
      const productForCalc: any = {
        product_name: loanProduct?.name || null,
        interest_rate: interestRate,
        interest_period: interestPeriod,
        interest_type: interestType,
      };
      const newCalc = calculateLoan(
        newPrincipal,
        loan.loan_term_months,
        productForCalc,
        termUnit as any
      );

      // Create new loan application with carry-forward outstanding plus optional top-up as principal.
      const { data: newLoan, error: insertError } = await supabase
        .from("loan_applications")
        .insert({
          user_id: loan.user_id,
          full_name: loan.full_name,
          email: loan.email,
          phone: loan.phone,
          nrc_number: loan.nrc_number,
          address: loan.address || null,
          city: loan.city || null,
          date_of_birth: loan.date_of_birth || null,
          employer_name: loan.employer_name || null,
          employer_id: loan.employer_id || null,
          job_title: loan.job_title || null,
          employment_type: loan.employment_type as any,
          employment_duration: loan.employment_duration || null,
          monthly_income: loan.monthly_income || 0,
          loan_amount: newPrincipal,
          loan_term_months: loan.loan_term_months,
          term_unit: termUnit,
          interest_rate: interestRate,
          monthly_payment: newCalc.monthlyPayment,
          total_repayment: newCalc.totalRepayment,
          loan_purpose: loan.loan_purpose,
          loan_product_id: loan.loan_product_id || null,
          parent_loan_id: loan.id,
          status: "active" as any,
          source: "internal",
          admin_notes: `Reloan from loan ${loan.id.slice(0, 8).toUpperCase()}: carry-forward outstanding K${outstandingPrincipal.toLocaleString()}${optionalTopUpAmount > 0 ? ` + optional top-up K${optionalTopUpAmount.toLocaleString()} (net disbursed K${topUpNetDisbursement.toLocaleString()}, fees K${topUpFees.toLocaleString()})` : ""}. Original K${loan.loan_amount.toLocaleString()}, Paid K${totalAllPaid.toLocaleString()}.${reloanReason.trim() ? ` Reason: ${reloanReason.trim()}.` : ""}`,
          disbursed_by: user?.id ?? null,
          disbursed_at: new Date().toISOString(),
          approved_by: user?.id ?? null,
          approved_at: new Date().toISOString(),
        })
        .select("id, user_id, loan_term_months, total_repayment, monthly_payment, loan_product_id")
        .single();

      if (insertError) throw insertError;

      // Generate repayment schedule for the new loan
      await createRepaymentScheduleForLoan(
        {
          id: newLoan.id,
          user_id: newLoan.user_id,
          loan_term_months: newLoan.loan_term_months,
          total_repayment: newLoan.total_repayment,
          monthly_payment: newLoan.monthly_payment,
          loan_product_id: newLoan.loan_product_id,
          term_unit: termUnit,
        },
        supabase
      );

      if (optionalTopUpAmount > 0 && sourceAccount) {
        const sourceBalanceAfter = Number(sourceAccount.balance) - topUpNetDisbursement;
        const { error: sourceUpdateError } = await supabase
          .from("accounts")
          .update({ balance: sourceBalanceAfter, updated_at: new Date().toISOString() })
          .eq("id", sourceAccount.id);
        if (sourceUpdateError) throw sourceUpdateError;

        const { error: txError } = await supabase.from("account_transactions").insert({
          account_id: sourceAccount.id,
          transaction_type: "disbursement",
          amount: topUpNetDisbursement,
          balance_before: Number(sourceAccount.balance),
          balance_after: sourceBalanceAfter,
          reference_type: "loan_reloan_topup",
          reference_id: newLoan.id,
          source: sourceAccount.account_name,
          destination: `${loan.full_name} (reloan top-up)`,
          notes: `Reloan top-up gross K${optionalTopUpAmount.toLocaleString()}, fees K${topUpFees.toLocaleString()}, net K${topUpNetDisbursement.toLocaleString()}.`,
          created_by: user?.id,
        });
        if (txError) throw txError;
      }

      // Record loan event on original loan
      const { error: reloanEv1Err } = await supabase.from("loan_events" as any).insert({
        loan_id: loan.id,
        event_type: "reloan",
        performed_by: user?.id,
        reason: `Reloan — carried K${outstandingPrincipal.toLocaleString()}${optionalTopUpAmount > 0 ? ` + top-up K${optionalTopUpAmount.toLocaleString()} (net K${topUpNetDisbursement.toLocaleString()})` : ""} (Original K${loan.loan_amount.toLocaleString()}, Paid K${totalAllPaid.toLocaleString()}).${reloanReason.trim() ? ` Reason: ${reloanReason.trim()}.` : ""} New loan ${newLoan.id.slice(0, 8).toUpperCase()}.`,
        previous_values: { principal: loan.loan_amount, total_repayment: loan.total_repayment, total_paid: totalAllPaid, status: loan.status },
        new_values: { principal: newPrincipal, total_repayment: newCalc.totalRepayment, status: "active" },
        new_loan_id: newLoan.id,
        amount: newPrincipal,
      });
      if (reloanEv1Err) throw reloanEv1Err;

      // Record loan event on new loan for traceability
      const { error: reloanEv2Err } = await supabase.from("loan_events" as any).insert({
        loan_id: newLoan.id,
        event_type: "reloan_created",
        performed_by: user?.id,
        reason: `Created from loan ${loan.id.slice(0, 8).toUpperCase()}. Carry-forward K${outstandingPrincipal.toLocaleString()}${optionalTopUpAmount > 0 ? ` + top-up K${optionalTopUpAmount.toLocaleString()}` : ""}.${reloanReason.trim() ? ` Reason: ${reloanReason.trim()}.` : ""}`,
        previous_values: { parent_loan_id: loan.id, original_principal: loan.loan_amount },
        new_values: { principal: newPrincipal, total_repayment: newCalc.totalRepayment },
        amount: newPrincipal,
      });
      if (reloanEv2Err) throw reloanEv2Err;

      await logAudit({
        action: "RELOAN",
        entity_type: "loan_application",
        entity_id: loan.id,
        details: {
          new_loan_id: newLoan.id,
          carry_forward_amount: outstandingPrincipal,
          optional_top_up_amount: optionalTopUpAmount,
          optional_top_up_net_disbursement: topUpNetDisbursement,
          optional_top_up_fees: topUpFees,
          resulting_principal: newPrincipal,
          original_principal: loan.loan_amount,
          total_paid: totalAllPaid,
        },
      });

      return { newLoan, outstandingPrincipal, optionalTopUpAmount, topUpNetDisbursement };
    },
    onSuccess: ({ newLoan, outstandingPrincipal, optionalTopUpAmount, topUpNetDisbursement }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["loan-repayments"] });
      queryClient.invalidateQueries({ queryKey: ["loan-events", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
      toast.success(
        optionalTopUpAmount > 0
          ? `Reloan created: carry-forward K${outstandingPrincipal.toLocaleString()} + top-up K${optionalTopUpAmount.toLocaleString()} (net K${topUpNetDisbursement.toLocaleString()})`
          : `Reloan created: K${outstandingPrincipal.toLocaleString()} carry-forward principal (ID: ${newLoan.id.slice(0, 8)})`
      );
      setReloanTopUpAmount("");
      setReloanReason("");
      setReloanSourceAccountId("");
      setIsReloanOpen(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create reloan");
    },
  });

  // Top-Up mutation - increases principal on existing loan, disburses difference
  const topUpMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");
      const additionalAmount = Number(topUpAmount);
      if (!additionalAmount || additionalAmount <= 0) throw new Error("Enter a valid top-up amount");
      if (!topUpSourceAccountId) throw new Error("Select a source account");

      // Fetch fresh account balance
      const { data: freshAccount, error: accErr } = await supabase
        .from("accounts")
        .select("id, account_name, balance")
        .eq("id", topUpSourceAccountId)
        .single();
      if (accErr || !freshAccount) throw new Error("Source account not found");
      if (freshAccount.balance < additionalAmount) throw new Error(`Insufficient balance in ${freshAccount.account_name}. Available: K${Number(freshAccount.balance).toLocaleString()}`);

      // Fetch product for fee & interest calculations
      let processingFeePercent = 0;
      let interestRate = loan.interest_rate || 15;
      let insurancePercent = 0;
      let enforcementPercent = 0;
      let vatPercent = 0;
      let platformPercent = 0;
      let interestPeriod = 'monthly';
      let interestType = 'flat';
      let termUnit = (loan as any).term_unit || 'months';

      if (loan.loan_product_id) {
        const { data: prod } = await supabase
          .from("loan_products")
          .select("name, processing_fee_percent, interest_rate, insurance_percent, enforcement_fee_percent, vat_percent, platform_fee_percent, interest_period, interest_type, term_unit")
          .eq("id", loan.loan_product_id)
          .single();
        if (prod) {
          processingFeePercent = Number(prod.processing_fee_percent) || 0;
          interestRate = Number(prod.interest_rate) || interestRate;
          insurancePercent = Number(prod.insurance_percent) || 0;
          enforcementPercent = Number(prod.enforcement_fee_percent) || 0;
          vatPercent = Number(prod.vat_percent) || 0;
          platformPercent = Number(prod.platform_fee_percent) || 0;
          interestPeriod = (prod as any).interest_period || 'monthly';
          interestType = (prod as any).interest_type || 'flat';
          termUnit = (prod as any).term_unit || termUnit;
        }
      }

      // Calculate fees on additional amount
      const processingFee = additionalAmount * (processingFeePercent / 100);
      const insuranceFee = additionalAmount * (insurancePercent / 100);
      const enforcementFee = additionalAmount * (enforcementPercent / 100);
      const platformFee = additionalAmount * (platformPercent / 100);
      // VAT applies to fee amounts, not the full additional amount
      const vatableAmount = processingFee + enforcementFee + platformFee;
      const vatFee = vatableAmount * (vatPercent / 100);
      const totalFees = processingFee + insuranceFee + enforcementFee + vatFee + platformFee;
      const netDisbursement = additionalAmount - totalFees;

      if (netDisbursement <= 0) throw new Error("Top-up amount is too small to cover fees");

      // New principal & recalculate using unified calculation
      const newPrincipal = loan.loan_amount + additionalAmount;
      const loanCalc = calculateLoan(newPrincipal, loan.loan_term_months, {
        product_name: (loanProduct as any)?.name || null,
        interest_rate: interestRate,
        interest_period: interestPeriod as any,
        interest_type: interestType as any,
      }, termUnit as any);

      const newTotal = loanCalc.totalRepayment;
      const newMonthly = loanCalc.monthlyPayment;

      // Update loan application
      const { error: loanErr } = await supabase
        .from("loan_applications")
        .update({
          loan_amount: newPrincipal,
          total_repayment: newTotal,
          monthly_payment: newMonthly,
          admin_notes: `${loan.admin_notes || ""}\n\n[TOP-UP ${format(new Date(), "yyyy-MM-dd")}]: +K${additionalAmount.toLocaleString()} (net K${netDisbursement.toLocaleString()} after K${totalFees.toLocaleString()} fees). Total repayment: K${newTotal.toLocaleString()}. Reason: ${topUpReason || "N/A"}. Source: ${freshAccount.account_name}.`,
        })
        .eq("id", loan.id);
      if (loanErr) throw loanErr;

      // Delete pending repayments and regenerate
      const { error: delPendingErr } = await supabase
        .from("loan_repayments")
        .delete()
        .eq("loan_id", loan.id)
        .eq("status", "pending");
      if (delPendingErr) throw delPendingErr;

      const { data: paidReps } = await supabase
        .from("loan_repayments")
        .select("installment_number, amount, principal_paid, original_amount")
        .eq("loan_id", loan.id)
        .eq("status", "paid")
        .order("installment_number", { ascending: false });

      const lastPaidInstallment = paidReps?.[0]?.installment_number || 0;
      const paidTotal = (paidReps ?? []).reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0);
      const remainingTotal = newTotal - paidTotal;
      const remainingInstallments = loan.loan_term_months - lastPaidInstallment;
      const newInstallmentAmount = remainingInstallments > 0 ? remainingTotal / remainingInstallments : newMonthly;

      const repaymentRecords = [];
      const startDate = new Date();
      for (let i = 1; i <= remainingInstallments; i++) {
        repaymentRecords.push({
          loan_id: loan.id,
          user_id: loan.user_id,
          amount: newInstallmentAmount,
          due_date: format(addMonths(startDate, i), "yyyy-MM-dd"),
          installment_number: lastPaidInstallment + i,
          status: "pending",
        });
      }
      if (repaymentRecords.length > 0) {
        const { error } = await supabase.from("loan_repayments").insert(repaymentRecords);
        if (error) throw error;
      }

      // Deduct from source account
      const newBalance = freshAccount.balance - netDisbursement;
      const { error: topUpAccErr } = await supabase
        .from("accounts")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", freshAccount.id);
      if (topUpAccErr) throw topUpAccErr;

      // Record transaction
      const { error: topUpTxErr } = await supabase.from("account_transactions").insert({
        account_id: freshAccount.id,
        transaction_type: "disbursement",
        amount: netDisbursement,
        balance_before: freshAccount.balance,
        balance_after: newBalance,
        reference_type: "loan_top_up",
        reference_id: loan.id,
        source: freshAccount.account_name,
        destination: `Top-up for ${loan.full_name}`,
        notes: `Top-up +K${additionalAmount.toLocaleString()} (net K${netDisbursement.toLocaleString()}) — ${topUpReason || "N/A"}`,
        created_by: user?.id,
      });
      if (topUpTxErr) throw topUpTxErr;

      // Record loan event for history timeline
      const { error: topUpEvErr } = await supabase.from("loan_events" as any).insert({
        loan_id: loan.id,
        event_type: "top_up",
        performed_by: user?.id,
        reason: topUpReason || "Top-up applied",
        previous_values: {
          principal: loan.loan_amount,
          interest_rate: loan.interest_rate,
          term: loan.loan_term_months,
          term_unit: (loan as any).term_unit || 'months',
          total_repayment: loan.total_repayment,
          monthly_payment: loan.monthly_payment,
        },
        new_values: {
          principal: newPrincipal,
          interest_rate: interestRate,
          term: loan.loan_term_months,
          term_unit: (loan as any).term_unit || 'months',
          total_repayment: newTotal,
          monthly_payment: newMonthly,
        },
        amount: additionalAmount,
        fees_charged: totalFees,
        net_amount: netDisbursement,
        source_account_id: topUpSourceAccountId,
      });
      if (topUpEvErr) throw topUpEvErr;

      await logAudit({
        action: "LOAN_TOP_UP",
        entity_type: "loan_application",
        entity_id: loan.id,
        details: { additional_amount: additionalAmount, net_disbursement: netDisbursement, total_fees: totalFees, new_principal: newPrincipal, source_account: freshAccount.account_name },
      });

      return { additionalAmount, netDisbursement };
    },
    onSuccess: ({ additionalAmount, netDisbursement }) => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
      queryClient.invalidateQueries({ queryKey: ["loan-events", loan?.id] });
      toast.success(`Top-up of K${additionalAmount.toLocaleString()} applied. K${netDisbursement.toLocaleString()} disbursed (after fees).`);
      setIsTopUpOpen(false);
      setTopUpAmount("");
      setTopUpReason("");
      setTopUpSourceAccountId("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process top-up");
    },
  });

  // Contract upload mutation removed — manual contract workflow

  // Restructure loan mutation
  const restructureLoanMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");

      const newTerm = Number(newTermMonths) || loan.loan_term_months;
      const newRate = Number(newInterestRate) || loan.interest_rate;
      const principal = loan.loan_amount;

      // Fetch product for proper interest_period/type
      let interestPeriod = 'monthly';
      let interestType = 'flat';
      let termUnit = (loan as any).term_unit || 'months';
      if (loan.loan_product_id) {
        const { data: prod } = await supabase
          .from("loan_products")
          .select("interest_period, interest_type, term_unit")
          .eq("id", loan.loan_product_id)
          .single();
        if (prod) {
          interestPeriod = (prod as any).interest_period || 'monthly';
          interestType = (prod as any).interest_type || 'flat';
          termUnit = (prod as any).term_unit || termUnit;
        }
      }

      // Use unified calculation for correct interest normalization
      const loanCalc = calculateLoan(principal, newTerm, {
        product_name: (loanProduct as any)?.name || null,
        interest_rate: newRate,
        interest_period: interestPeriod as any,
        interest_type: interestType as any,
      }, termUnit as any);

      const newTotal = loanCalc.totalRepayment;
      const newMonthly = loanCalc.monthlyPayment;

      // Update loan
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          loan_term_months: newTerm,
          interest_rate: newRate,
          total_repayment: newTotal,
          monthly_payment: newMonthly,
          admin_notes: `${loan.admin_notes || ""}\n\n[RESTRUCTURED ${format(new Date(), "yyyy-MM-dd")}]: ${restructureReason}\nNew terms: ${newTerm} ${termUnit} @ ${newRate}% (${interestPeriod}, ${interestType}). Total: K${newTotal.toLocaleString()}`,
        })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      // Delete pending repayments and regenerate
      await supabase
        .from("loan_repayments")
        .delete()
        .eq("loan_id", loan.id)
        .eq("status", "pending");

      // Get paid count to continue numbering
      const { data: paidRepayments } = await supabase
        .from("loan_repayments")
        .select("installment_number")
        .eq("loan_id", loan.id)
        .eq("status", "paid")
        .order("installment_number", { ascending: false });

      const lastPaidInstallment = paidRepayments?.[0]?.installment_number || 0;
      const remainingInstallments = newTerm - lastPaidInstallment;
      
      // Calculate remaining amount (total - already paid)
      const { data: paidReps } = await supabase
        .from("loan_repayments")
        .select("amount, principal_paid, original_amount")
        .eq("loan_id", loan.id)
        .eq("status", "paid");
      const paidTotal = (paidReps ?? []).reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0);
      const remainingTotal = newTotal - paidTotal;
      const installmentAmount = remainingInstallments > 0 ? remainingTotal / remainingInstallments : newMonthly;

      // Determine schedule interval
      const isWeekly = termUnit === 'weeks' || interestPeriod === 'weekly';
      const isDaily = termUnit === 'days' || interestPeriod === 'daily';

      // Generate new schedule
      const repaymentRecords = [];
      const startDate = new Date();

      for (let i = 1; i <= remainingInstallments; i++) {
        const dueDate = new Date(startDate);
        if (isDaily) {
          dueDate.setDate(dueDate.getDate() + i);
        } else if (isWeekly) {
          dueDate.setDate(dueDate.getDate() + i * 7);
        } else {
          dueDate.setMonth(dueDate.getMonth() + i);
        }
        repaymentRecords.push({
          loan_id: loan.id,
          user_id: loan.user_id,
          amount: installmentAmount,
          due_date: format(dueDate, "yyyy-MM-dd"),
          installment_number: lastPaidInstallment + i,
          status: "pending",
        });
      }

      if (repaymentRecords.length > 0) {
        const { error } = await supabase
          .from("loan_repayments")
          .insert(repaymentRecords);
        if (error) throw error;
      }

      // Record loan event for history timeline
      await supabase.from("loan_events" as any).insert({
        loan_id: loan.id,
        event_type: "restructure",
        performed_by: user?.id,
        reason: restructureReason || "Loan restructured",
        previous_values: {
          principal: loan.loan_amount,
          interest_rate: loan.interest_rate,
          term: loan.loan_term_months,
          term_unit: (loan as any).term_unit || 'months',
          total_repayment: loan.total_repayment,
          monthly_payment: loan.monthly_payment,
        },
        new_values: {
          principal: principal,
          interest_rate: newRate,
          term: newTerm,
          term_unit: termUnit,
          total_repayment: newTotal,
          monthly_payment: newMonthly,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-events", loan?.id] });
      toast.success("Loan restructured successfully");
      setIsRestructureOpen(false);
      setNewTermMonths("");
      setNewInterestRate("");
      setRestructureReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to restructure loan");
    },
  });

  // Undo disbursement mutation
  const undoDisbursementMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");

      // Find the disbursement to refund the source account
      const { data: disbursementRecord } = await supabase
        .from("disbursements")
        .select("*, source_account_id, amount")
        .eq("loan_id", loan.id)
        .maybeSingle();

      // Refund source account if applicable
      if (disbursementRecord?.source_account_id) {
        const { data: sourceAccount } = await supabase
          .from("accounts")
          .select("id, balance, account_name")
          .eq("id", disbursementRecord.source_account_id)
          .single();

        if (sourceAccount) {
          const refundAmount = Number(disbursementRecord.amount);
          const newBalance = sourceAccount.balance + refundAmount;
          const { error: undoAccErr } = await supabase
            .from("accounts")
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq("id", sourceAccount.id);
          if (undoAccErr) throw undoAccErr;

          // Record refund transaction
          const { error: undoTxErr } = await supabase.from("account_transactions").insert({
            account_id: sourceAccount.id,
            transaction_type: "refund",
            amount: refundAmount,
            balance_before: sourceAccount.balance,
            balance_after: newBalance,
            reference_type: "disbursement_reversal",
            reference_id: loan.id,
            source: "Disbursement Reversal",
            destination: sourceAccount.account_name,
            notes: `Undo disbursement for ${loan.full_name} — K${refundAmount.toLocaleString()} refunded`,
            created_by: user?.id,
          });
          if (undoTxErr) throw undoTxErr;
        }
      }

      // Delete disbursement record
      const { error: delDisbErr } = await supabase
        .from("disbursements")
        .delete()
        .eq("loan_id", loan.id);
      if (delDisbErr) throw delDisbErr;

      // Delete all repayments
      const { error: delRepErr } = await supabase
        .from("loan_repayments")
        .delete()
        .eq("loan_id", loan.id);
      if (delRepErr) throw delRepErr;

      // Revert loan status to approved
      const { error } = await supabase
        .from("loan_applications")
        .update({ status: "approved" })
        .eq("id", loan.id);

      if (error) throw error;

      await logAudit({
        action: "UNDO_DISBURSEMENT",
        entity_type: "loan_application",
        entity_id: loan.id,
        details: { refunded_amount: disbursementRecord?.amount, source_account_id: disbursementRecord?.source_account_id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["loan-disbursement", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
      toast.success("Disbursement undone - loan reverted to approved status. Source account refunded.");
      setIsUndoDisbursementOpen(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to undo disbursement");
    },
  });

  // Update loan status mutation (Move to)
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!loan) throw new Error("No loan selected");
      // Permission check: only users with approve permission can move to approved
      if (status === "approved" && !canApprove) {
        throw new Error("You don't have permission to approve loans");
      }
      const { error } = await supabase
        .from("loan_applications")
        .update({ status: status as any })
        .eq("id", loan.id);
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      toast.success(`Moved to ${getCanonicalStatusLabel(newStatus)}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  // Save notes mutation
  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");
      const { error } = await supabase
        .from("loan_applications")
        .update({ admin_notes: adminNotes })
        .eq("id", loan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notes saved");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save notes");
    },
  });

  // Update admin notes when loan changes
  useEffect(() => {
    if (loan) {
      setAdminNotes(loan.admin_notes || "");
    }
  }, [loan?.id, loan?.admin_notes]);

  if (!loan) return null;

  // Calculate progress and stats
  const paidRepayments = repayments?.filter(r => r.status === "paid" && !r.is_reversed) || [];
  const pendingRepayments = repayments?.filter(r => r.status === "pending") || [];
  const unpaidRepayments = repayments?.filter(r => (r.status === "pending" || r.status === "overdue") && !r.is_reversed) || [];
  const reversedRepayments = repayments?.filter(r => r.is_reversed) || [];
  // Use principal_paid where available; fall back to original_amount for settlement/reloan rows
  const totalPaid = paidRepayments.reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0);
  // Also count partial payments on non-paid installments (overdue with principal_paid > 0)
  const partialPaymentsOnPending = unpaidRepayments
    .reduce((sum, r) => sum + Number(r.principal_paid || 0), 0);
  const totalPaidIncludingPartial = totalPaid + partialPaymentsOnPending;
  const totalPenalties = unpaidRepayments.reduce(
    (sum, r) => sum + Math.max(0, Number(r.penalty_amount || 0) - Number(r.penalty_paid || 0)),
    0
  );
  const totalOutstanding = unpaidRepayments.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const reloanTopUpNumeric = Math.max(0, Number(reloanTopUpAmount || 0));
  const reloanProjectedPrincipal = totalOutstanding + reloanTopUpNumeric;
  const progressPercentage = loan.total_repayment > 0 ? (totalPaidIncludingPartial / loan.total_repayment) * 100 : 0;
  const overdueCount = repayments?.filter(r => r.status === "pending" && new Date(r.due_date) < new Date()).length || 0;
  const nextDue = repayments?.find(r => r.status === "pending" && new Date(r.due_date) >= new Date());

  // Helper functions for schedule and contract
  const handleDownloadSchedule = () => {
    const scheduleData = {
      borrowerName: loan.full_name,
      borrowerPhone: loan.phone,
      borrowerEmail: loan.email,
      loanReference: `LOAN-${loan.id.substring(0, 8).toUpperCase()}`,
      loanAmount: loan.loan_amount,
      interestRate: loan.interest_rate,
      interestPeriod: 'monthly',
      termMonths: loan.loan_term_months,
      monthlyPayment: loan.monthly_payment || (loan.total_repayment / loan.loan_term_months),
      totalRepayment: loan.total_repayment,
      disbursementDate: disbursement?.disbursed_at || new Date().toISOString(),
      firstRepaymentDate: repayments?.[0]?.due_date || format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      repayments: (repayments || []).map(r => ({
        installmentNumber: r.installment_number || 0,
        dueDate: r.due_date,
        amount: r.amount,
        status: r.status,
        paidDate: r.paid_date || undefined,
      })),
      companyName: settings?.companyInfo?.name || 'PHINDU Finance',
      companyAddress: settings?.companyInfo?.address || 'Lusaka, Zambia',
      companyPhone: settings?.companyInfo?.support_phone || '+260 967 713 001',
    };
    downloadLoanSchedule(scheduleData);
    toast.success('Loan schedule downloaded');
  };

  const handleShareScheduleWhatsApp = async () => {
    // First download the schedule
    handleDownloadSchedule();

    // Send via WhatsApp directly via Twilio
    const { sendWhatsAppDirect } = await import('@/utils/sendDirectNotification');
    
    const message = `Hello ${loan.full_name},\n\n` +
      `Please find your Loan Repayment Schedule from ${settings?.companyInfo?.name || 'PHINDU Finance'}.\n\n` +
      `Loan Details:\n` +
      `- Reference: LOAN-${loan.id.substring(0, 8).toUpperCase()}\n` +
      `- Amount: K${loan.loan_amount.toLocaleString()}\n` +
      `- Monthly Payment: K${(loan.monthly_payment || 0).toLocaleString()}\n` +
      `- Term: ${loan.loan_term_months} months\n\n` +
      `Please contact us if you have any questions.\n\n` +
      `${settings?.companyInfo?.name || 'PHINDU Finance'}`;

    await sendWhatsAppDirect(loan.phone, message, 'Loan Repayment Schedule');
  };

  const handleEmailSchedule = async () => {
    handleDownloadSchedule();

    // Send via Email directly via SendGrid
    const { sendEmailDirect } = await import('@/utils/sendDirectNotification');
    
    const subject = `Loan Repayment Schedule - LOAN-${loan.id.substring(0, 8).toUpperCase()}`;
    const message = 
      `Dear ${loan.full_name},\n\n` +
      `Please find attached your Loan Repayment Schedule from ${settings?.companyInfo?.name || 'PHINDU Finance'}.\n\n` +
      `Loan Details:\n` +
      `- Reference: LOAN-${loan.id.substring(0, 8).toUpperCase()}\n` +
      `- Principal: K${loan.loan_amount.toLocaleString()}\n` +
      `- Interest Rate: ${loan.interest_rate}%\n` +
      `- Monthly Payment: K${(loan.monthly_payment || 0).toLocaleString()}\n` +
      `- Term: ${loan.loan_term_months} months\n` +
      `- Total Repayment: K${loan.total_repayment.toLocaleString()}\n\n` +
      `Please contact us if you have any questions.\n\n` +
      `Best regards,\n` +
      `${settings?.companyInfo?.name || 'PHINDU Finance'}`;

    await sendEmailDirect(loan.email, subject, message);
  };

  const handleDownloadContract = async () => {
    await downloadLoanContract(loan as any);
    toast.success('Contract downloaded');
  };

  const handleContractWhatsApp = async () => {
    await shareContractViaWhatsApp(loan as any);
  };

  const handleContractEmail = async () => {
    await emailContract(loan as any);
  };

  // SMS via unified notification service
  const handleContractSMS = async () => {
    if (!loan.phone) {
      toast.error("No phone number available");
      return;
    }
    await smsContract(loan as any, settings?.companyInfo?.name || 'PHINDU Finance');
  };

  const handleScheduleSMS = async () => {
    if (!loan.phone) {
      toast.error("No phone number available");
      return;
    }

    const message = `Dear ${loan.full_name}, your loan schedule (Ref: LOAN-${loan.id.substring(0, 8).toUpperCase()}) is ready. Amount: K${loan.loan_amount.toLocaleString()}, Monthly Payment: K${(loan.monthly_payment || 0).toLocaleString()}, Term: ${loan.loan_term_months} months. Check your email for full schedule. - ${settings?.companyInfo?.name || 'PHINDU Finance'}`;

    try {
      const { data, error } = await supabase.functions.invoke("excite-sms", {
        body: {
          to: loan.phone,
          message,
          userId: loan.user_id,
          title: "Loan Schedule Notification"
        }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(`SMS sent to ${loan.phone}`);
      } else {
        toast.error(data?.message || "Failed to send SMS");
      }
    } catch (error: any) {
      console.error("[SMS] Error:", error);
      toast.error(error.message || "Failed to send SMS");
    }
  };

  // Repayment-specific status labels (NOT the loan status labels)
  const REPAYMENT_STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    paid: "Paid",
    overdue: "Overdue",
    due: "Due Today",
    reversed: "Reversed",
    cancelled: "Cancelled",
  };

  const getStatusBadge = (status: string, isRepaymentStatus = false) => {
    const config: Record<string, { color: string; icon: any }> = {
      active: { color: "bg-success/20 text-success border-success/30", icon: Activity },
      disbursed: { color: "bg-info/20 text-info border-info/30", icon: Banknote },
      completed: { color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle },
      defaulted: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
      pending: { color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
      awaiting_disbursement: { color: "bg-info/20 text-info border-info/30", icon: DollarSign },
      paid: { color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
      overdue: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: AlertTriangle },
      due: { color: "bg-warning/20 text-warning border-warning/30", icon: AlertCircle },
      reversed: { color: "bg-muted text-muted-foreground border-muted", icon: RotateCcw },
      cancelled: { color: "bg-muted text-muted-foreground border-muted", icon: XCircle },
    };
    const { color, icon: Icon } = config[status] || config.pending;
    const label = isRepaymentStatus 
      ? (REPAYMENT_STATUS_LABELS[status] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
      : getCanonicalStatusLabel(status);
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        <Icon size={12} className="mr-1" />
        {label}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-3">
                  <User size={24} className="text-primary" />
                  {loan.full_name}
                  {getStatusBadge(loan.status)}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Loan ID: {loan.id.slice(0, 8)}... • Created {format(new Date(loan.created_at), "MMM dd, yyyy")}
                </DialogDescription>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">K{Number(loan.loan_amount).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{loan.loan_term_months} months @ {loan.interest_rate}%</p>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="overview" className="text-xs">
                <TrendingUp size={14} className="mr-1 hidden sm:inline" /> Overview
              </TabsTrigger>
              <TabsTrigger value="repayments" className="text-xs">
                <Receipt size={14} className="mr-1 hidden sm:inline" /> Repayments
              </TabsTrigger>
              <TabsTrigger value="contract" className="text-xs">
                <FileText size={14} className="mr-1 hidden sm:inline" /> Contract
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                <History size={14} className="mr-1 hidden sm:inline" /> History
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pt-4">
              {/* Overview Tab */}
              <TabsContent value="overview" className="m-0 space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Principal</p>
                      <p className="text-lg font-bold">K{Number(loan.loan_amount).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Total Repayment</p>
                      <p className="text-lg font-bold">K{Number(loan.total_repayment).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Monthly Payment</p>
                      <p className="text-lg font-bold">K{Number(loan.monthly_payment || 0).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className={`${totalPenalties > 0 ? "bg-destructive/10 border-destructive/20" : "bg-muted/30"}`}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Total Penalties</p>
                      <p className={`text-lg font-bold ${totalPenalties > 0 ? "text-destructive" : ""}`}>
                        K{totalPenalties.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Awaiting Disbursement Banner */}
                {(loan.status === "awaiting_disbursement" || loan.status === "approved") && (
                  <Card className="border-info/40 bg-info/10">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <DollarSign size={24} className="text-info mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-info">Awaiting Disbursement</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            This loan has been approved and is waiting for funds to be disbursed. 
                            No repayment schedule or interest will be generated until disbursement is completed.
                          </p>
                          <Button size="sm" className="mt-3" onClick={() => setIsDisburseOpen(true)}>
                            <Banknote size={14} className="mr-1" /> Disburse Funds
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Progress */}
                {!isPreDisbursement && repayments && repayments.length > 0 && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="font-medium">Repayment Progress</p>
                        <p className="text-sm text-muted-foreground">
                          {paidRepayments.length} of {repayments.filter(r => !r.is_reversed).length} payments
                        </p>
                      </div>
                      <Progress value={progressPercentage} className="h-3" />
                      <div className="flex justify-between text-sm">
                        <span className="text-success">Paid: K{totalPaidIncludingPartial.toLocaleString()}</span>
                        <span className="text-muted-foreground">
                          Remaining: K{(totalOutstanding + totalPenalties).toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Alerts - only show for post-disbursement loans */}
                {!isPreDisbursement && <div className="flex flex-wrap gap-3">
                  {overdueCount > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="text-destructive" size={18} />
                      <div>
                        <p className="text-xs text-muted-foreground">Overdue Payments</p>
                        <p className="font-medium text-destructive">{overdueCount} installments</p>
                      </div>
                    </div>
                  )}
                  {totalPenalties > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                      <AlertCircle className="text-warning" size={18} />
                      <div>
                        <p className="text-xs text-muted-foreground">Accumulated Penalties</p>
                        <p className="font-medium text-warning">K{totalPenalties.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  {nextDue && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
                      <Calendar className="text-info" size={18} />
                      <div>
                        <p className="text-xs text-muted-foreground">Next Due Date</p>
                        <p className="font-medium">{format(new Date(nextDue.due_date), "MMM dd, yyyy")}</p>
                      </div>
                    </div>
                  )}
                  {disbursement && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                      <Banknote className="text-success" size={18} />
                      <div>
                        <p className="text-xs text-muted-foreground">Disbursed</p>
                        <p className="font-medium">{disbursement.disbursed_at ? format(new Date(disbursement.disbursed_at), "MMM dd, yyyy") : "Pending"}</p>
                      </div>
                    </div>
                  )}
                  {reversedRepayments.length > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                      <RotateCcw className="text-muted-foreground" size={18} />
                      <div>
                        <p className="text-xs text-muted-foreground">Reversed Payments</p>
                        <p className="font-medium">{reversedRepayments.length} payments</p>
                      </div>
                    </div>
                  )}
                </div>}

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {/* Disburse button for awaiting_disbursement / approved */}
                    {(loan.status === "awaiting_disbursement" || loan.status === "approved") && (
                      <Button size="sm" onClick={() => setIsDisburseOpen(true)}>
                        <Banknote size={14} className="mr-1" /> Disburse Funds
                      </Button>
                    )}
                    {/* Post-disbursement actions only */}
                    {!isPreDisbursement && (
                      <>
                        {(!repayments || repayments.length === 0) && (
                          <Button size="sm" onClick={() => setIsGenerateScheduleOpen(true)}>
                            <Plus size={14} className="mr-1" /> Generate Schedule
                          </Button>
                        )}
                        {repayments && repayments.length > 0 && (
                          <Button size="sm" onClick={() => {
                            const nextPending = repayments.find(r => r.status === "pending");
                            if (nextPending) {
                              setSelectedRepayment(nextPending);
                              setPaymentAmount((nextPending.amount + Math.max(0, (nextPending.penalty_amount || 0) - (nextPending.penalty_paid || 0))).toString());
                              setIsRecordPaymentOpen(true);
                            }
                          }}>
                            <CreditCard size={14} className="mr-1" /> Record Payment
                          </Button>
                        )}
                        {overdueCount > 0 && (
                          <Button size="sm" variant="outline" onClick={() => setIsApplyPenaltiesOpen(true)}>
                            <AlertCircle size={14} className="mr-1" /> Apply Penalties
                          </Button>
                        )}
                        {loan.status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => calculateEarlySettlementMutation.mutate()}>
                            <Calculator size={14} className="mr-1" /> Early Settlement
                          </Button>
                        )}
                        {(loan.status === "active" || loan.status === "disbursed") && (
                          <Button size="sm" variant="outline" onClick={() => setIsRestructureOpen(true)}>
                            <RefreshCw size={14} className="mr-1" /> Restructure
                          </Button>
                        )}
                        {(loan.status === "active" || loan.status === "disbursed") && (
                          <Button size="sm" variant="outline" onClick={() => setIsReloanOpen(true)}>
                            <ArrowRight size={14} className="mr-1" /> Reloan
                          </Button>
                        )}
                        {(loan.status === "active" || loan.status === "disbursed") && (
                          <Button size="sm" variant="outline" onClick={() => setIsTopUpOpen(true)}>
                            <Plus size={14} className="mr-1" /> Top Up
                          </Button>
                        )}
                        {(loan.status === "disbursed" || loan.status === "active") && paidRepayments.length === 0 && (
                          <Button size="sm" variant="destructive" onClick={() => setIsUndoDisbursementOpen(true)}>
                            <Undo2 size={14} className="mr-1" /> Undo Disbursement
                          </Button>
                        )}
                      </>
                    )}

                  </CardContent>
                </Card>

                {/* V1.0.1: Simple contract status indicator */}
                {/* Contract status - view only (upload removed) */}
                {(loan.status === "approved" || loan.status === "contract_signing" || loan.status === "disbursed" || loan.status === "active" || loan.status === "completed") && (
                  <Card className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-primary" />
                          <div>
                            <p className="font-medium text-sm">Contract</p>
                            <p className="text-xs text-muted-foreground">
                              {(loan as any).contract_url ? "Generated — filed manually" : "Not yet generated"}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setActiveTab("contract")}>
                          <Eye size={14} className="mr-1" /> View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Message Borrower Section */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare size={16} className="text-primary" /> Message Borrower
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select value={messageTemplate} onValueChange={(val) => {
                      setMessageTemplate(val);
                      const templates: Record<string, string> = {
                        payment_reminder: `Dear ${loan.full_name}, your next payment of K${Number(loan.monthly_payment || 0).toLocaleString()} is due${nextDue ? ` on ${format(new Date(nextDue.due_date), "MMM dd, yyyy")}` : " soon"}. Please ensure timely payment. - ${settings?.companyInfo?.name || 'PHINDU Finance'}`,
                        payment_overdue: `Dear ${loan.full_name}, your payment of K${Number(loan.monthly_payment || 0).toLocaleString()} is overdue${overdueCount > 0 ? ` (${overdueCount} installment${overdueCount > 1 ? 's' : ''})` : ''}. Please make your payment immediately to avoid penalties. - ${settings?.companyInfo?.name || 'PHINDU Finance'}`,
                        payment_received: `Dear ${loan.full_name}, we have received your payment. Thank you for your timely payment. Your remaining balance is K${totalOutstanding.toLocaleString()}. - ${settings?.companyInfo?.name || 'PHINDU Finance'}`,
                        penalty_applied: `Dear ${loan.full_name}, a penalty has been applied to your overdue loan. Your updated balance includes the penalty. Please settle immediately to avoid further charges. - ${settings?.companyInfo?.name || 'PHINDU Finance'}`,
                        defaulted_notice: `Dear ${loan.full_name}, your loan has been marked as DEFAULTED due to non-payment. Please contact us immediately to arrange payment and avoid legal proceedings. - ${settings?.companyInfo?.name || 'PHINDU Finance'}`,
                        loan_update: `Dear ${loan.full_name}, there has been an update to your loan (Ref: LOAN-${loan.id.slice(0,8).toUpperCase()}). Please contact us for details. - ${settings?.companyInfo?.name || 'PHINDU Finance'}`,
                        settlement_offer: `Dear ${loan.full_name}, we would like to offer you a settlement arrangement for your loan. Please contact us to discuss the available options. - ${settings?.companyInfo?.name || 'PHINDU Finance'}`,
                        general: "",
                      };
                      setCustomMessage(templates[val] || "");
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                        <SelectItem value="payment_overdue">Payment Overdue</SelectItem>
                        <SelectItem value="payment_received">Payment Received</SelectItem>
                        <SelectItem value="penalty_applied">Penalty Applied</SelectItem>
                        <SelectItem value="defaulted_notice">Defaulted Notice</SelectItem>
                        <SelectItem value="loan_update">Loan Update</SelectItem>
                        <SelectItem value="settlement_offer">Settlement Offer</SelectItem>
                        <SelectItem value="general">Custom Message</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Type your message or select a template above..."
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={!customMessage.trim() || !loan.phone}
                        onClick={async () => {
                          const { sendSMSDirect } = await import('@/utils/sendDirectNotification');
                          await sendSMSDirect(loan.phone, customMessage, messageTemplate || 'Custom Message');
                        }}>
                        <Smartphone size={14} className="mr-1" /> SMS
                      </Button>
                      <Button size="sm" variant="outline" disabled={!customMessage.trim() || !loan.email}
                        onClick={async () => {
                          const { sendEmailDirect } = await import('@/utils/sendDirectNotification');
                          await sendEmailDirect(loan.email, messageTemplate ? messageTemplate.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Loan Update', customMessage);
                        }}>
                        <Mail size={14} className="mr-1" /> Email
                      </Button>
                      <Button size="sm" variant="outline" disabled={!customMessage.trim() || !loan.phone}
                        onClick={async () => {
                          const { sendWhatsAppDirect } = await import('@/utils/sendDirectNotification');
                          await sendWhatsAppDirect(loan.phone, customMessage, messageTemplate || 'Custom Message');
                        }}>
                        <Send size={14} className="mr-1" /> WhatsApp
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Repayments Tab */}
              <TabsContent value="repayments" className="m-0 space-y-4">
                {isPreDisbursement ? (
                  <Card className="border-info/40 bg-info/10">
                    <CardContent className="p-6 text-center space-y-3">
                      <DollarSign size={40} className="mx-auto text-info" />
                      <p className="font-semibold text-lg">No Repayment Schedule Yet</p>
                      <p className="text-sm text-muted-foreground">
                        The repayment schedule will be automatically generated once this loan is disbursed.
                        Go to the Overview tab to disburse this loan.
                      </p>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab("overview")}>
                        Go to Overview
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                <>
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Repayment Schedule</h3>
                  <div className="flex gap-2">
                    {overdueCount > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setIsApplyPenaltiesOpen(true)}>
                        <AlertCircle size={14} className="mr-1" /> Apply Penalties
                      </Button>
                    )}
                    {(!repayments || repayments.length === 0) ? (
                      <Button size="sm" onClick={() => setIsGenerateScheduleOpen(true)}>
                        <Plus size={14} className="mr-1" /> Generate Schedule
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => {
                        const nextPending = repayments.find(r => r.status === "pending");
                        if (nextPending) {
                          setSelectedRepayment(nextPending);
                          setPaymentAmount((nextPending.amount + Math.max(0, (nextPending.penalty_amount || 0) - (nextPending.penalty_paid || 0))).toString());
                          setIsRecordPaymentOpen(true);
                        } else {
                          toast.info("No pending repayments");
                        }
                      }}>
                        <CreditCard size={14} className="mr-1" /> Record Payment
                      </Button>
                    )}
                  </div>
                </div>

                {/* Financial Summary Strip */}
                {repayments && repayments.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                    {[
                      { label: "Principal", value: `K${Number(loan.loan_amount).toLocaleString()}`, color: "text-foreground" },
                      { label: "Total Due", value: `K${Number(loan.total_repayment || 0).toLocaleString()}`, color: "text-foreground" },
                      { label: "Total Paid", value: `K${totalPaidIncludingPartial.toLocaleString()}`, color: totalPaidIncludingPartial > 0 ? "text-success" : "text-muted-foreground" },
                      { label: "Outstanding", value: `K${totalOutstanding.toLocaleString()}`, color: totalOutstanding > 0 ? "text-destructive" : "text-success" },
                      { label: "Penalties", value: `K${totalPenalties.toLocaleString()}`, color: totalPenalties > 0 ? "text-destructive" : "text-muted-foreground" },
                      { label: "Interest", value: `K${Math.max(0, (loan.total_repayment || 0) - loan.loan_amount).toLocaleString()}`, color: "text-muted-foreground" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {repaymentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-primary" size={32} />
                  </div>
                ) : repayments && repayments.length > 0 ? (
                  <>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Outstanding</TableHead>
                          <TableHead>Penalty</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Paid Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repayments.map((rep) => {
                          const today = new Date();
                          const dueDate = new Date(rep.due_date);
                          const isOverdue = rep.status === "pending" && dueDate < today;
                          const isDue = rep.status === "pending" && dueDate.toDateString() === today.toDateString();
                          const isUpcoming = rep.status === "pending" && dueDate > today;
                          const daysOverdue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                          
                          const displayStatus = rep.is_reversed 
                            ? "reversed" 
                            : isOverdue 
                              ? "overdue" 
                              : isDue 
                                ? "due" 
                                : rep.status === "paid"
                                  ? "paid"
                                  : "pending";
                          const totalDue = rep.amount + Math.max(0, (rep.penalty_amount || 0) - (rep.penalty_paid || 0));

                          // Format date based on frequency
                          const dateFormat = isDaily ? "MMM dd, yyyy" : isWeekly ? "MMM dd, yyyy" : "MMM dd, yyyy";
                          const dateDisplay = format(dueDate, dateFormat);

                          return (
                            <TableRow 
                              key={rep.id} 
                              className={
                                isOverdue 
                                  ? "bg-destructive/10 border-l-4 border-l-destructive" 
                                  : isDue 
                                    ? "bg-warning/10 border-l-4 border-l-warning"
                                    : rep.is_reversed 
                                      ? "bg-muted/50 opacity-60" 
                                      : rep.status === "paid"
                                        ? "bg-success/5"
                                        : ""
                              }
                            >
                              <TableCell className="font-medium">{rep.installment_number || "-"}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{dateDisplay}</span>
                                    {isOverdue && (
                                      <Badge variant="destructive" className="text-xs">
                                        <AlertTriangle size={10} className="mr-1" />
                                        {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                                      </Badge>
                                    )}
                                    {isDue && (
                                      <Badge variant="outline" className="text-xs border-warning text-warning">
                                        Due Today
                                      </Badge>
                                    )}
                                  </div>
                                  {isUpcoming && (
                                    <span className="text-xs text-muted-foreground">
                                      {Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} day{Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) !== 1 ? 's' : ''} remaining
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">K{Number(rep.original_amount || rep.amount).toLocaleString()}</TableCell>
                              <TableCell className={rep.principal_paid ? "text-success font-medium" : "text-muted-foreground"}>
                                {rep.principal_paid ? `K${Number(rep.principal_paid).toLocaleString()}` : rep.status === "paid" ? `K${Number(rep.amount).toLocaleString()}` : "-"}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  if (rep.status === "paid" && !rep.is_reversed) return <span className="text-success font-medium">K0</span>;
                                  const instOriginal = Number(rep.original_amount || rep.amount);
                                  const instPaid = Number(rep.principal_paid || 0);
                                  const outstanding = Math.max(0, instOriginal - instPaid);
                                  return <span className={outstanding > 0 ? "text-destructive font-medium" : "text-success font-medium"}>K{outstanding.toLocaleString()}</span>;
                                })()}
                              </TableCell>
                              <TableCell className={rep.penalty_amount ? "text-destructive font-medium" : "text-muted-foreground"}>
                                {rep.penalty_amount ? `K${Number(rep.penalty_amount).toLocaleString()}` : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {getStatusBadge(displayStatus, true)}
                                  {rep.status === "paid" && rep.paid_date && (
                                    <span className="text-xs text-muted-foreground">
                                      Paid: {format(new Date(rep.paid_date), "MMM dd, yyyy")}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {rep.paid_date ? (
                                    <>
                                      <span className="font-medium text-success">
                                        {format(new Date(rep.paid_date), "MMM dd, yyyy")}
                                      </span>
                                      {rep.payment_method && (
                                        <span className="text-xs text-muted-foreground capitalize">
                                          {rep.payment_method.replace('_', ' ')}
                                        </span>
                                      )}
                                      {rep.transaction_reference && (
                                        <span className="text-xs text-muted-foreground font-mono">
                                          Ref: {rep.transaction_reference}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {rep.status === "pending" && !rep.is_reversed && (
                                    <Button
                                      size="sm"
                                      variant={isOverdue ? "destructive" : isDue ? "default" : "outline"}
                                      onClick={() => {
                                        setSelectedRepayment(rep);
                                        setPaymentAmount(totalDue.toString());
                                        setIsRecordPaymentOpen(true);
                                      }}
                                    >
                                      <CheckCircle size={14} className="mr-1" /> 
                                      {isOverdue ? "Pay Overdue" : isDue ? "Pay Now" : "Pay"}
                                    </Button>
                                  )}
                                  {rep.status === "paid" && !rep.is_reversed && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          downloadRepaymentReceipt({
                                            borrowerName: loan.full_name,
                                            borrowerPhone: loan.phone,
                                            borrowerEmail: loan.email,
                                            loanReference: `LOAN-${loan.id.substring(0, 8).toUpperCase()}`,
                                            loanAmount: loan.loan_amount,
                                            repaymentAmount: Number(rep.principal_paid || rep.amount),
                                            paymentDate: rep.paid_date || new Date().toISOString(),
                                            paymentMethod: rep.payment_method || 'cash',
                                            transactionReference: rep.transaction_reference || `TXN-${Date.now()}`,
                                            installmentNumber: rep.installment_number || 1,
                                            totalInstallments: repayments?.length || 1,
                                            totalPaid: totalPaidIncludingPartial,
                                            outstandingBalance: totalOutstanding,
                                            companyName: settings?.companyInfo?.name || 'PHINDU Finance',
                                          });
                                        }}
                                      >
                                        <Download size={14} className="mr-1" /> Receipt
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                          setSelectedPaidRepayment(rep);
                                          setIsReversalOpen(true);
                                        }}
                                      >
                                        <RotateCcw size={14} className="mr-1" /> Reverse
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Payment History — All actual transactions */}
                  {paidRepayments.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <History size={16} /> Payment History ({paidRepayments.length} transaction{paidRepayments.length !== 1 ? 's' : ''})
                      </h3>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date Paid</TableHead>
                              <TableHead>Installment</TableHead>
                              <TableHead>Amount Paid</TableHead>
                              <TableHead>Method</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>Balance After</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paidRepayments
                              .sort((a, b) => new Date(a.paid_date || '').getTime() - new Date(b.paid_date || '').getTime())
                              .map((rep, idx) => {
                                const amountPaid = Number(rep.principal_paid || rep.original_amount || rep.amount);
                                // Running balance: sum of all payments up to this point
                                const runningPaid = paidRepayments
                                  .sort((a, b) => new Date(a.paid_date || '').getTime() - new Date(b.paid_date || '').getTime())
                                  .slice(0, idx + 1)
                                  .reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0);
                                const balanceAfter = Math.max(0, (loan.total_repayment || 0) - runningPaid);
                                return (
                                  <TableRow key={rep.id} className="bg-success/5">
                                    <TableCell className="font-medium text-success">
                                      {rep.paid_date ? format(new Date(rep.paid_date), "MMM dd, yyyy HH:mm") : "-"}
                                    </TableCell>
                                    <TableCell>#{rep.installment_number || "-"}</TableCell>
                                    <TableCell className="font-bold text-success">K{amountPaid.toLocaleString()}</TableCell>
                                    <TableCell className="capitalize">{(rep.payment_method || "cash").replace('_', ' ')}</TableCell>
                                    <TableCell className="font-mono text-xs">{rep.transaction_reference || "-"}</TableCell>
                                    <TableCell className={balanceAfter > 0 ? "text-destructive font-medium" : "text-success font-medium"}>
                                      K{balanceAfter.toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            {/* Total row */}
                            <TableRow className="border-t-2 font-bold">
                              <TableCell colSpan={2}>Total Payments</TableCell>
                              <TableCell className="text-success">K{totalPaidIncludingPartial.toLocaleString()}</TableCell>
                              <TableCell colSpan={2}></TableCell>
                              <TableCell className={totalOutstanding > 0 ? "text-destructive" : "text-success"}>
                                Balance: K{totalOutstanding.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
                ) : (
                  <div className="py-12 text-center">
                    <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Repayment Schedule</h3>
                    <p className="text-muted-foreground mb-4">Generate a repayment schedule for this loan</p>
                    <Button onClick={() => setIsGenerateScheduleOpen(true)}>
                      <Plus size={16} className="mr-2" /> Generate Schedule
                    </Button>
                  </div>
                )}
                </>
                )}
              </TabsContent>

              {/* V1.0.1: Simple Contract Tab */}
              <TabsContent value="contract" className="m-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText size={16} /> Contract
                    </CardTitle>
                    <CardDescription>Generate, upload, or view the contract PDF</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Generated contract */}
                    {(loan as any).contract_url && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                          <FileText size={12} className="mr-1" /> Generated Contract
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from('loan-documents')
                              .createSignedUrl((loan as any).contract_url!, 3600);
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                            else toast.error('Could not load contract');
                          }}
                        >
                          <Eye size={14} className="mr-1" /> View
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleDownloadContract}>
                          <Download size={14} className="mr-1" /> Download
                        </Button>
                      </div>
                    )}

                    {/* Generate & Store button */}
                    <Button
                      size="sm"
                      variant={(loan as any).contract_url ? "outline" : "default"}
                      onClick={async () => {
                        toast.info('Generating contract...');
                        const path = await uploadContractAndSaveUrl(loan as any);
                        if (path) {
                          queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
                          queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
                          queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
                          toast.success('Contract generated and stored. All staff will now see this version.');
                        } else {
                          toast.error('Failed to generate contract');
                        }
                      }}
                    >
                      <FileText size={14} className="mr-1" />
                      {(loan as any).contract_url ? 'Regenerate Contract' : 'Generate & Store Contract'}
                    </Button>

                    {/* Signed contract */}
                    {loan.signed_contract_url ? (
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          <CheckCircle size={12} className="mr-1" /> Signed contract uploaded
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from('loan-documents')
                              .createSignedUrl(loan.signed_contract_url!, 3600);
                            if (data?.signedUrl) setSignaturePreviewUrl(data.signedUrl);
                            else toast.error('Could not load contract');
                          }}
                        >
                          <Download size={14} className="mr-1" /> View Signed
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No signed contract uploaded yet.</p>
                    )}

                    {/* Contract upload removed — manual contract workflow */}
                  </CardContent>
                </Card>

                {/* Admin Notes */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Admin Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes about this loan..."
                      rows={4}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveNotesMutation.mutate()}
                      disabled={saveNotesMutation.isPending}
                    >
                      {saveNotesMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                      Save Notes
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Loan History Tab */}
              <TabsContent value="history" className="m-0 space-y-4">
                {/* Loan Chain (for reloans) */}
                <LoanChain
                  loanId={loan.id}
                  parentLoanId={(loan as any).parent_loan_id}
                  onViewLoan={(id) => {
                    // Close current and signal parent to open the other loan
                    toast.info(`Navigate to loan ${id.slice(0, 8).toUpperCase()} from the Loans list.`);
                  }}
                />

                {/* Full event timeline */}
                <LoanHistoryTimeline
                  loanId={loan.id}
                  onViewLoan={(id) => {
                    toast.info(`Navigate to loan ${id.slice(0, 8).toUpperCase()} from the Loans list.`);
                  }}
                />
              </TabsContent>

              {/* V1.0.1: Actions and History tabs removed - functionality available through Overview quick actions and Contract tab */}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog - Enhanced with partial/overpayment */}
      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard size={20} /> Record Payment
            </DialogTitle>
            <DialogDescription>
              Record a payment for installment #{selectedRepayment?.installment_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Original Installment</span>
                <span className="font-medium">K{Number(selectedRepayment?.original_amount || selectedRepayment?.amount || 0).toLocaleString()}</span>
              </div>
              {selectedRepayment?.principal_paid && Number(selectedRepayment.principal_paid) > 0 && (
                <div className="flex justify-between text-success">
                  <span className="text-sm">Already Paid</span>
                  <span className="font-medium">K{Number(selectedRepayment.principal_paid).toLocaleString()}</span>
                </div>
              )}
              {selectedRepayment?.penalty_amount && selectedRepayment.penalty_amount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span className="text-sm">Penalty</span>
                  <span className="font-medium">K{Number(selectedRepayment.penalty_amount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-medium">Total Due</span>
                <span className="text-lg font-bold">
                  K{((selectedRepayment?.amount || 0) + (selectedRepayment?.penalty_amount || 0)).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Due: {selectedRepayment?.due_date ? format(new Date(selectedRepayment.due_date), "MMM dd, yyyy") : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Amount to Pay</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter payment amount"
              />
              <p className="text-xs text-muted-foreground">
                Pay less for partial payment • Pay more for advance payment
              </p>
            </div>

            {paymentAmount && Number(paymentAmount) !== (selectedRepayment?.amount || 0) + (selectedRepayment?.penalty_amount || 0) && (
              <div className={`p-3 rounded-lg border ${Number(paymentAmount) < ((selectedRepayment?.amount || 0) + (selectedRepayment?.penalty_amount || 0)) ? "bg-warning/10 border-warning/20" : "bg-info/10 border-info/20"}`}>
                <div className="flex items-center gap-2">
                  {Number(paymentAmount) < ((selectedRepayment?.amount || 0) + (selectedRepayment?.penalty_amount || 0)) ? (
                    <>
                      <AlertTriangle size={16} className="text-warning" />
                      <div>
                        <p className="text-sm font-medium">Partial Payment</p>
                        <p className="text-xs text-muted-foreground">
                          Remaining K{(((selectedRepayment?.amount || 0) + (selectedRepayment?.penalty_amount || 0)) - Number(paymentAmount)).toLocaleString()} will stay pending
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ArrowRight size={16} className="text-info" />
                      <div>
                        <p className="text-sm font-medium">Overpayment</p>
                        <p className="text-xs text-muted-foreground">
                          Excess K{(Number(paymentAmount) - ((selectedRepayment?.amount || 0) + (selectedRepayment?.penalty_amount || 0))).toLocaleString()} will be applied to next installment
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="deduction">Salary Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transaction Reference (Optional)</Label>
              <Input
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g., Receipt #, Transaction ID"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)}>Cancel</Button>
              <Button
                onClick={() => recordPaymentMutation.mutate()}
                disabled={recordPaymentMutation.isPending || !paymentAmount || Number(paymentAmount) <= 0}
              >
                {recordPaymentMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : <CheckCircle size={14} className="mr-1" />}
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Reversal Dialog */}
      <Dialog open={isReversalOpen} onOpenChange={setIsReversalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw size={20} /> Reverse Payment
            </DialogTitle>
            <DialogDescription>
              Reverse payment for installment #{selectedPaidRepayment?.installment_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Payment Amount</p>
              <p className="text-xl font-bold">K{Number(selectedPaidRepayment?.amount || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                Paid: {selectedPaidRepayment?.paid_date ? format(new Date(selectedPaidRepayment.paid_date), "MMM dd, yyyy") : ""}
                {selectedPaidRepayment?.payment_method && ` via ${selectedPaidRepayment.payment_method.replace("_", " ")}`}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Warning</p>
                  <p className="text-xs text-muted-foreground">
                    This will revert the payment to pending status. Use this only for corrections or if the payment was recorded in error.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason for Reversal *</Label>
              <Textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Explain why this payment is being reversed..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsReversalOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => reversePaymentMutation.mutate()}
                disabled={reversePaymentMutation.isPending || !reversalReason}
              >
                {reversePaymentMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : <RotateCcw size={14} className="mr-1" />}
                Reverse Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Early Settlement Dialog */}
      <Dialog open={isEarlySettlementOpen} onOpenChange={setIsEarlySettlementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator size={20} /> Early Settlement
            </DialogTitle>
            <DialogDescription>
              Calculate and process early loan payoff
            </DialogDescription>
          </DialogHeader>
          {earlySettlement && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Outstanding Principal</span>
                  <span className="font-medium">K{Number(earlySettlement.outstanding_principal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Outstanding Interest</span>
                  <span className="font-medium">K{Number(earlySettlement.outstanding_interest).toLocaleString()}</span>
                </div>
                {earlySettlement.total_penalties > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span className="text-sm">Accumulated Penalties</span>
                    <span className="font-medium">K{Number(earlySettlement.total_penalties).toLocaleString()}</span>
                  </div>
                )}
                {earlySettlement.early_settlement_fee > 0 && (
                  <div className="flex justify-between text-warning">
                    <span className="text-sm">Early Settlement Fee</span>
                    <span className="font-medium">K{Number(earlySettlement.early_settlement_fee).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="font-semibold">Total Payoff Amount</span>
                  <span className="text-xl font-bold text-primary">
                    K{Number(earlySettlement.total_payoff_amount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-info/10 border border-info/20">
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-info mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Process Settlement</p>
                    <p className="text-xs text-muted-foreground">
                      Clicking "Process Settlement" will mark all pending repayments as paid and close the loan.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsEarlySettlementOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => processEarlySettlementMutation.mutate()}
                  disabled={processEarlySettlementMutation.isPending}
                >
                  {processEarlySettlementMutation.isPending ? (
                    <Loader2 className="animate-spin mr-1" size={14} />
                  ) : (
                    <CheckCircle size={14} className="mr-1" />
                  )}
                  Process Settlement
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Apply Penalties Confirmation */}
      <AlertDialog open={isApplyPenaltiesOpen} onOpenChange={setIsApplyPenaltiesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Penalties</AlertDialogTitle>
            <AlertDialogDescription>
              This will calculate and apply late payment penalties to all overdue installments based on the loan product's penalty rate.
              There are currently {overdueCount} overdue installments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => applyPenaltiesMutation.mutate()}
              disabled={applyPenaltiesMutation.isPending}
            >
              {applyPenaltiesMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
              Apply Penalties
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restructure Dialog */}
      <Dialog open={isRestructureOpen} onOpenChange={setIsRestructureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw size={20} /> Restructure Loan
            </DialogTitle>
            <DialogDescription>
              Modify the loan terms. This will regenerate the pending repayment schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Term (Months)</Label>
                <Input
                  type="number"
                  value={newTermMonths}
                  onChange={(e) => setNewTermMonths(e.target.value)}
                  placeholder={loan.loan_term_months.toString()}
                />
              </div>
              <div className="space-y-2">
                <Label>New Interest Rate (%)</Label>
                <Input
                  type="number"
                  value={newInterestRate}
                  onChange={(e) => setNewInterestRate(e.target.value)}
                  placeholder={loan.interest_rate.toString()}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason for Restructuring *</Label>
              <Textarea
                value={restructureReason}
                onChange={(e) => setRestructureReason(e.target.value)}
                placeholder="Explain why this loan is being restructured..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsRestructureOpen(false)}>Cancel</Button>
              <Button
                onClick={() => restructureLoanMutation.mutate()}
                disabled={restructureLoanMutation.isPending || !restructureReason}
              >
                {restructureLoanMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : <RefreshCw size={14} className="mr-1" />}
                Restructure Loan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Schedule Confirmation */}
      <AlertDialog open={isGenerateScheduleOpen} onOpenChange={setIsGenerateScheduleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Repayment Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a repayment schedule of {loan.loan_term_months} monthly installments of K{Number(loan.monthly_payment || loan.total_repayment / loan.loan_term_months).toLocaleString()} each.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => generateScheduleMutation.mutate()}>
              {generateScheduleMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo Disbursement Confirmation */}
      <AlertDialog open={isUndoDisbursementOpen} onOpenChange={setIsUndoDisbursementOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Undo Disbursement</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the disbursement record and all repayment schedules. The loan will be reverted to "Approved" status. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => undoDisbursementMutation.mutate()}
            >
              {undoDisbursementMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
              Undo Disbursement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contract Notes Dialog */}
      <Dialog open={isContractEditOpen} onOpenChange={setIsContractEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit size={20} /> Contract Notes
            </DialogTitle>
            <DialogDescription>
              Add amendments or notes to the loan contract
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contract No</span>
                <span className="font-medium">PCS-{loan.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Borrower</span>
                <span className="font-medium">{loan.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan Amount</span>
                <span className="font-medium">K{Number(loan.loan_amount).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contract Amendment/Notes</Label>
              <Textarea
                value={contractNotes}
                onChange={(e) => setContractNotes(e.target.value)}
                placeholder="Enter any contract amendments, modifications or notes here. These will be saved to the admin notes..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                These notes will be appended to the admin notes and can be referenced when generating new contracts.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsContractEditOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const newNote = `[CONTRACT NOTE ${format(new Date(), "yyyy-MM-dd")}]: ${contractNotes}`;
                  setAdminNotes((prev) => `${prev}\n\n${newNote}`);
                  saveNotesMutation.mutate();
                  setIsContractEditOpen(false);
                  setContractNotes("");
                  toast.success("Contract notes saved");
                }}
                disabled={!contractNotes.trim() || saveNotesMutation.isPending}
              >
                {saveNotesMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signature/Contract Preview Dialog */}
      <Dialog open={!!signaturePreviewUrl} onOpenChange={(open) => { if (!open) setSignaturePreviewUrl(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={20} /> Signed Contract / Signature
            </DialogTitle>
            <DialogDescription>
              Preview of the borrower's signed contract or signature
            </DialogDescription>
          </DialogHeader>
          {signaturePreviewUrl && (
            <div className="flex-1 overflow-auto max-h-[70vh]">
              {signaturePreviewUrl.includes('.pdf') ? (
                <iframe
                  src={signaturePreviewUrl}
                  className="w-full h-[65vh] rounded-lg border border-border"
                  title="Contract Preview"
                />
              ) : (
                <img
                  src={signaturePreviewUrl}
                  alt="Borrower Signature"
                  className="max-w-full max-h-[65vh] mx-auto rounded-lg border border-border"
                />
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSignaturePreviewUrl(null)}>
              Close
            </Button>
            {signaturePreviewUrl && (
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = signaturePreviewUrl;
                  link.download = `signed_contract_${loan.id.slice(0,8)}`;
                  link.click();
                }}
              >
                <Download size={14} className="mr-1" /> Download
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reloan Confirmation Dialog */}
      <AlertDialog open={isReloanOpen} onOpenChange={setIsReloanOpen}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRight size={20} /> Reloan — {loan.full_name}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {/* Financial Breakdown */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                  <h4 className="font-semibold text-foreground">Loan Financial Summary</h4>
                  <div className="grid grid-cols-2 gap-y-1">
                    <span className="text-muted-foreground">Original Principal</span>
                    <span className="text-right font-medium">K{Number(loan.loan_amount).toLocaleString()}</span>
                    <span className="text-muted-foreground">Total Due (incl. interest)</span>
                    <span className="text-right font-medium">K{Number(loan.total_repayment || 0).toLocaleString()}</span>
                    <span className="text-muted-foreground">Total Paid</span>
                    <span className="text-right font-medium text-success">K{totalPaidIncludingPartial.toLocaleString()}</span>
                    <span className="text-muted-foreground font-semibold">Outstanding Balance</span>
                    <span className="text-right font-bold text-destructive">K{totalOutstanding.toLocaleString()}</span>
                    <span className="text-muted-foreground">Outstanding Penalties (unpaid)</span>
                    <span className={`text-right font-medium ${totalPenalties > 0 ? "text-destructive" : ""}`}>K{totalPenalties.toLocaleString()}</span>
                  </div>
                </div>

                {/* Eligibility Checks */}
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <h4 className="font-semibold text-foreground">Eligibility Check</h4>
                  <div className="space-y-1.5">
                    {totalPenalties > 0 ? (
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle size={16} /> Outstanding penalties of K{totalPenalties.toLocaleString()} — must be cleared
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle size={16} /> No outstanding penalties — eligible
                      </div>
                    )}
                    {totalOutstanding <= 0 ? (
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle size={16} /> No outstanding balance — nothing to reloan
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle size={16} /> Outstanding balance K{totalOutstanding.toLocaleString()} — will carry forward as new principal
                      </div>
                    )}
                  </div>
                </div>

                {/* New Loan Terms */}
                {totalOutstanding > 0 && totalPenalties === 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2 text-sm">
                    <h4 className="font-semibold text-foreground">New Reloan Terms</h4>
                    <p className="text-xs text-muted-foreground">
                      Rule set: carry-forward outstanding is always included; optional extra cash can be added and disbursed net of fees from a selected source account.
                    </p>
                    <div className="space-y-2 pt-1">
                      <Label className="text-xs">Optional Extra Cash Top-Up (K)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0 (keep outstanding-only reloan)"
                        value={reloanTopUpAmount}
                        onChange={(e) => setReloanTopUpAmount(e.target.value)}
                      />
                    </div>
                    {reloanTopUpNumeric > 0 && (
                      <>
                        <div className="space-y-2 pt-1">
                          <Label className="text-xs">Top-Up Source Account *</Label>
                          <Select value={reloanSourceAccountId} onValueChange={setReloanSourceAccountId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select source account" />
                            </SelectTrigger>
                            <SelectContent>
                              {(fundingAccounts ?? []).map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  {acc.account_name} ({acc.account_type}) - K{Number(acc.balance).toLocaleString()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 pt-1">
                          <Label className="text-xs">Reason (Optional)</Label>
                          <Input
                            placeholder="Why extra cash is added to this reloan"
                            value={reloanReason}
                            onChange={(e) => setReloanReason(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-y-1">
                      <span className="text-muted-foreground">Carry-forward Outstanding</span>
                      <span className="text-right font-medium">K{totalOutstanding.toLocaleString()}</span>
                      <span className="text-muted-foreground">Optional Top-Up</span>
                      <span className="text-right font-medium">K{reloanTopUpNumeric.toLocaleString()}</span>
                      <span className="text-muted-foreground font-semibold">Projected New Principal</span>
                      <span className="text-right font-bold">K{reloanProjectedPrincipal.toLocaleString()}</span>
                      <span className="text-muted-foreground">Term</span>
                      <span className="text-right font-medium">{loan.loan_term_months} months @ {loan.interest_rate}%</span>
                      <span className="text-muted-foreground">Disbursement</span>
                      <span className="text-right font-medium">{reloanTopUpNumeric > 0 ? "Optional top-up net disbursement after fees" : "None — funds already with borrower"}</span>
                    </div>
                  </div>
                )}

                <p className="text-sm font-medium text-warning">This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reloanMutation.mutate()}
              disabled={reloanMutation.isPending || totalPenalties > 0 || totalOutstanding <= 0 || (reloanTopUpNumeric > 0 && !reloanSourceAccountId)}
            >
              {reloanMutation.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
              Confirm Reloan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Top-Up Dialog */}
      <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={20} /> Top Up Loan — {loan.full_name}
            </DialogTitle>
            <DialogDescription>
              Add funds to the existing loan. The principal will increase, schedule will be recalculated, and the net amount disbursed from the selected account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Current Principal</span><span className="font-medium">K{Number(loan.loan_amount).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Current Monthly</span><span className="font-medium">K{Number(loan.monthly_payment).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Term</span><span className="font-medium">{loan.loan_term_months} months</span></div>
            </div>

            <div>
              <Label>Additional Amount (K)</Label>
              <Input type="number" placeholder="e.g. 2000" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} min="1" />
              {topUpAmount && Number(topUpAmount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  New principal will be K{(loan.loan_amount + Number(topUpAmount)).toLocaleString()}
                </p>
              )}
            </div>

            <div>
              <Label>Source Account</Label>
              <Select value={topUpSourceAccountId} onValueChange={setTopUpSourceAccountId}>
                <SelectTrigger><SelectValue placeholder="Select funding account" /></SelectTrigger>
                <SelectContent>
                  {(fundingAccounts ?? []).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name} ({acc.account_type}) — K{Number(acc.balance).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason for Top-Up</Label>
              <Textarea placeholder="Why is the borrower requesting additional funds?" value={topUpReason} onChange={(e) => setTopUpReason(e.target.value)} rows={2} />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsTopUpOpen(false)}>Cancel</Button>
              <Button
                onClick={() => topUpMutation.mutate()}
                disabled={topUpMutation.isPending || !topUpAmount || !topUpSourceAccountId}
              >
                {topUpMutation.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
                Confirm Top-Up
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disburse Funds Dialog */}
      <Dialog open={isDisburseOpen} onOpenChange={setIsDisburseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote size={20} /> Disburse Loan — {loan.full_name}
            </DialogTitle>
            <DialogDescription>
              Select a source account and confirm disbursement. Fees will be deducted from the principal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Fee Breakdown */}
            {(() => {
              const principal = loan.loan_amount;
              // Show fee estimate (will be recalculated on submit with fresh product data)
              return (
                <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Principal</span>
                    <span className="font-bold">K{Number(principal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Term</span>
                    <span className="font-medium">{loan.loan_term_months} {termUnit} @ {loan.interest_rate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Repayment</span>
                    <span className="font-medium">K{Number(loan.total_repayment).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Processing fees, insurance, enforcement fees, and VAT will be deducted from the principal. The net amount will be disbursed.
                  </p>
                </div>
              );
            })()}

            <div>
              <Label>Source Account *</Label>
              <Select value={disburseSourceAccountId} onValueChange={setDisburseSourceAccountId}>
                <SelectTrigger><SelectValue placeholder="Select funding account" /></SelectTrigger>
                <SelectContent>
                  {(fundingAccounts ?? []).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name} ({acc.account_type}) — K{Number(acc.balance).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Disbursement Method</Label>
              <Select value={disburseMethod} onValueChange={setDisburseMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Transaction Reference (Optional)</Label>
              <Input
                value={disburseTransactionRef}
                onChange={(e) => setDisburseTransactionRef(e.target.value)}
                placeholder="e.g., Bank ref, receipt number"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDisburseOpen(false)}>Cancel</Button>
              <Button
                onClick={() => disburseLoanFromDetailMutation.mutate()}
                disabled={disburseLoanFromDetailMutation.isPending || !disburseSourceAccountId}
              >
                {disburseLoanFromDetailMutation.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
                <Banknote size={14} className="mr-1" /> Confirm Disbursement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
