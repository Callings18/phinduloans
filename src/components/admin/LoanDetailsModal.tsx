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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Allowed next stages per current status (Move to). Same sections for all loans; only these buttons vary. */
const ALLOWED_NEXT_STATUSES: Record<string, string[]> = {
  pending: ["under_review", "rejected"],
  under_review: ["approved", "rejected", "crb_failed", "pmic_pending"],
  approved: ["contract_signing"],
  contract_signing: [],
  awaiting_disbursement: [],
  disbursed: ["active"],
  active: ["defaulted"], // "completed" is removed — auto-set when fully paid with signed contract
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
  job_title?: string | null;
  admin_notes?: string | null;
  total_penalties?: number;
  settlement_date?: string | null;
  settlement_type?: string | null;
  early_settlement_fee?: number;
  loan_product_id?: string | null;
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
  const { user } = useAuth();
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

  // Phase 1 new states
  const [isReversalOpen, setIsReversalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [selectedPaidRepayment, setSelectedPaidRepayment] = useState<Repayment | null>(null);
  const [isEarlySettlementOpen, setIsEarlySettlementOpen] = useState(false);
  const [earlySettlement, setEarlySettlement] = useState<EarlySettlement | null>(null);
  const [isApplyPenaltiesOpen, setIsApplyPenaltiesOpen] = useState(false);
  const [isContractEditOpen, setIsContractEditOpen] = useState(false);
  const [contractNotes, setContractNotes] = useState("");
  const [signedContractFile, setSignedContractFile] = useState<File | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: settings } = useSystemSettings();

  // Fetch loan product to determine payment frequency
  const { data: loanProduct } = useQuery({
    queryKey: ["loan-product", loan?.loan_product_id],
    queryFn: async () => {
      if (!loan?.loan_product_id) return null;
      const { data, error } = await supabase
        .from("loan_products")
        .select("term_unit, interest_period, repayment_frequency")
        .eq("id", loan.loan_product_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!loan?.loan_product_id,
  });

  // Fetch repayments with new columns
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

  // Calculate penalty for overdue payments
  const calculatePenalty = (repayment: Repayment, penaltyRate: number = 5): number => {
    if (repayment.status !== "pending") return 0;
    const daysOverdue = differenceInDays(new Date(), new Date(repayment.due_date));
    if (daysOverdue <= 0) return 0;
    const monthsOverdue = Math.ceil(daysOverdue / 30);
    return repayment.amount * (penaltyRate / 100) * monthsOverdue;
  };

  // Enhanced record payment mutation with partial/overpayment support
  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRepayment || !loan) throw new Error("No repayment selected");

      const paidAmount = Number(paymentAmount) || selectedRepayment.amount;
      const dueAmount = selectedRepayment.amount + (selectedRepayment.penalty_amount || 0);

      // Calculate allocation (penalty first, then principal/interest)
      const penaltyPaid = Math.min(paidAmount, selectedRepayment.penalty_amount || 0);
      const remainingAfterPenalty = paidAmount - penaltyPaid;

      // Simple allocation: remaining goes to principal (for simplicity)
      const principalPaid = remainingAfterPenalty;

      let newStatus = "pending";
      let adjustedAmount = selectedRepayment.amount;

      if (paidAmount >= dueAmount) {
        // Full payment or overpayment
        newStatus = "paid";

        // Handle overpayment - apply to next pending installment
        if (paidAmount > dueAmount) {
          const excess = paidAmount - dueAmount;
          const nextPending = repayments?.find(
            r => r.status === "pending" && r.id !== selectedRepayment.id
          );

          if (nextPending) {
            // Apply excess to next installment
            const newNextAmount = Math.max(0, nextPending.amount - excess);
            await supabase
              .from("loan_repayments")
              .update({
                amount: newNextAmount,
                original_amount: nextPending.original_amount || nextPending.amount
              })
              .eq("id", nextPending.id);
          }
        }
      } else {
        // Partial payment - reduce amount owed
        adjustedAmount = selectedRepayment.amount - remainingAfterPenalty;
        newStatus = adjustedAmount > 0 ? "pending" : "paid";
      }

      const { error } = await supabase
        .from("loan_repayments")
        .update({
          status: newStatus,
          paid_date: newStatus === "paid" ? new Date().toISOString().split("T")[0] : null,
          payment_method: paymentMethod,
          transaction_reference: transactionRef || null,
          amount: newStatus === "paid" ? selectedRepayment.amount : adjustedAmount,
          principal_paid: principalPaid,
          penalty_paid: penaltyPaid,
          original_amount: selectedRepayment.original_amount || selectedRepayment.amount,
        })
        .eq("id", selectedRepayment.id);

      if (error) throw error;

      // Check if all repayments are paid to mark loan as completed
      const { data: remainingPending } = await supabase
        .from("loan_repayments")
        .select("id")
        .eq("loan_id", loan.id)
        .eq("status", "pending");

      if (remainingPending && remainingPending.length === 0) {
        // Only auto-complete if contract is fully signed
        const { data: loanData } = await supabase
          .from("loan_applications")
          .select("borrower_signed, admin_signed")
          .eq("id", loan.id)
          .single();

        if (loanData?.borrower_signed && loanData?.admin_signed) {
          await supabase
            .from("loan_applications")
            .update({ status: "completed" as any })
            .eq("id", loan.id);
        } else {
          toast.info("All payments complete, but loan cannot be closed until the contract is signed by both parties.");
        }
      }

      return { paidAmount, isPartial: paidAmount < dueAmount, isOverpayment: paidAmount > dueAmount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });

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
        await supabase
          .from("loan_applications")
          .update({ status: "active" })
          .eq("id", loan.id);
      }

      // Log the reversal
      await supabase.from("collection_activities").insert({
        loan_id: loan.id,
        activity_type: "payment_reversal",
        notes: `Payment of K${selectedPaidRepayment.amount.toLocaleString()} reversed. Reason: ${reversalReason}`,
        outcome: "Payment reverted to pending",
      });
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

      // Mark all pending repayments as paid
      const { error: repaymentError } = await supabase
        .from("loan_repayments")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
          payment_method: "early_settlement",
        })
        .eq("loan_id", loan.id)
        .eq("status", "pending");

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

  const uploadSignedContractMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!loan) throw new Error("No loan selected");
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const fileName = `contracts/signed_${loan.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(fileName, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({
          signed_contract_url: fileName,
          borrower_signed: true,
          borrower_signed_at: now,
          signed_contract_uploaded_at: now,
        })
        .eq("id", loan.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      setSignedContractFile(null);
      toast.success("Signed contract uploaded");
    },
    onError: (err: any) => {
      toast.error(err.message || "Upload failed");
    },
  });

  // Restructure loan mutation
  const restructureLoanMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");

      const newTerm = Number(newTermMonths) || loan.loan_term_months;
      const newRate = Number(newInterestRate) || loan.interest_rate;

      // Recalculate loan
      const principal = loan.loan_amount;
      const interest = principal * (newRate / 100) * newTerm;
      const newTotal = principal + interest;
      const newMonthly = newTotal / newTerm;

      // Update loan
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          loan_term_months: newTerm,
          interest_rate: newRate,
          total_repayment: newTotal,
          monthly_payment: newMonthly,
          admin_notes: `${loan.admin_notes || ""}\n\n[RESTRUCTURED ${format(new Date(), "yyyy-MM-dd")}]: ${restructureReason}\nNew terms: ${newTerm} months @ ${newRate}%`,
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

      // Generate new schedule
      const repaymentRecords = [];
      const startDate = new Date();

      for (let i = 1; i <= remainingInstallments; i++) {
        repaymentRecords.push({
          loan_id: loan.id,
          user_id: loan.user_id,
          amount: newMonthly,
          due_date: format(addMonths(startDate, i), "yyyy-MM-dd"),
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
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

      // Delete disbursement record
      await supabase
        .from("disbursements")
        .delete()
        .eq("loan_id", loan.id);

      // Delete all repayments
      await supabase
        .from("loan_repayments")
        .delete()
        .eq("loan_id", loan.id);

      // Revert loan status to approved
      const { error } = await supabase
        .from("loan_applications")
        .update({ status: "approved" })
        .eq("id", loan.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["loan-disbursement", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Disbursement undone - loan reverted to approved status");
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
  const reversedRepayments = repayments?.filter(r => r.is_reversed) || [];
  const totalPaid = paidRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPenalties = pendingRepayments.reduce((sum, r) => sum + Number(r.penalty_amount || 0), 0);
  const progressPercentage = loan.total_repayment > 0 ? (totalPaid / loan.total_repayment) * 100 : 0;
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

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      active: { color: "bg-success/20 text-success border-success/30", icon: Activity },
      disbursed: { color: "bg-info/20 text-info border-info/30", icon: Banknote },
      completed: { color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle },
      defaulted: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
      pending: { color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
      awaiting_disbursement: { color: "bg-info/20 text-info border-info/30", icon: DollarSign },
      paid: { color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
      overdue: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: AlertTriangle },
      reversed: { color: "bg-muted text-muted-foreground border-muted", icon: RotateCcw },
    };
    const { color, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        <Icon size={12} className="mr-1" />
        {getCanonicalStatusLabel(status)}
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
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="overview" className="text-xs">
                <TrendingUp size={14} className="mr-1 hidden sm:inline" /> Overview
              </TabsTrigger>
              <TabsTrigger value="repayments" className="text-xs">
                <Receipt size={14} className="mr-1 hidden sm:inline" /> Repayments
              </TabsTrigger>
              <TabsTrigger value="contract" className="text-xs">
                <FileText size={14} className="mr-1 hidden sm:inline" /> Contract
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

                {/* Progress */}
                {repayments && repayments.length > 0 && (
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
                        <span className="text-success">Paid: K{totalPaid.toLocaleString()}</span>
                        <span className="text-muted-foreground">
                          Remaining: K{(loan.total_repayment - totalPaid + totalPenalties).toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Alerts */}
                <div className="flex flex-wrap gap-3">
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
                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
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
                          setPaymentAmount((nextPending.amount + (nextPending.penalty_amount || 0)).toString());
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
                    <Button size="sm" variant="outline" onClick={() => setIsRestructureOpen(true)}>
                      <RefreshCw size={14} className="mr-1" /> Restructure
                    </Button>
                    {(loan.status === "disbursed" || loan.status === "active") && paidRepayments.length === 0 && (
                      <Button size="sm" variant="destructive" onClick={() => setIsUndoDisbursementOpen(true)}>
                        <Undo2 size={14} className="mr-1" /> Undo Disbursement
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* V1.0.1: Simple contract status indicator */}
                {(loan.status === "approved" || loan.status === "contract_signing" || loan.status === "disbursed" || loan.status === "active" || loan.status === "completed" || loan.signed_contract_url) && (
                  <Card className={`border ${loan.signed_contract_url ? "border-success/50 bg-success/5" : "border-warning/50 bg-warning/5"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText size={18} className={loan.signed_contract_url ? "text-success" : "text-warning"} />
                          <div>
                            <p className="font-medium text-sm">Signed Contract</p>
                            <p className="text-xs text-muted-foreground">
                              {loan.signed_contract_url ? "Contract uploaded" : "No contract uploaded yet"}
                            </p>
                          </div>
                        </div>
                        {loan.signed_contract_url ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                            <CheckCircle size={12} className="mr-1" /> Uploaded
                          </Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setActiveTab("contract")}>
                            <Upload size={14} className="mr-1" /> Upload
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Repayments Tab */}
              <TabsContent value="repayments" className="m-0 space-y-4">
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
                          setPaymentAmount((nextPending.amount + (nextPending.penalty_amount || 0)).toString());
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

                {repaymentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-primary" size={32} />
                  </div>
                ) : repayments && repayments.length > 0 ? (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Penalty</TableHead>
                          <TableHead>Total Due</TableHead>
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
                          const totalDue = rep.amount + (rep.penalty_amount || 0);

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
                              <TableCell className="font-medium">K{Number(rep.amount).toLocaleString()}</TableCell>
                              <TableCell className={rep.penalty_amount ? "text-destructive font-medium" : "text-muted-foreground"}>
                                {rep.penalty_amount ? `K${Number(rep.penalty_amount).toLocaleString()}` : "-"}
                              </TableCell>
                              <TableCell className="font-bold">K{totalDue.toLocaleString()}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {getStatusBadge(displayStatus)}
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
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
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
              </TabsContent>

              {/* V1.0.1: Simple Contract Tab */}
              <TabsContent value="contract" className="m-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText size={16} /> Contract
                    </CardTitle>
                    <CardDescription>Upload or view the signed contract PDF</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loan.signed_contract_url ? (
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          <CheckCircle size={12} className="mr-1" /> Contract uploaded
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
                          <Download size={14} className="mr-1" /> View
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No contract uploaded yet.</p>
                    )}

                    {/* Upload */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Upload Signed Contract</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="max-w-[280px]"
                          onChange={(e) => setSignedContractFile(e.target.files?.[0] || null)}
                        />
                        {signedContractFile && (
                          <Button
                            size="sm"
                            onClick={() => uploadSignedContractMutation.mutate(signedContractFile)}
                            disabled={uploadSignedContractMutation.isPending}
                          >
                            {uploadSignedContractMutation.isPending ? (
                              <Loader2 size={14} className="animate-spin mr-1" />
                            ) : (
                              <Upload size={14} className="mr-1" />
                            )}
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
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
                <span className="text-sm text-muted-foreground">Principal Amount</span>
                <span className="font-medium">K{Number(selectedRepayment?.amount || 0).toLocaleString()}</span>
              </div>
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
    </>
  );
}
