import { useState, useEffect, useCallback } from "react";
import { LoanProductFilterSelect } from "@/components/admin/LoanProductFilterSelect";
import { BetaBadge } from "@/components/admin/BetaBadge";
import { useLoanProductFilter } from "@/hooks/useLoanProductFilter";
import { isBetaModule } from "@/config/featureRollout";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { downloadLoanSchedule } from "@/utils/generateLoanSchedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAudit } from "@/utils/auditLog";
import { usePermissions } from "@/hooks/usePermissions";
import {
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  User,
  Activity,
  Edit,
  MoreHorizontal,
  Download,
  Receipt,
  Phone,
  Building,
  Banknote,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LoanDetailsModal from "@/components/admin/LoanDetailsModal";
import PaginationControls from "@/components/common/PaginationControls";
import { useAuth } from "@/hooks/useAuth";
import { createRepaymentScheduleForLoan } from "@/utils/createRepaymentSchedule";

interface Loan {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  nrc_number: string;
  address: string | null;
  city: string | null;
  loan_amount: number;
  loan_term_months: number;
  term_unit: string;
  interest_rate: number;
  total_repayment: number;
  monthly_payment: number;
  monthly_income: number;
  status: string;
  created_at: string;
  loan_purpose: string;
  employment_type: string;
  employer_name: string | null;
  job_title: string | null;
  collateral_description: string | null;
  collateral_value: number | null;
  admin_notes: string | null;
  loan_product_id: string | null;
  assigned_to: string | null;
  contract_url: string | null;
  signed_contract_url: string | null;
  signed_contract_uploaded_at: string | null;
  borrower_signed: boolean | null;
  borrower_signed_at: string | null;
  admin_signed: boolean | null;
  admin_signed_at: string | null;
  contract_fully_signed_at: string | null;
}

interface LoanProduct {
  id: string;
  name: string;
  interest_rate: number;
  processing_fee_percent: number | null;
  enforcement_fee_percent?: number | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  awaiting_disbursement: { label: "Awaiting Disbursement", color: "bg-warning/20 text-warning border-warning/30", icon: Banknote },
  approved: { label: "Approved", color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
  disbursed: { label: "Disbursed", color: "bg-accent/20 text-accent-foreground border-accent/30", icon: Activity },
  active: { label: "Active", color: "bg-info/20 text-info border-info/30", icon: Activity },
  completed: { label: "Completed", color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle },
  defaulted: { label: "Defaulted", color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
};

const AdminLoans = () => {
  const [activeTab, setActiveTab] = useState("awaiting_disbursement");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Edit Loan Form State
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [editLoanAmount, setEditLoanAmount] = useState("");
  const [editLoanTermMonths, setEditLoanTermMonths] = useState("");
  const [editInterestRate, setEditInterestRate] = useState("");
  const [editMonthlyIncome, setEditMonthlyIncome] = useState("");
  const [editLoanPurpose, setEditLoanPurpose] = useState("");
  const [editAdminNotes, setEditAdminNotes] = useState("");
  const [editEmploymentType, setEditEmploymentType] = useState("");

  // Quick Payment State
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [quickPaymentLoan, setQuickPaymentLoan] = useState<Loan | null>(null);
  const [quickPaymentAmount, setQuickPaymentAmount] = useState("");
  const [quickPaymentData, setQuickPaymentData] = useState({
    payment_method: "mobile_money",
    transaction_reference: "",
    destination_account_id: "",
  });
  const [nextRepayment, setNextRepayment] = useState<any>(null);

  // Disbursement Dialog State
  const [isDisbursementOpen, setIsDisbursementOpen] = useState(false);
  const [disbursementLoan, setDisbursementLoan] = useState<Loan | null>(null);
  const [disbursementMethod, setDisbursementMethod] = useState("bank_transfer");
  const [disbursementSourceAccountId, setDisbursementSourceAccountId] = useState("");
  const [disbursementReference, setDisbursementReference] = useState("");

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { selectedProductId, setSelectedProductId } = useLoanProductFilter();

  // Determine status filter for current tab
  const tabStatuses: Record<string, string[]> = {
    awaiting_disbursement: ["awaiting_disbursement", "approved"],
    active: ["active", "disbursed"],
    completed: ["completed"],
    defaulted: ["defaulted"],
  };

  const effectiveStatuses = statusFilter !== "all"
    ? [statusFilter]
    : tabStatuses[activeTab] || ["awaiting_disbursement", "approved", "active", "disbursed", "completed", "defaulted"];

  // Server-side paginated query
  const { data: loansResult, isLoading } = useQuery({
    queryKey: ["admin-portfolio-loans", selectedProductId, effectiveStatuses, searchTerm, currentPage, pageSize],
    queryFn: async () => {
      let q = supabase
        .from("loan_applications")
        .select("*", { count: "exact" })
        .in("status", effectiveStatuses as any)
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);
      if (selectedProductId) {
        q = q.eq("loan_product_id", selectedProductId);
      }
      if (searchTerm) {
        q = q.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,nrc_number.ilike.%${searchTerm}%`);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data as Loan[], count: count ?? 0 };
    },
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  const loans = loansResult?.data ?? [];
  const totalCount = loansResult?.count ?? 0;

  // Fetch next due dates for active loans
  const { data: loanDueDates } = useQuery({
    queryKey: ["loan-due-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("loan_id, due_date")
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      if (error) throw error;
      const dueDateMap: Record<string, string> = {};
      data.forEach((r) => {
        if (!dueDateMap[r.loan_id]) dueDateMap[r.loan_id] = r.due_date;
      });
      return dueDateMap;
    },
  });

  // Fetch loan products for fee calculations
  const { data: loanProducts } = useQuery({
    queryKey: ["admin-loan-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, name, interest_rate, processing_fee_percent, enforcement_fee_percent, insurance_percent, vat_percent, platform_fee_percent")
        .eq("is_active", true);
      if (error) throw error;
      return data as LoanProduct[];
    },
  });

  // Fetch active accounts for payment deposit
  const { data: accounts = [] } = useQuery({
    queryKey: ["active-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, account_type, balance")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data;
    },
  });

  // Move to defaulted mutation (server-side audit + loan_events)
  const moveToDefaultedMutation = useMutation({
    mutationFn: async ({ loanId, reason }: { loanId: string; reason: string }) => {
      const { data, error } = await (supabase.rpc as any)("admin_mark_loan_defaulted", {
        p_loan_id: loanId,
        p_reason: reason,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error || "Failed to mark loan as defaulted");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      toast.success("Loan moved to defaulted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  // Disburse loan mutation - moves awaiting_disbursement → disbursed, creates disbursement record, deducts from source account
  const disburseLoanMutation = useMutation({
    mutationFn: async () => {
      if (!disbursementLoan) throw new Error("No loan selected");
      if (!disbursementSourceAccountId) throw new Error("Please select a source account for disbursement");

      const loan = disbursementLoan;
      const product = loanProducts?.find(p => p.id === loan.loan_product_id);
      const principal = Number(loan.loan_amount);

      // Calculate fees for net disbursement
      const processingFee = product?.processing_fee_percent ? (principal * product.processing_fee_percent / 100) : 0;
      const enforcementFee = product?.enforcement_fee_percent ? (principal * product.enforcement_fee_percent / 100) : 0;
      const insuranceFee = (product as any)?.insurance_percent ? (principal * (product as any).insurance_percent / 100) : 0;
      const platformFee = (product as any)?.platform_fee_percent ? (principal * (product as any).platform_fee_percent / 100) : 0;
      const vatableAmount = processingFee + enforcementFee + platformFee;
      const vatAmount = (product as any)?.vat_percent ? (vatableAmount * (product as any).vat_percent / 100) : 0;
      const netDisbursement = principal - processingFee - enforcementFee - insuranceFee - platformFee - vatAmount;

      // Fresh read of source account balance
      const { data: sourceAcc, error: accReadErr } = await supabase
        .from("accounts")
        .select("id, account_name, balance")
        .eq("id", disbursementSourceAccountId)
        .single();
      if (accReadErr || !sourceAcc) throw new Error("Source account not found");
      if (sourceAcc.balance < netDisbursement) throw new Error(`Insufficient balance in ${sourceAcc.account_name}. Available: K${sourceAcc.balance.toLocaleString()}, Required: K${netDisbursement.toLocaleString()}`);

      // Deduct from source account
      const newBalance = sourceAcc.balance - netDisbursement;
      const { error: balErr } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", disbursementSourceAccountId);
      if (balErr) throw balErr;

      // Record account transaction
      const { error: txErr } = await supabase.from("account_transactions").insert({
        account_id: disbursementSourceAccountId,
        transaction_type: "disbursement",
        amount: netDisbursement,
        balance_before: sourceAcc.balance,
        balance_after: newBalance,
        destination: loan.full_name,
        reference_type: "loan_disbursement",
        reference_id: loan.id,
        notes: `Loan disbursement to ${loan.full_name} — K${netDisbursement.toLocaleString()} (Principal: K${principal.toLocaleString()}, Fees deducted: K${(principal - netDisbursement).toLocaleString()})`,
      });
      if (txErr) throw txErr;

      // Create disbursement record (trigger will generate repayment schedule & set to active)
      const { error: disbError } = await supabase.from("disbursements").insert({
        loan_id: loan.id,
        amount: netDisbursement,
        disbursement_method: disbursementMethod,
        status: "completed",
        disbursed_at: new Date().toISOString(),
        source_account_id: disbursementSourceAccountId,
        transaction_reference: disbursementReference || `DISB-${Date.now()}`,
      });
      if (disbError) throw disbError;

      await createRepaymentScheduleForLoan(
        {
          id: loan.id,
          user_id: loan.user_id,
          loan_term_months: loan.loan_term_months,
          total_repayment: loan.total_repayment,
          monthly_payment: loan.monthly_payment,
          loan_product_id: loan.loan_product_id,
          term_unit: loan.term_unit,
        },
        supabase,
      );

      // Record disbursement metadata on the loan (trigger already set status to active)
      const { error: statusError } = await supabase
        .from("loan_applications")
        .update({
          disbursed_at: new Date().toISOString(),
          disbursed_by: user?.id,
        })
        .eq("id", loan.id);
      if (statusError) throw statusError;

      await logAudit({
        action: "LOAN_DISBURSED",
        entity_type: "loan_application",
        entity_id: loan.id,
        module: "loans",
        new_values: { status: "disbursed", net_amount: netDisbursement, source_account: sourceAcc.account_name },
      });

      return { netDisbursement, borrowerName: loan.full_name };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      queryClient.invalidateQueries({ queryKey: ["active-accounts"] });
      toast.success(`K${result.netDisbursement.toLocaleString()} disbursed to ${result.borrowerName} — repayment schedule generated`);
      setIsDisbursementOpen(false);
      setDisbursementLoan(null);
      setDisbursementSourceAccountId("");
      setDisbursementReference("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to disburse loan"),
  });

  // Edit loan mutation
  const editLoanMutation = useMutation({
    mutationFn: async () => {
      if (!editingLoan) throw new Error("No loan selected");
      const principal = Number(editLoanAmount);
      const rate = Number(editInterestRate);
      const termValue = Number(editLoanTermMonths);
      const termUnit = (editingLoan.term_unit as any) || 'months';

      // Fetch product settings for accurate calculation
      let productSettings: any = { product_name: null, interest_rate: rate, interest_period: 'monthly', interest_type: 'flat' };
      if (editingLoan.loan_product_id) {
        const { data: product } = await supabase
          .from("loan_products")
          .select("name, interest_rate, interest_period, interest_type, processing_fee_percent, enforcement_fee_percent, insurance_percent, vat_percent, platform_fee_percent, term_unit")
          .eq("id", editingLoan.loan_product_id)
          .single();
        if (product) {
          productSettings = { ...product, product_name: (product as any).name || null, interest_rate: rate };
        }
      }

      // Use the unified calculateLoan function for accurate results
      const { calculateLoan } = await import("@/utils/loanCalculations");
      const calc = calculateLoan(principal, termValue, productSettings, termUnit);

      const { error } = await supabase
        .from("loan_applications")
        .update({
          loan_amount: principal,
          loan_term_months: termValue,
          interest_rate: rate,
          monthly_payment: calc.monthlyPayment,
          total_repayment: calc.totalRepayment,
          monthly_income: Number(editMonthlyIncome) || editingLoan.monthly_income,
          loan_purpose: editLoanPurpose,
          employment_type: editEmploymentType as "employed" | "self_employed" | "contract" | "other",
          admin_notes: editAdminNotes || null,
        })
        .eq("id", editingLoan.id);
      if (error) throw error;

      await logAudit({
        action: "LOAN_EDIT",
        entity_type: "loan_application",
        entity_id: editingLoan.id,
        module: "loans",
        new_values: { loan_amount: principal, interest_rate: rate, loan_term_months: termValue },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      toast.success("Loan updated successfully");
      setIsEditLoanOpen(false);
      setEditingLoan(null);
    },
    onError: (error: any) => toast.error(error.message || "Failed to update loan"),
  });

  // Quick payment mutation - supports partial payments
  const quickPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!nextRepayment || !quickPaymentLoan) throw new Error("No repayment selected");

      const amountDue = Number(nextRepayment.amount);
      const paidAmount = quickPaymentAmount ? Number(quickPaymentAmount) : amountDue;
      if (isNaN(paidAmount) || paidAmount <= 0) throw new Error("Payment amount must be greater than 0");

      if (!quickPaymentData.destination_account_id) {
        throw new Error("Please select a destination account for the payment");
      }

      const destAccount = accounts.find(a => a.id === quickPaymentData.destination_account_id);
      if (!destAccount) throw new Error("Destination account not found");

      // Preserve the original amount before any partial payments reduced it
      const savedOriginalAmount = nextRepayment.original_amount || nextRepayment.amount;
      const isFullPayment = paidAmount >= amountDue;

      if (isFullPayment) {
        const { error } = await supabase
          .from("loan_repayments")
          .update({
            status: "paid",
            paid_date: new Date().toISOString().split("T")[0],
            payment_method: quickPaymentData.payment_method,
            transaction_reference: quickPaymentData.transaction_reference || `PAY-${Date.now()}`,
            principal_paid: Number(savedOriginalAmount),
            original_amount: savedOriginalAmount,
            amount: Number(savedOriginalAmount),
          })
          .eq("id", nextRepayment.id);
        if (error) throw error;

        // Handle overpayment — apply excess to next pending installment
        if (paidAmount > amountDue) {
          let excess = paidAmount - amountDue;
          const { data: nextPendings } = await supabase
            .from("loan_repayments")
            .select("id, amount, original_amount, principal_paid")
            .eq("loan_id", quickPaymentLoan.id)
            .in("status", ["pending", "overdue"])
            .neq("id", nextRepayment.id)
            .order("due_date", { ascending: true });

          for (const np of (nextPendings || [])) {
            if (excess <= 0) break;
            const npAmount = Number(np.amount);
            const npOriginal = np.original_amount || np.amount;
            const applied = Math.min(excess, npAmount);

            if (applied >= npAmount) {
              const { error: autoSettleErr } = await supabase
                .from("loan_repayments")
                .update({
                  status: "paid",
                  paid_date: new Date().toISOString().split("T")[0],
                  payment_method: quickPaymentData.payment_method,
                  principal_paid: Number(npOriginal),
                  original_amount: npOriginal,
                  amount: Number(npOriginal),
                })
                .eq("id", np.id);
              if (autoSettleErr) throw autoSettleErr;
            } else {
              const { error: partialApplyErr } = await supabase
                .from("loan_repayments")
                .update({
                  amount: npAmount - applied,
                  original_amount: npOriginal,
                  principal_paid: (Number(np.principal_paid) || 0) + applied,
                })
                .eq("id", np.id);
              if (partialApplyErr) throw partialApplyErr;
            }
            excess -= applied;
          }
        }
      } else {
        const remainingAmount = amountDue - paidAmount;
        const { error } = await supabase
          .from("loan_repayments")
          .update({
            amount: remainingAmount,
            payment_method: quickPaymentData.payment_method,
            transaction_reference: quickPaymentData.transaction_reference || `PAY-${Date.now()}`,
            principal_paid: (Number((nextRepayment as any).principal_paid) || 0) + paidAmount,
            original_amount: savedOriginalAmount,
          })
          .eq("id", nextRepayment.id);
        if (error) throw error;
      }

      // Record account transaction
      const newBalance = destAccount.balance + paidAmount;
      const { error: accountError } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", quickPaymentData.destination_account_id);
      if (accountError) throw accountError;

      const { error: txError } = await supabase.from("account_transactions").insert({
        account_id: quickPaymentData.destination_account_id,
        transaction_type: "repayment",
        amount: paidAmount,
        balance_before: destAccount.balance,
        balance_after: newBalance,
        reference_type: "loan_repayment",
        reference_id: nextRepayment.id,
        notes: `Loan repayment from ${quickPaymentLoan.full_name}`,
      });
      if (txError) throw txError;

      // Check if all repayments are paid
      const { data: remainingUnpaid } = await supabase
        .from("loan_repayments")
        .select("id")
        .eq("loan_id", quickPaymentLoan.id)
        .in("status", ["pending", "overdue"]);

      if (remainingUnpaid && remainingUnpaid.length === 0) {
        await supabase
          .from("loan_applications")
          .update({ status: "completed" })
          .eq("id", quickPaymentLoan.id);
      }

      return { paidAmount, isFullPayment };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-due-dates"] });
      queryClient.invalidateQueries({ queryKey: ["active-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      if (result.isFullPayment) {
        toast.success("Full payment recorded and deposited to account");
      } else {
        toast.success(`Partial payment of K${result.paidAmount.toLocaleString()} recorded and deposited`);
      }
      setIsQuickPaymentOpen(false);
      setQuickPaymentLoan(null);
      setNextRepayment(null);
      setQuickPaymentAmount("");
    },
    onError: (error: any) => toast.error(error.message || "Failed to record payment"),
  });

  const openEditDialog = (loan: Loan) => {
    setEditingLoan(loan);
    setEditLoanAmount(loan.loan_amount.toString());
    setEditLoanTermMonths(loan.loan_term_months.toString());
    setEditInterestRate(loan.interest_rate.toString());
    setEditMonthlyIncome(loan.monthly_income?.toString() || "");
    setEditLoanPurpose(loan.loan_purpose);
    setEditEmploymentType(loan.employment_type);
    setEditAdminNotes(loan.admin_notes || "");
    setIsEditLoanOpen(true);
  };

  const openQuickPayment = async (loan: Loan) => {
    setQuickPaymentLoan(loan);
    setQuickPaymentAmount("");
    setQuickPaymentData({ payment_method: "mobile_money", transaction_reference: "", destination_account_id: "" });
    const { data: repayment } = await supabase
      .from("loan_repayments")
      .select("*")
      .eq("loan_id", loan.id)
      .in("status", ["pending", "overdue"])
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    setNextRepayment(repayment);
    setIsQuickPaymentOpen(true);
  };

  const handleDownloadSchedule = useCallback(async (loan: Loan) => {
    try {
      const { data: repayments, error } = await supabase
        .from("loan_repayments")
        .select("installment_number, due_date, amount, status, paid_date, original_amount")
        .eq("loan_id", loan.id)
        .order("installment_number", { ascending: true });

      if (error) throw error;
      if (!repayments || repayments.length === 0) {
        toast.error("No repayment schedule found for this loan");
        return;
      }

      // Fetch system settings for company info
      const { data: settings } = await (supabase
        .from("system_settings") as any)
        .select("setting_key, setting_value")
        .in("setting_key", ["company_name", "company_address", "company_phone"]);

      const settingsMap: Record<string, string> = {};
      settings?.forEach((s: any) => { settingsMap[s.setting_key] = s.setting_value; });

      downloadLoanSchedule({
        borrowerName: loan.full_name,
        borrowerPhone: loan.phone || "",
        borrowerEmail: loan.email || "",
        loanReference: loan.id.substring(0, 8).toUpperCase(),
        loanAmount: Number(loan.loan_amount),
        interestRate: Number(loan.interest_rate) || 0,
        interestPeriod: loan.term_unit === "weeks" ? "weekly" : loan.term_unit === "days" ? "daily" : "monthly",
        termMonths: loan.loan_term_months,
        monthlyPayment: Number(loan.monthly_payment) || 0,
        totalRepayment: Number(loan.total_repayment) || 0,
        disbursementDate: loan.created_at,
        firstRepaymentDate: repayments[0]?.due_date || "",
        repayments: repayments.map((r: any) => ({
          installmentNumber: r.installment_number,
          dueDate: r.due_date,
          amount: Number(r.original_amount || r.amount),
          status: r.status,
          paidDate: r.paid_date || undefined,
        })),
        companyName: settingsMap.company_name,
        companyAddress: settingsMap.company_address,
        companyPhone: settingsMap.company_phone,
      });

      toast.success("Repayment schedule PDF downloaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate schedule PDF");
    }
  }, []);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, color: "bg-muted text-muted-foreground", icon: Activity };
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} capitalize border`}>
        <Icon size={12} className="mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Filter loans based on active tab
  const getFilteredLoans = () => {
    let filtered = loans || [];
    if (activeTab === "awaiting_disbursement") {
      filtered = filtered.filter(l => ["awaiting_disbursement", "approved"].includes(l.status));
    } else if (activeTab === "active") {
      filtered = filtered.filter(l => ["active", "disbursed"].includes(l.status));
    } else if (activeTab === "completed") {
      filtered = filtered.filter(l => l.status === "completed");
    } else if (activeTab === "defaulted") {
      filtered = filtered.filter(l => l.status === "defaulted");
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(l => l.status === statusFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(l =>
        l.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.nrc_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  };

  const filteredLoans = getFilteredLoans();

  // Paginate filtered loans
  const paginatedLoans = filteredLoans.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [activeTab, statusFilter, searchTerm, selectedProductId]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-loans-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_applications' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_repayments' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const stats = {
    total: loans?.length || 0,
    awaitingDisbursement: loans?.filter(l => ["awaiting_disbursement", "approved"].includes(l.status)).length || 0,
    active: loans?.filter(l => ["active", "disbursed"].includes(l.status)).length || 0,
    completed: loans?.filter(l => l.status === "completed").length || 0,
    defaulted: loans?.filter(l => l.status === "defaulted").length || 0,
    totalPortfolio: loans?.filter(l => ["active", "disbursed"].includes(l.status)).reduce((sum, l) => sum + Number(l.total_repayment), 0) || 0,
  };

  const getStatusOptions = () => {
    if (activeTab === "active") {
      return [
        { value: "all", label: "All" },
        { value: "active", label: "Active" },
        { value: "disbursed", label: "Disbursed" },
      ];
    }
    return [{ value: "all", label: "All" }];
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 flex-wrap">
            Loan Portfolio
            {isBetaModule("loans_by_product") ? <BetaBadge /> : null}
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor active, completed, and defaulted loans
            {selectedProductId ? " — filtered by loan product." : ""}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <CreditCard className="text-primary-foreground" size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Loans</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
                <Activity className="text-info" size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <CheckCircle className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                <XCircle className="text-destructive" size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.defaulted}</p>
                <p className="text-xs text-muted-foreground">Defaulted</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setStatusFilter("all"); }}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="awaiting_disbursement">Awaiting Disbursement ({stats.awaitingDisbursement})</TabsTrigger>
            <TabsTrigger value="active">Active Loans ({stats.active})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
            <TabsTrigger value="defaulted">Defaulted ({stats.defaulted})</TabsTrigger>
          </TabsList>

          {/* Filters */}
          <Card className="border-border/50 bg-card/50 mt-4">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 md:items-end">
                <LoanProductFilterSelect
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  id="admin-loans-product"
                  className="w-full md:w-56"
                />
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    placeholder="Search by name, email, or NRC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    {getStatusOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Loans Table */}
          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : paginatedLoans.length > 0 ? (
              <>
                <Card className="border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Next Due</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLoans.map((loan) => {
                        const dueDate = loanDueDates?.[loan.id];
                        const isOverdue = dueDate && new Date(dueDate) < new Date(new Date().toDateString());
                        const product = loanProducts?.find(p => p.id === loan.loan_product_id);
                        const loanPrincipal = Number(loan.loan_amount);
                        const processingFee = product?.processing_fee_percent ? (loanPrincipal * product.processing_fee_percent / 100) : 0;
                        const enforcementFee = product?.enforcement_fee_percent ? (loanPrincipal * product.enforcement_fee_percent / 100) : 0;
                        const insuranceFee = (product as any)?.insurance_percent ? (loanPrincipal * (product as any).insurance_percent / 100) : 0;
                        const platformFee = (product as any)?.platform_fee_percent ? (loanPrincipal * (product as any).platform_fee_percent / 100) : 0;
                        const vatableAmount = processingFee + enforcementFee + platformFee;
                        const vatAmount = (product as any)?.vat_percent ? (vatableAmount * (product as any).vat_percent / 100) : 0;
                        const disbursedAmount = loanPrincipal - processingFee - enforcementFee - insuranceFee - platformFee - vatAmount;

                        return (
                          <TableRow key={loan.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                  <User size={18} className="text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{loan.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{loan.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">K{Number(loan.loan_amount).toLocaleString()}</p>
                                {(processingFee > 0 || enforcementFee > 0 || insuranceFee > 0 || platformFee > 0 || vatAmount > 0) && (
                                  <p className="text-xs text-muted-foreground">
                                    {["disbursed", "active", "completed", "defaulted"].includes(loan.status)
                                      ? <span className="text-success">Disbursed: K{disbursedAmount.toLocaleString()}</span>
                                      : <span className="text-warning">Net payout: K{disbursedAmount.toLocaleString()}</span>
                                    }
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{loan.loan_term_months} {loan.term_unit || 'months'}</TableCell>
                            <TableCell>{getStatusBadge(loan.status)}</TableCell>
                            <TableCell>
                              <p className="text-sm">{format(new Date(loan.created_at), "MMM dd, yyyy")}</p>
                            </TableCell>
                            <TableCell>
                              {dueDate && ["active", "disbursed"].includes(loan.status) ? (
                                <p className={`text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-foreground'}`}>
                                  {format(new Date(dueDate), "MMM dd, yyyy")}
                                  {isOverdue && <span className="text-xs block text-destructive">Overdue</span>}
                                </p>
                              ) : ["awaiting_disbursement", "approved"].includes(loan.status) ? (
                                <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">Pending Disburse</Badge>
                              ) : (
                                <p className="text-sm text-muted-foreground">-</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    Actions
                                    <MoreHorizontal size={14} className="ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedLoan(loan);
                                    setIsDetailsOpen(true);
                                  }}>
                                    <Eye size={14} className="mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  {can('loans', 'edit') && (
                                    <DropdownMenuItem onClick={() => openEditDialog(loan)}>
                                      <Edit size={14} className="mr-2" />
                                      Edit Loan
                                    </DropdownMenuItem>
                                  )}
                                  {["awaiting_disbursement", "approved"].includes(loan.status) && can('loans', 'edit') && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => {
                                        setDisbursementLoan(loan);
                                        setDisbursementMethod("bank_transfer");
                                        setDisbursementSourceAccountId("");
                                        setDisbursementReference("");
                                        setIsDisbursementOpen(true);
                                      }}>
                                        <Banknote size={14} className="mr-2" />
                                        Disburse Funds
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedLoan(loan);
                                        setIsDetailsOpen(true);
                                      }}>
                                        <Eye size={14} className="mr-2" />
                                        Review & Disburse
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {["active", "disbursed"].includes(loan.status) && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => openQuickPayment(loan)}>
                                        <Receipt size={14} className="mr-2" />
                                        Record Payment
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDownloadSchedule(loan)}>
                                        <Download size={14} className="mr-2" />
                                        Download Schedule PDF
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {["active", "disbursed"].includes(loan.status) && can('loans', 'edit') && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => {
                                          if (!confirm(`Are you sure you want to move ${loan.full_name}'s loan to Defaulted?`)) return;
                                          const reason = window.prompt(
                                            "Reason for marking as defaulted (required, min 3 characters):",
                                            ""
                                          );
                                          if (!reason || reason.trim().length < 3) {
                                            toast.error("A reason of at least 3 characters is required.");
                                            return;
                                          }
                                          moveToDefaultedMutation.mutate({ loanId: loan.id, reason: reason.trim() });
                                        }}
                                      >
                                        <XCircle size={14} className="mr-2" />
                                        Move to Defaulted
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
                <PaginationControls
                  currentPage={currentPage}
                  totalItems={filteredLoans.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                />
              </>
            ) : (
              <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">No loans found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Loan Details Modal */}
      <LoanDetailsModal
        loan={selectedLoan}
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setSelectedLoan(null);
        }}
      />

      {/* Edit Loan Dialog */}
      <Dialog open={isEditLoanOpen} onOpenChange={setIsEditLoanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Loan</DialogTitle>
            <DialogDescription>Update loan details for {editingLoan?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loan Amount (K)</Label>
                <Input type="number" value={editLoanAmount} onChange={(e) => setEditLoanAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Term ({editingLoan?.term_unit || 'months'})</Label>
                <Input type="number" value={editLoanTermMonths} onChange={(e) => setEditLoanTermMonths(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Interest Rate (%)</Label>
                <Input type="number" value={editInterestRate} onChange={(e) => setEditInterestRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Income (K)</Label>
                <Input type="number" value={editMonthlyIncome} onChange={(e) => setEditMonthlyIncome(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select value={editEmploymentType} onValueChange={setEditEmploymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employed">Employed</SelectItem>
                  <SelectItem value="self_employed">Self Employed</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loan Purpose</Label>
              <Input value={editLoanPurpose} onChange={(e) => setEditLoanPurpose(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <Textarea value={editAdminNotes} onChange={(e) => setEditAdminNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditLoanOpen(false)}>Cancel</Button>
            {can('loans', 'edit') && (
              <Button onClick={() => editLoanMutation.mutate()} disabled={editLoanMutation.isPending}>
                {editLoanMutation.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Payment Dialog */}
      <Dialog open={isQuickPaymentOpen} onOpenChange={setIsQuickPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={20} className="text-primary" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Quick payment for {quickPaymentLoan?.full_name}
            </DialogDescription>
          </DialogHeader>

          {nextRepayment ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Installment</span>
                  <span className="font-medium">#{nextRepayment.installment_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Due Date</span>
                  <span className="font-medium">{format(new Date(nextRepayment.due_date), "MMM dd, yyyy")}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <span className="font-semibold">Amount Due</span>
                  <span className="text-xl font-bold text-primary">K{Number(nextRepayment.amount).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Payment Amount</Label>
                  <Input
                    type="number"
                    value={quickPaymentAmount}
                    onChange={(e) => setQuickPaymentAmount(e.target.value)}
                    placeholder={`Full amount: K${Number(nextRepayment.amount).toLocaleString()}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to pay full installment (K{Number(nextRepayment.amount).toLocaleString()}).
                    Enter a smaller amount for partial payment.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={quickPaymentData.payment_method}
                    onValueChange={(v) => setQuickPaymentData({ ...quickPaymentData, payment_method: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">
                        <div className="flex items-center gap-2"><Phone size={14} /> Mobile Money</div>
                      </SelectItem>
                      <SelectItem value="bank_transfer">
                        <div className="flex items-center gap-2"><Building size={14} /> Bank Transfer</div>
                      </SelectItem>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2"><Banknote size={14} /> Cash</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deposit To Account <span className="text-destructive">*</span></Label>
                  <Select
                    value={quickPaymentData.destination_account_id}
                    onValueChange={(v) => setQuickPaymentData({ ...quickPaymentData, destination_account_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} ({acc.account_type}) — K{acc.balance.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transaction Reference (Optional)</Label>
                  <Input
                    value={quickPaymentData.transaction_reference}
                    onChange={(e) => setQuickPaymentData({ ...quickPaymentData, transaction_reference: e.target.value })}
                    placeholder="Enter reference number"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsQuickPaymentOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => quickPaymentMutation.mutate()}
                  disabled={quickPaymentMutation.isPending}
                  className="gradient-primary"
                >
                  {quickPaymentMutation.isPending ? (
                    <Loader2 className="animate-spin mr-2" size={16} />
                  ) : (
                    <CheckCircle size={16} className="mr-2" />
                  )}
                  Confirm Payment
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending repayments found for this loan</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setIsQuickPaymentOpen(false);
                  setSelectedLoan(quickPaymentLoan);
                  setIsDetailsOpen(true);
                }}
              >
                View Loan Details
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Disbursement Dialog */}
      <Dialog open={isDisbursementOpen} onOpenChange={setIsDisbursementOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote size={20} className="text-success" />
              Disburse Loan
            </DialogTitle>
            <DialogDescription>
              Release funds for {disbursementLoan?.full_name}
            </DialogDescription>
          </DialogHeader>

          {disbursementLoan && (() => {
            const product = loanProducts?.find(p => p.id === disbursementLoan.loan_product_id);
            const principal = Number(disbursementLoan.loan_amount);
            const processingFee = product?.processing_fee_percent ? (principal * product.processing_fee_percent / 100) : 0;
            const enforcementFee = product?.enforcement_fee_percent ? (principal * product.enforcement_fee_percent / 100) : 0;
            const insuranceFee = (product as any)?.insurance_percent ? (principal * (product as any).insurance_percent / 100) : 0;
            const platformFee = (product as any)?.platform_fee_percent ? (principal * (product as any).platform_fee_percent / 100) : 0;
            const vatableAmount = processingFee + enforcementFee + platformFee;
            const vatAmount = (product as any)?.vat_percent ? (vatableAmount * (product as any).vat_percent / 100) : 0;
            const totalFees = processingFee + enforcementFee + insuranceFee + platformFee + vatAmount;
            const netDisbursement = principal - totalFees;

            return (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Borrower</span>
                    <span className="font-medium">{disbursementLoan.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Principal Amount</span>
                    <span className="font-medium">K{principal.toLocaleString()}</span>
                  </div>
                  {totalFees > 0 && (
                    <>
                      {processingFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Processing Fee</span>
                          <span className="text-destructive">-K{processingFee.toLocaleString()}</span>
                        </div>
                      )}
                      {enforcementFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Enforcement Fee</span>
                          <span className="text-destructive">-K{enforcementFee.toLocaleString()}</span>
                        </div>
                      )}
                      {insuranceFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Insurance</span>
                          <span className="text-destructive">-K{insuranceFee.toLocaleString()}</span>
                        </div>
                      )}
                      {platformFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Platform Fee</span>
                          <span className="text-destructive">-K{platformFee.toLocaleString()}</span>
                        </div>
                      )}
                      {vatAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">VAT</span>
                          <span className="text-destructive">-K{vatAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 mt-2">
                    <span className="font-semibold">Net Disbursement</span>
                    <span className="text-xl font-bold text-success">K{netDisbursement.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Term</span>
                    <span className="font-medium">{disbursementLoan.loan_term_months} {disbursementLoan.term_unit || 'months'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Repayment</span>
                    <span className="font-medium">K{Number(disbursementLoan.total_repayment || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Source Account <span className="text-destructive">*</span></Label>
                    <Select value={disbursementSourceAccountId} onValueChange={setDisbursementSourceAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select funding account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} ({acc.account_type}) — K{acc.balance.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Disbursement Method</Label>
                    <Select value={disbursementMethod} onValueChange={setDisbursementMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">
                          <div className="flex items-center gap-2"><Building size={14} /> Bank Transfer</div>
                        </SelectItem>
                        <SelectItem value="mobile_money">
                          <div className="flex items-center gap-2"><Phone size={14} /> Mobile Money</div>
                        </SelectItem>
                        <SelectItem value="cash">
                          <div className="flex items-center gap-2"><Banknote size={14} /> Cash</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Transaction Reference (Optional)</Label>
                    <Input
                      value={disbursementReference}
                      onChange={(e) => setDisbursementReference(e.target.value)}
                      placeholder="Enter reference number"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 mt-4">
                  <Button variant="outline" onClick={() => setIsDisbursementOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => disburseLoanMutation.mutate()}
                    disabled={disburseLoanMutation.isPending || !disbursementSourceAccountId}
                    className="bg-success hover:bg-success/90 text-success-foreground"
                  >
                    {disburseLoanMutation.isPending ? (
                      <Loader2 className="animate-spin mr-2" size={16} />
                    ) : (
                      <Banknote size={16} className="mr-2" />
                    )}
                    Confirm Disbursement
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminLoans;
