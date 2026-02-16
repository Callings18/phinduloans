import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addMonths, parseISO } from "date-fns";
import { calculateLoan, getInterestPeriodLabel } from "@/utils/loanCalculations";
import { logAudit, handleUnauthorized } from "@/utils/auditLog";
import { usePermissions } from "@/hooks/usePermissions";
import {
  CreditCard,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Eye,
  User,
  Wallet,
  TrendingUp,
  Activity,
  Plus,
  Edit,
  Calendar,
  Briefcase,
  Trash2,
  DollarSign,
  FileText,
  UserCheck,
  Receipt,
  Phone,
  Building,
  Banknote,
  MoreHorizontal,
  Download,
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
import { useAuth } from "@/hooks/useAuth";
import { notificationService } from "@/utils/notifications";

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
}

interface Borrower {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  nrc_number: string | null;
  address: string | null;
  city: string | null;
}

interface LoanProduct {
  id: string;
  name: string;
  interest_rate: number;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  term_unit: string;
  processing_fee_percent: number | null;
  enforcement_fee_percent?: number | null;
  required_documents?: any;
  interest_period?: string;
  interest_type?: string;
  insurance_percent?: number;
  vat_percent?: number;
  platform_fee_percent?: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-warning/20 text-warning border-warning/30", icon: AlertTriangle },
  under_review: { label: "Under Review", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Eye },
  approved: { label: "Approved", color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
  contract_signing: { label: "Contract Signing", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: FileText },
  rejected: { label: "Rejected", color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
  disbursed: { label: "Disbursed", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: Wallet },
  active: { label: "Active", color: "bg-info/20 text-info border-info/30", icon: Activity },
  completed: { label: "Completed", color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle },
  defaulted: { label: "Defaulted", color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
};

const AdminLoans = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Add Loan Form State
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState<string>("");
  const [loanTermMonths, setLoanTermMonths] = useState<string>("");
  const [loanPurpose, setLoanPurpose] = useState<string>("");
  const [employmentType, setEmploymentType] = useState<string>("employed");
  const [monthlyIncome, setMonthlyIncome] = useState<string>("");
  const [employerName, setEmployerName] = useState<string>("");
  const [jobTitle, setJobTitle] = useState<string>("");
  const [collateralDescription, setCollateralDescription] = useState<string>("");
  const [collateralValue, setCollateralValue] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [disbursementDate, setDisbursementDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [firstRepaymentDate, setFirstRepaymentDate] = useState<string>(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [createWithDisbursement, setCreateWithDisbursement] = useState<boolean>(false);

  // Document upload state - dynamic based on selected product
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({});

  // Edit Loan Form State
  const [editLoanAmount, setEditLoanAmount] = useState<string>("");
  const [editLoanTermMonths, setEditLoanTermMonths] = useState<string>("");
  const [editInterestRate, setEditInterestRate] = useState<string>("");
  const [editMonthlyIncome, setEditMonthlyIncome] = useState<string>("");
  const [editLoanPurpose, setEditLoanPurpose] = useState<string>("");
  const [editAdminNotes, setEditAdminNotes] = useState<string>("");
  const [editEmploymentType, setEditEmploymentType] = useState<string>("");

  // Disbursement Form State
  const [disbursement, setDisbursement] = useState({
    disbursement_method: "bank_transfer",
    account_number: "",
    mobile_money_number: "",
    transaction_reference: "",
    source_account_id: "",
    disbursement_date: format(new Date(), "yyyy-MM-dd"),
    first_repayment_date: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
  });

  // Quick Payment State
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [quickPaymentLoan, setQuickPaymentLoan] = useState<Loan | null>(null);
  const [quickPaymentData, setQuickPaymentData] = useState({
    payment_method: "mobile_money",
    transaction_reference: "",
    amount: "",
  });
  const [nextRepayment, setNextRepayment] = useState<any>(null);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { can } = usePermissions();

  // Fetch all loans
  const { data: loans, isLoading, refetch } = useQuery({
    queryKey: ["admin-all-loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Loan[];
    },
    refetchOnWindowFocus: true,
    staleTime: 10000, // 10 seconds
  });

  // Fetch next due dates for all active loans
  const { data: loanDueDates } = useQuery({
    queryKey: ["loan-due-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("loan_id, due_date")
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Get earliest due date per loan
      const dueDateMap: Record<string, string> = {};
      data.forEach((r) => {
        if (!dueDateMap[r.loan_id]) {
          dueDateMap[r.loan_id] = r.due_date;
        }
      });
      return dueDateMap;
    },
  });

  // Fetch loan repayments for selected loan
  const { data: loanRepayments } = useQuery({
    queryKey: ["loan-repayments", selectedLoan?.id],
    queryFn: async () => {
      if (!selectedLoan) return [];
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("*")
        .eq("loan_id", selectedLoan.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedLoan,
  });

  // Fetch borrowers
  const { data: borrowers } = useQuery({
    queryKey: ["admin-borrowers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data as Borrower[];
    },
  });

  // Check if selected borrower has an existing active loan (duplicate prevention)
  const { data: borrowerExistingLoan } = useQuery({
    queryKey: ["borrower-existing-loan", selectedBorrowerId],
    queryFn: async () => {
      if (!selectedBorrowerId) return null;
      const { data, error } = await supabase
        .from("loan_applications")
        .select("id, loan_amount, status, created_at")
        .eq("user_id", selectedBorrowerId)
        .in("status", ["pending", "under_review", "approved", "disbursed", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!selectedBorrowerId,
  });

  // Fetch loan products
  const { data: loanProducts } = useQuery({
    queryKey: ["admin-loan-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as LoanProduct[];
    },
  });

  // Fetch staff for assignment
  const { data: staffList } = useQuery({
    queryKey: ['staff-list-simple'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .neq('role', 'user')
        .neq('role', 'employer');

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      return roles.map(role => ({
        ...role,
        profile: profiles?.find(p => p.id === role.user_id)
      }));
    }
  });

  // Fetch active accounts for disbursement source
  const { data: accounts } = useQuery({
    queryKey: ["active-accounts-for-disbursement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .order("account_name", { ascending: true });

      if (error) throw error;
      return data as { id: string; account_name: string; balance: number; account_type: string }[];
    },
  });

  const selectedBorrower = borrowers?.find(b => b.id === selectedBorrowerId);
  const selectedProduct = loanProducts?.find(p => p.id === selectedProductId);

  // Calculate loan details using unified calculation utility
  const calculateLoanDetails = () => {
    if (!selectedProduct || !loanAmount || !loanTermMonths) return null;

    const principal = Number(loanAmount);
    const termValue = Number(loanTermMonths);
    const termUnit = (selectedProduct as any).term_unit || 'months';

    const loanCalc = calculateLoan(principal, termValue, {
      interest_rate: selectedProduct.interest_rate,
      interest_period: (selectedProduct as any).interest_period,
      interest_type: (selectedProduct as any).interest_type,
      processing_fee_percent: selectedProduct.processing_fee_percent,
      insurance_percent: (selectedProduct as any).insurance_percent,
      vat_percent: (selectedProduct as any).vat_percent,
      platform_fee_percent: (selectedProduct as any).platform_fee_percent,
      term_unit: termUnit,
    }, termUnit as any);

    return {
      principal,
      interest: loanCalc.totalInterest,
      processingFee: loanCalc.processingFee,
      totalRepayment: loanCalc.totalRepayment,
      monthlyPayment: loanCalc.monthlyPayment,
      weeklyPayment: loanCalc.weeklyPayment,
      rate: selectedProduct.interest_rate,
      interestPeriod: getInterestPeriodLabel((selectedProduct as any).interest_period),
      paymentFrequency: loanCalc.paymentFrequency,
    };
  };

  const loanDetails = calculateLoanDetails();

  // Upload document helper function
  const uploadDocumentFile = async (file: File, folder: string, loanId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${loanId}/${folder}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('loan-documents')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    return fileName;
  };

  // Create loan mutation
  const createLoanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBorrower || !selectedProduct || !loanDetails) {
        throw new Error("Please fill in all required fields");
      }

      // Check for duplicate loan - prevent admin from creating loan for borrower with existing active loan
      if (borrowerExistingLoan) {
        throw new Error("This borrower already has an active or pending loan. Cannot create a new loan until the existing one is completed.");
      }

      const { data: loanApp, error: loanError } = await supabase
        .from("loan_applications")
        .insert({
          user_id: selectedBorrowerId,
          full_name: selectedBorrower.full_name || "",
          email: selectedBorrower.email,
          phone: selectedBorrower.phone || "",
          nrc_number: selectedBorrower.nrc_number || "",
          address: selectedBorrower.address,
          city: selectedBorrower.city,
          employer_name: employerName || null,
          job_title: jobTitle || null,
          loan_amount: loanDetails.principal,
          loan_term_months: Number(loanTermMonths),
          term_unit: selectedProduct?.term_unit || 'months',
          interest_rate: loanDetails.rate,
          monthly_payment: loanDetails.monthlyPayment,
          total_repayment: loanDetails.totalRepayment,
          monthly_income: Number(monthlyIncome) || 0,
          employment_type: employmentType as "employed" | "self_employed" | "contract" | "other",
          loan_purpose: loanPurpose,
          loan_product_id: selectedProductId,
          collateral_description: collateralDescription || null,
          collateral_value: collateralValue ? parseFloat(collateralValue) : null,
          admin_notes: adminNotes || null,
          status: createWithDisbursement ? "active" : "pending",
          source: "internal",
        })
        .select()
        .single();

      if (loanError) throw loanError;

      const loanId = loanApp.id;

      // Upload dynamic documents to application_documents table
      const requiredDocs = (selectedProduct?.required_documents as any[]) || [];
      for (const [docKey, file] of Object.entries(documentFiles)) {
        if (!file) continue;
        const docConfig = requiredDocs.find((d: any) => {
          const name = d.document_name || d.doc_label || '';
          const key = (d.doc_type || name)?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
          return key === docKey;
        });
        const folder = docKey.includes('nrc') ? 'nrc' : docKey.includes('payslip') ? 'payslips' : docKey.includes('collateral') ? 'collateral' : 'documents';
        const fileUrl = await uploadDocumentFile(file, folder, loanId);
        if (fileUrl) {
          await supabase.from('application_documents').insert({
            application_id: loanId,
            borrower_id: selectedBorrowerId,
            loan_product_id: selectedProductId,
            doc_type: docConfig?.doc_type || docKey,
            doc_label: docConfig?.document_name || docConfig?.doc_label || docKey,
            file_url: fileUrl,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            is_required: docConfig?.is_mandatory ?? true,
            uploaded_by: 'admin',
          });
        }
      }

      // Auto-link existing KYC documents from borrower_document_vault
      const { data: vaultDocs } = await supabase
        .from("borrower_document_vault")
        .select("*")
        .eq("borrower_id", selectedBorrowerId);

      if (vaultDocs && vaultDocs.length > 0) {
        const kycRecords = vaultDocs.map((vDoc: any) => ({
          application_id: loanId,
          borrower_id: selectedBorrowerId,
          loan_product_id: selectedProductId,
          doc_type: vDoc.doc_type,
          doc_label: vDoc.doc_label,
          file_url: vDoc.file_url,
          file_name: vDoc.file_name,
          file_size: vDoc.file_size,
          mime_type: vDoc.mime_type,
          is_required: true,
          uploaded_by: "vault_auto",
          status: vDoc.is_verified ? "verified" : "uploaded",
        }));
        await supabase.from("application_documents").insert(kycRecords);
      }

      // Documents already saved to application_documents above

      // If creating with immediate disbursement
      if (createWithDisbursement) {
        const { error: disbError } = await supabase
          .from("disbursements")
          .insert({
            loan_id: loanApp.id,
            amount: loanDetails.principal,
            disbursement_method: "bank_transfer",
            status: "completed",
            disbursed_at: new Date(disbursementDate).toISOString(),
            transaction_reference: `ADMIN-${Date.now()}`,
          });

        if (disbError) throw disbError;

        // Generate repayment schedule
        const repayments = [];
        const firstRepayment = parseISO(firstRepaymentDate);
        for (let i = 0; i < Number(loanTermMonths); i++) {
          repayments.push({
            loan_id: loanApp.id,
            user_id: selectedBorrowerId,
            amount: loanDetails.monthlyPayment,
            due_date: format(addMonths(firstRepayment, i), "yyyy-MM-dd"),
            installment_number: i + 1,
            status: "pending",
          });
        }

        const { error: repError } = await supabase.from("loan_repayments").insert(repayments);
        if (repError) throw repError;
      }

      return loanApp;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      await refetch();
      toast.success(createWithDisbursement
        ? "Loan created and disbursed with repayment schedule"
        : "Loan application created - proceed to review and approval");
      setIsAddLoanOpen(false);
      resetAddLoanForm();
      // Switch to applications tab if created as pending
      if (!createWithDisbursement) {
        setActiveTab("applications");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create loan");
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const updateData: any = {
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };

      if (reason) {
        updateData.rejection_reason = reason;
      }

      const { error } = await supabase
        .from('loan_applications')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await logAudit({
        action: "STATUS_UPDATE",
        entity_type: "loan_application",
        entity_id: id,
        module: "loans",
        new_values: { status, rejection_reason: reason ?? null },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-loans'] });

      if (variables.status === 'approved' && selectedLoan) {
        notificationService.sendLoanApproval(
          selectedLoan.user_id,
          selectedLoan.full_name,
          selectedLoan.loan_amount,
          selectedLoan.email
        );
      } else if (variables.status === 'rejected' && selectedLoan) {
        notificationService.send({
          userId: selectedLoan.user_id,
          type: 'email',
          to: selectedLoan.email,
          subject: 'Loan Application Update',
          title: 'Loan Application Update',
          message: `Hello ${selectedLoan.full_name}, unfortunately your loan application has been rejected. Reason: ${variables.reason || 'Not disclosed'}.`
        });
      }

      toast.success("Application updated successfully");
      setSelectedLoan(null);
      setRejectionReason("");
    },
    onError: async (error: any, variables) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "loan_application",
        entity_id: variables.id,
        module: "loans",
      });
      toast.error(handled ? "You don't have permission to perform this action." : (error.message || "Failed to update application"));
    },
  });

  // Disburse mutation
  const disburseMutation = useMutation({
    mutationFn: async (data: any) => {
      const disbursementAmount = selectedLoan!.loan_amount;
      
      // Validate source account if provided
      if (data.source_account_id) {
        const sourceAccount = accounts?.find(a => a.id === data.source_account_id);
        if (!sourceAccount) throw new Error("Source account not found");
        if (sourceAccount.balance < disbursementAmount) {
          throw new Error(`Insufficient balance in ${sourceAccount.account_name}. Available: K${sourceAccount.balance.toLocaleString()}`);
        }
      }

      // Create disbursement record with source account
      const disbursementDateISO = new Date(data.disbursement_date || new Date()).toISOString();
      const { error: disbError } = await supabase.from('disbursements').insert({
        loan_id: selectedLoan!.id,
        amount: disbursementAmount,
        disbursement_method: data.disbursement_method,
        account_number: data.account_number || null,
        mobile_money_number: data.mobile_money_number || null,
        transaction_reference: data.transaction_reference || null,
        source_account_id: data.source_account_id || null,
        status: 'completed',
        disbursed_at: disbursementDateISO,
      });

      if (disbError) throw disbError;

      // Deduct from source account if provided
      if (data.source_account_id) {
        const sourceAccount = accounts?.find(a => a.id === data.source_account_id);
        if (sourceAccount) {
          const { error: accountError } = await supabase
            .from("accounts")
            .update({ balance: sourceAccount.balance - disbursementAmount })
            .eq("id", data.source_account_id);

          if (accountError) throw accountError;

          // Record account transaction
          await supabase.from("account_transactions").insert({
            account_id: data.source_account_id,
            transaction_type: "disbursement",
            amount: disbursementAmount,
            balance_before: sourceAccount.balance,
            balance_after: sourceAccount.balance - disbursementAmount,
            reference_type: "loan_disbursement",
            reference_id: selectedLoan!.id,
            notes: `Loan disbursement to ${selectedLoan!.full_name}`,
          });
        }
      }

      const { error: loanError } = await supabase
        .from('loan_applications')
        .update({
          status: 'active',
          disbursed_by: user?.id,
          disbursed_at: disbursementDateISO,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedLoan!.id);

      if (loanError) throw loanError;

      // Generate repayment schedule
      const termMonths = selectedLoan!.loan_term_months;
      const monthlyPayment = selectedLoan!.monthly_payment;
      const firstRepayment = parseISO(data.first_repayment_date || format(addMonths(new Date(), 1), "yyyy-MM-dd"));
      const repayments = [];
      for (let i = 0; i < termMonths; i++) {
        repayments.push({
          loan_id: selectedLoan!.id,
          user_id: selectedLoan!.user_id,
          amount: monthlyPayment,
          due_date: format(addMonths(firstRepayment, i), "yyyy-MM-dd"),
          installment_number: i + 1,
          status: "pending",
        });
      }

      if (repayments.length > 0) {
        const { error: repError } = await supabase.from("loan_repayments").insert(repayments);
        if (repError) console.error("Failed to create repayment schedule:", repError);
      }

      await logAudit({
        action: "DISBURSE",
        entity_type: "loan_application",
        entity_id: selectedLoan!.id,
        module: "disbursement",
        new_values: {
          amount: disbursementAmount,
          disbursement_method: data.disbursement_method,
          source_account_id: data.source_account_id,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['active-accounts-for-disbursement'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });

      if (selectedLoan) {
        notificationService.send({
          userId: selectedLoan.user_id,
          type: 'sms',
          to: selectedLoan.phone,
          title: 'Loan Disbursed',
          message: `Hello ${selectedLoan.full_name}, your loan of K${Number(selectedLoan.loan_amount).toLocaleString()} has been disbursed. Please check your account.`
        });
      }

      toast.success("Loan disbursed successfully and account balance updated");
      setIsDisburseOpen(false);
      setSelectedLoan(null);
      resetDisbursementForm();
    },
    onError: async (error: any) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "loan_application",
        entity_id: selectedLoan?.id ?? "",
        module: "disbursement",
      });
      toast.error(handled ? "You don't have permission to perform this action." : (error.message || "Failed to disburse loan"));
    },
  });

  // Edit loan mutation
  const editLoanMutation = useMutation({
    mutationFn: async () => {
      if (!editingLoan) throw new Error("No loan selected");

      const principal = Number(editLoanAmount);
      const rate = Number(editInterestRate);
      const months = Number(editLoanTermMonths);

      const interest = principal * (rate / 100) * months;
      const totalRepayment = principal + interest;
      const monthlyPayment = totalRepayment / months;

      const { error } = await supabase
        .from("loan_applications")
        .update({
          loan_amount: principal,
          loan_term_months: months,
          interest_rate: rate,
          monthly_payment: monthlyPayment,
          total_repayment: totalRepayment,
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
        new_values: { loan_amount: principal, interest_rate: rate, loan_term_months: months },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      toast.success("Loan updated successfully");
      setIsEditLoanOpen(false);
      setEditingLoan(null);
    },
    onError: async (error: any) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "loan_application",
        entity_id: editingLoan?.id ?? "",
        module: "loans",
      });
      toast.error(handled ? "You don't have permission to perform this action." : (error.message || "Failed to update loan"));
    },
  });

  // Delete mutation with restrictions
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First check if loan can be deleted
      const { data: loan, error: fetchError } = await supabase
        .from('loan_applications')
        .select('status')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Only allow deletion if loan is pending, rejected, or under_review
      if (!loan || !['pending', 'rejected', 'under_review'].includes(loan.status)) {
        throw new Error('Cannot delete loan. Only pending, rejected, or under review loans can be deleted.');
      }
      
      const { error } = await supabase.from('loan_applications').delete().eq('id', id);
      if (error) throw error;

      await logAudit({
        action: "DELETE",
        entity_type: "loan_application",
        entity_id: id,
        module: "loans",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-loans'] });
      toast.success("Application deleted successfully");
      setIsDeleteOpen(false);
      setSelectedLoan(null);
    },
    onError: async (error: any, variables) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "loan_application",
        entity_id: variables,
        module: "loans",
      });
      toast.error(handled ? "You don't have permission to perform this action." : (error.message || "Failed to delete application"));
    },
  });

  const resetAddLoanForm = () => {
    setSelectedBorrowerId("");
    setSelectedProductId("");
    setLoanAmount("");
    setLoanTermMonths("");
    setLoanPurpose("");
    setEmploymentType("employed");
    setMonthlyIncome("");
    setEmployerName("");
    setJobTitle("");
    setCollateralDescription("");
    setCollateralValue("");
    setAdminNotes("");
    setDisbursementDate(format(new Date(), "yyyy-MM-dd"));
    setFirstRepaymentDate(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
    setCreateWithDisbursement(false);
    setDocumentFiles({});
  };

  const resetDisbursementForm = () => {
    setDisbursement({
      disbursement_method: "bank_transfer",
      account_number: "",
      mobile_money_number: "",
      transaction_reference: "",
      source_account_id: "",
      disbursement_date: format(new Date(), "yyyy-MM-dd"),
      first_repayment_date: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
    });
  };

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

  const handleApprove = async () => {
    if (!selectedLoan) return;
    setIsProcessing(true);
    await updateStatusMutation.mutateAsync({ id: selectedLoan.id, status: 'approved' });
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedLoan || !rejectionReason) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setIsProcessing(true);
    await updateStatusMutation.mutateAsync({
      id: selectedLoan.id,
      status: 'rejected',
      reason: rejectionReason,
    });
    setIsProcessing(false);
  };

  const handleDisburse = () => {
    // Dual-signature guard: both borrower and admin must have signed
    if (!(selectedLoan as any)?.borrower_signed || !(selectedLoan as any)?.admin_signed) {
      toast.error("Contract must be signed by both parties before disbursement. Please verify signatures in the loan details first.");
      return;
    }
    if (!disbursement.source_account_id) {
      toast.error("Please select a source account for disbursement");
      return;
    }
    if (!disbursement.transaction_reference) {
      toast.error("Please enter a transaction reference");
      return;
    }
    if (disbursement.disbursement_method === 'bank_transfer' && !disbursement.account_number) {
      toast.error("Please enter account number for bank transfer");
      return;
    }
    if (disbursement.disbursement_method === 'mobile_money' && !disbursement.mobile_money_number) {
      toast.error("Please enter mobile money number");
      return;
    }
    disburseMutation.mutate(disbursement);
  };

  // Open quick payment dialog
  const openQuickPayment = async (loan: Loan) => {
    setQuickPaymentLoan(loan);
    setQuickPaymentData({
      payment_method: "mobile_money",
      transaction_reference: "",
      amount: "",
    });

    // Fetch next pending repayment for this loan
    const { data: repayment } = await supabase
      .from("loan_repayments")
      .select("*")
      .eq("loan_id", loan.id)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    setNextRepayment(repayment);
    if (repayment) {
      setQuickPaymentData(prev => ({ ...prev, amount: repayment.amount.toString() }));
    }
    setIsQuickPaymentOpen(true);
  };

  // Quick payment mutation
  const quickPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!quickPaymentLoan || !nextRepayment) throw new Error("No repayment selected");

      const { error } = await supabase
        .from("loan_repayments")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
          payment_method: quickPaymentData.payment_method,
          transaction_reference: quickPaymentData.transaction_reference || `PAY-${Date.now()}`,
        })
        .eq("id", nextRepayment.id);

      if (error) throw error;

      // Check if all repayments are paid
      const { data: remainingPending } = await supabase
        .from("loan_repayments")
        .select("id")
        .eq("loan_id", quickPaymentLoan.id)
        .eq("status", "pending");

      if (remainingPending && remainingPending.length === 0) {
        await supabase
          .from("loan_applications")
          .update({ status: "completed" })
          .eq("id", quickPaymentLoan.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      toast.success("Payment recorded successfully");
      setIsQuickPaymentOpen(false);
      setQuickPaymentLoan(null);
      setNextRepayment(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
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

    // Loans page only shows post-disbursement statuses
    if (activeTab === "active") {
      filtered = filtered.filter(l => ["active", "disbursed"].includes(l.status));
    } else if (activeTab === "completed") {
      filtered = filtered.filter(l => l.status === "completed");
    } else if (activeTab === "defaulted") {
      filtered = filtered.filter(l => l.status === "defaulted");
    }

    // Status filter within tab
    if (statusFilter !== "all") {
      filtered = filtered.filter(l => l.status === statusFilter);
    }

    // Search filter
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

  const stats = {
    total: loans?.filter(l => ["active", "disbursed", "completed", "defaulted"].includes(l.status)).length || 0,
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

  // Move to defaulted mutation
  const moveToDefaultedMutation = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase
        .from("loan_applications")
        .update({ status: "defaulted" as any })
        .eq("id", loanId);
      if (error) throw error;
      await logAudit({
        action: "MOVE_TO_DEFAULTED",
        entity_type: "loan_application",
        entity_id: loanId,
        module: "loans",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      toast.success("Loan moved to defaulted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Loan Management</h1>
            <p className="text-muted-foreground mt-1">
              Complete loan lifecycle from application to closure
            </p>
          </div>
          <Button onClick={() => setIsAddLoanOpen(true)}>
            <Plus size={18} className="mr-2" />
            Add Loan
          </Button>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Active Loans ({stats.active})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
            <TabsTrigger value="defaulted">Defaulted ({stats.defaulted})</TabsTrigger>
          </TabsList>

          {/* Filters */}
          <Card className="border-border/50 bg-card/50 mt-4">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
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

          {/* Loans Table - Same for all tabs */}
          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredLoans.length > 0 ? (
              <Card className="border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan) => {
                      const dueDate = loanDueDates?.[loan.id];
                      const isOverdue = dueDate && new Date(dueDate) < new Date();

                      // Calculate disbursed amount (after fees)
                      const product = loanProducts?.find(p => p.id === loan.loan_product_id);
                      const processingFee = product?.processing_fee_percent ? (Number(loan.loan_amount) * product.processing_fee_percent / 100) : 0;
                      const legalFee = product?.enforcement_fee_percent ? (Number(loan.loan_amount) * product.enforcement_fee_percent / 100) : 0;
                      const disbursedAmount = Number(loan.loan_amount) - processingFee - legalFee;

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
                              {(processingFee > 0 || legalFee > 0) && ['disbursed', 'active', 'completed', 'defaulted'].includes(loan.status) && (
                                <p className="text-xs text-success">Disbursed: K{disbursedAmount.toLocaleString()}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{loan.loan_term_months} {loan.term_unit || 'months'}</TableCell>
                          <TableCell>{getStatusBadge(loan.status)}</TableCell>
                          <TableCell>
                            <p className="text-sm">{format(new Date(loan.created_at), "MMM dd, yyyy")}</p>
                          </TableCell>
                          <TableCell>
                            {dueDate ? (
                              <p className={`text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-foreground'}`}>
                                {format(new Date(dueDate), "MMM dd, yyyy")}
                                {isOverdue && <span className="text-xs block text-destructive">Overdue</span>}
                              </p>
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
                                {["active", "disbursed"].includes(loan.status) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openQuickPayment(loan)}>
                                      <Receipt size={14} className="mr-2" />
                                      Record Payment
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {["active", "disbursed"].includes(loan.status) && (
                                  <DropdownMenuItem onClick={async () => {
                                    const { downloadLoanSchedule } = await import("@/utils/generateLoanSchedule");
                                    // minimal schedule download
                                    toast.success("Opening loan details for schedule...");
                                    setSelectedLoan(loan);
                                    setIsDetailsOpen(true);
                                  }}>
                                    <Download size={14} className="mr-2" />
                                    View Schedule
                                  </DropdownMenuItem>
                                )}
                                {["active", "disbursed"].includes(loan.status) && can('loans', 'edit') && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to move ${loan.full_name}'s loan to Defaulted?`)) {
                                          moveToDefaultedMutation.mutate(loan.id);
                                        }
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

      {/* Add Loan Dialog */}
      <Dialog open={isAddLoanOpen} onOpenChange={setIsAddLoanOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Loan</DialogTitle>
            <DialogDescription>Create a new loan application</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="borrower" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="borrower">Borrower</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="loan">Loan Details</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
            </TabsList>

            <TabsContent value="borrower" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Borrower *</Label>
                <Select value={selectedBorrowerId} onValueChange={setSelectedBorrowerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a borrower" />
                  </SelectTrigger>
                  <SelectContent>
                    {borrowers?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.full_name || b.email} - {b.nrc_number || 'No NRC'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duplicate Loan Warning */}
              {borrowerExistingLoan && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-destructive h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-destructive mb-1">Cannot Create Loan</h4>
                        <p className="text-sm text-destructive/90 mb-2">
                          This borrower already has an active/pending loan and cannot receive a new loan until the existing one is completed.
                        </p>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">Existing Loan Amount:</span> <span className="font-medium">K{Number(borrowerExistingLoan.loan_amount).toLocaleString()}</span></p>
                          <p><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="ml-1">{borrowerExistingLoan.status}</Badge></p>
                          <p><span className="text-muted-foreground">Applied:</span> <span className="font-medium">{format(new Date(borrowerExistingLoan.created_at), "MMM dd, yyyy")}</span></p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedBorrower && !borrowerExistingLoan && (
                <Card className="bg-secondary/30">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3">Borrower Details</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Full Name</p>
                        <p className="font-medium">{selectedBorrower.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{selectedBorrower.email}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium">{selectedBorrower.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">NRC</p>
                        <p className="font-medium">{selectedBorrower.nrc_number || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="employment" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employer Name</Label>
                  <Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} placeholder="ABC Company" />
                </div>
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Manager" />
                </div>
                <div className="space-y-2">
                  <Label>Employment Type *</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
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
                  <Label>Monthly Income (K) *</Label>
                  <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="5000" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="loan" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Loan Product *</Label>
                <Select value={selectedProductId} onValueChange={(val) => { setSelectedProductId(val); setDocumentFiles({}); }}>
                  <SelectTrigger><SelectValue placeholder="Select a loan product" /></SelectTrigger>
                  <SelectContent>
                    {loanProducts?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.interest_rate}% interest)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loan Amount (K) *</Label>
                  <Input type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} placeholder="10000" />
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">
                      Min: K{selectedProduct.min_amount.toLocaleString()} - Max: K{selectedProduct.max_amount.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Term ({selectedProduct?.term_unit || 'months'}) *</Label>
                  <Input type="number" value={loanTermMonths} onChange={(e) => setLoanTermMonths(e.target.value)} placeholder="12" />
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">
                      Min: {selectedProduct.min_term_months} - Max: {selectedProduct.max_term_months} {selectedProduct.term_unit || 'months'}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Loan Purpose *</Label>
                <Select value={loanPurpose} onValueChange={setLoanPurpose}>
                  <SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="home_improvement">Home Improvement</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loanDetails && (
                <Card className="bg-secondary/50">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-2">Loan Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Repayment</p>
                        <p className="font-medium">K{loanDetails.totalRepayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monthly Payment</p>
                        <p className="font-medium">K{loanDetails.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Interest</p>
                        <p className="font-medium">K{loanDetails.interest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 mt-4">
              {!selectedProductId ? (
                <Card className="bg-secondary/30 border-border/50">
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Please select a Loan Product in the "Loan Details" tab first to see required documents.</p>
                  </CardContent>
                </Card>
              ) : (() => {
                const prodDocs = (selectedProduct?.required_documents as any[]) || [];
                if (prodDocs.length === 0) {
                  return (
                    <Card className="bg-secondary/30 border-border/50">
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">No documents configured for this loan product.</p>
                      </CardContent>
                    </Card>
                  );
                }
                return (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Upload the required documents for <span className="font-semibold text-foreground">{selectedProduct?.name}</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {prodDocs
                        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
                        .map((doc: any) => {
                          const docName = doc.document_name || doc.doc_label || 'Document';
                          const docKey = (doc.doc_type || docName)?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                          return (
                            <div key={docKey} className="space-y-2">
                              <Label className="flex items-center gap-1">
                                {docName}
                                {doc.is_mandatory && <span className="text-destructive">*</span>}
                              </Label>
                              <div className="border-2 border-dashed border-border rounded-lg p-3">
                                <Input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                  onChange={(e) => setDocumentFiles({
                                    ...documentFiles,
                                    [docKey]: e.target.files?.[0] || null
                                  })}
                                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                />
                                {documentFiles[docKey] && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Selected: {documentFiles[docKey]?.name}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="options" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Collateral Description</Label>
                  <Textarea value={collateralDescription} onChange={(e) => setCollateralDescription(e.target.value)} placeholder="Describe collateral if any" />
                </div>
                <div className="space-y-2">
                  <Label>Collateral Value (K)</Label>
                  <Input type="number" value={collateralValue} onChange={(e) => setCollateralValue(e.target.value)} placeholder="50000" />
                </div>
              </div>

              {/* Multiple Collateral Images */}
              {collateralDescription && (
                <div className="space-y-4 border-t pt-4">
                  <Label className="text-base font-semibold">Collateral Images (Upload up to 3 or more)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((num) => (
                      <div key={num} className="space-y-2">
                        <Label className="text-sm">Collateral Image {num}</Label>
                        <div className="border-2 border-dashed border-border rounded-lg p-3">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setDocumentFiles({
                              ...documentFiles,
                              [`collateral_image_${num}` as keyof typeof documentFiles]: e.target.files?.[0] || null
                            })}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                          {documentFiles[`collateral_image_${num}` as keyof typeof documentFiles] && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Selected: {(documentFiles[`collateral_image_${num}` as keyof typeof documentFiles] as File)?.name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Upload photos of the collateral. You can add more images after creating the loan.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Internal notes..." />
              </div>

              <Card className="bg-secondary/30 border-primary/30">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="quickDisburse"
                      checked={createWithDisbursement}
                      onCheckedChange={(checked) => setCreateWithDisbursement(checked as boolean)}
                    />
                    <Label htmlFor="quickDisburse" className="cursor-pointer">
                      Quick Disbursement (skip approval workflow)
                    </Label>
                  </div>

                  {createWithDisbursement && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar size={14} />
                          Disbursement Date
                        </Label>
                        <Input
                          type="date"
                          value={disbursementDate}
                          onChange={(e) => setDisbursementDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar size={14} />
                          First Repayment Date
                        </Label>
                        <Input
                          type="date"
                          value={firstRepaymentDate}
                          onChange={(e) => setFirstRepaymentDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsAddLoanOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createLoanMutation.mutate()} 
              disabled={createLoanMutation.isPending || !!borrowerExistingLoan}
              title={borrowerExistingLoan ? "Cannot create loan - borrower has existing active loan" : undefined}
            >
              {createLoanMutation.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}
              <Plus size={16} className="mr-1" />
              {borrowerExistingLoan ? "Cannot Create Loan" : "Create Loan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Disburse Dialog */}
      <Dialog open={isDisburseOpen} onOpenChange={setIsDisburseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disburse Loan</DialogTitle>
            <DialogDescription>
              Enter disbursement details for K{Number(selectedLoan?.loan_amount || 0).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Dual-signature warning */}
            {(!(selectedLoan as any)?.borrower_signed || !(selectedLoan as any)?.admin_signed) && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                <AlertTriangle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Signatures Required</p>
                  <p className="text-xs text-muted-foreground">
                    Contract must be signed by both borrower and admin before disbursement. 
                    Please verify signatures in the loan details first.
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Source Account *</Label>
              <Select
                value={disbursement.source_account_id}
                onValueChange={(v) => setDisbursement({ ...disbursement, source_account_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select account to disburse from" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map((account) => (
                    <SelectItem 
                      key={account.id} 
                      value={account.id}
                      disabled={account.balance < (selectedLoan?.loan_amount || 0)}
                    >
                      {account.account_name} - K{account.balance.toLocaleString()} ({account.account_type})
                      {account.balance < (selectedLoan?.loan_amount || 0) && " (Insufficient)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This account will be debited K{Number(selectedLoan?.loan_amount || 0).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Disbursement Method</Label>
              <Select
                value={disbursement.disbursement_method}
                onValueChange={(v) => setDisbursement({ ...disbursement, disbursement_method: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {disbursement.disbursement_method === 'bank_transfer' && (
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={disbursement.account_number}
                  onChange={(e) => setDisbursement({ ...disbursement, account_number: e.target.value })}
                  placeholder="Enter account number"
                />
              </div>
            )}

            {disbursement.disbursement_method === 'mobile_money' && (
              <div className="space-y-2">
                <Label>Mobile Money Number</Label>
                <Input
                  value={disbursement.mobile_money_number}
                  onChange={(e) => setDisbursement({ ...disbursement, mobile_money_number: e.target.value })}
                  placeholder="+260 967 713 001"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Disbursement Date *</Label>
                <Input
                  type="date"
                  value={disbursement.disbursement_date}
                  onChange={(e) => setDisbursement({ ...disbursement, disbursement_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>First Repayment Date *</Label>
                <Input
                  type="date"
                  value={disbursement.first_repayment_date}
                  onChange={(e) => setDisbursement({ ...disbursement, first_repayment_date: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A repayment schedule of {selectedLoan?.loan_term_months} installments will be generated starting from the first repayment date.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisburseOpen(false)}>Cancel</Button>
            {can('disbursement', 'disburse') && (
              <Button onClick={handleDisburse} disabled={disburseMutation.isPending}>
                {disburseMutation.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}
                <DollarSign size={16} className="mr-1" />
                Confirm Disbursement
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedLoan && !['pending', 'rejected', 'under_review'].includes(selectedLoan.status) ? (
                <>
                  <p className="text-destructive font-semibold mb-2">
                    Cannot delete this loan. Only pending, rejected, or under review loans can be deleted.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Current status: <span className="font-semibold">{selectedLoan.status}</span>
                  </p>
                </>
              ) : (
                <>
                  Are you sure you want to delete the loan application for{" "}
                  <span className="font-semibold">{selectedLoan?.full_name}</span>?
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {selectedLoan && ['pending', 'rejected', 'under_review'].includes(selectedLoan.status) && can('loans', 'delete') && (
              <AlertDialogAction
                onClick={() => selectedLoan && deleteMutation.mutate(selectedLoan.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  <Label>Payment Method</Label>
                  <Select
                    value={quickPaymentData.payment_method}
                    onValueChange={(v) => setQuickPaymentData({ ...quickPaymentData, payment_method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">
                        <div className="flex items-center gap-2">
                          <Phone size={14} />
                          Mobile Money
                        </div>
                      </SelectItem>
                      <SelectItem value="bank_transfer">
                        <div className="flex items-center gap-2">
                          <Building size={14} />
                          Bank Transfer
                        </div>
                      </SelectItem>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <Banknote size={14} />
                          Cash
                        </div>
                      </SelectItem>
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
                <Button variant="outline" onClick={() => setIsQuickPaymentOpen(false)}>
                  Cancel
                </Button>
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
    </AdminLayout>
  );
};

export default AdminLoans;