import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { logAudit, handleUnauthorized } from "@/utils/auditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProductDocumentManager from "@/components/admin/ProductDocumentManager";
import WorkflowConfiguration from "@/components/admin/WorkflowConfiguration";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Search,
  Percent,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Copy,
  Archive,
  Users,
  FileText,
  Wallet,
  AlertTriangle,
  Link2,
  ShieldAlert,
  Calculator,
  Settings,
  GitBranch,
  MapPin,
  Globe,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateLoan, formatCurrency, getInterestPeriodLabel } from "@/utils/loanCalculations";
import { ZAMBIAN_CITIES_LIST } from "@/constants/zambianLocations";
import { cn } from "@/lib/utils";

interface LoanProduct {
  id: string;
  name: string;
  description: string | null;
  product_code: string | null;
  channels: string[] | null;
  status: string | null;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate: number;
  interest_type: string;
  interest_period: string;
  processing_fee_percent: number | null;
  enforcement_fee_percent: number;
  penalty_frequency: string;
  is_active: boolean;
  employment_types: string[] | null;
  requirements: string[] | null;
  grace_period_days: number;
  late_payment_penalty_percent: number;
  early_repayment_allowed: boolean;
  early_repayment_fee_percent: number;
  insurance_required: boolean;
  insurance_percent: number;
  collateral_required: boolean;
  max_dti_ratio: number;
  min_credit_score: number;
  // New fields
  min_age: number | null;
  max_age: number | null;
  min_salary: number | null;
  max_salary_percent: number | null;
  max_concurrent_loans: number | null;
  blacklist_check_required: boolean | null;
  mou_required: boolean | null;
  employer_whitelist_enabled: boolean | null;
  amount_logic: string | null;
  vat_percent: number | null;
  platform_fee_percent: number | null;
  platform_fee_type: string | null;
  repayment_frequency: string | null;
  repayment_methods: string[] | null;
  installment_structure: string | null;
  auto_disbursement: boolean | null;
  partial_disbursement: boolean | null;
  default_threshold_days: number | null;
  legal_escalation_days: number | null;
  contract_template_url: string | null;
  digital_signature_required: boolean | null;
  parent_product_id: string | null;
  version: number | null;
  created_at: string;
  // CRB & Guarantee fields
  crb_check_required: boolean | null;
  crb_auto_decline_score: number | null;
  crb_manual_review_score: number | null;
  crb_auto_approve_score: number | null;
  guarantee_required: boolean | null;
  guarantee_provider: string | null;
  max_guarantee_percent: number | null;
  guarantee_fee_percent: number | null;
  required_documents?: { document_type: string; document_name: string; is_mandatory: boolean; display_order: number }[] | null;
}

export const REQUIRED_DOC_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "nrc_front", label: "NRC Front" },
  { value: "nrc_back", label: "NRC Back" },
  { value: "selfie", label: "Selfie" },
  { value: "payslip", label: "Latest Payslip" },
  { value: "payslip_2", label: "Second Payslip" },
  { value: "payslip_3", label: "Third Payslip" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "employer_letter", label: "Employment Letter" },
  { value: "proof_of_residence", label: "Proof of Residence" },
  { value: "collateral", label: "Collateral Image" },
];

const defaultFormData = {
  name: "",
  description: "",
  product_code: "",
  category: "personal" as string,  // NEW: Loan category
  channels: ["website", "admin"],
  status: "active",
  min_amount: 500,
  max_amount: 50000,
  min_term_months: 1,
  max_term_months: 24,
  term_unit: "months" as string,  // NEW: days/weeks/months/years
  interest_rate: 15,
  interest_type: "flat",
  interest_period: "monthly",
  processing_fee_percent: 2,
  processing_fee_type: "percentage" as string,  // NEW: fixed/percentage
  enforcement_fee_percent: 10,
  enforcement_fee_type: "percentage" as string,  // NEW: fixed/percentage
  penalty_frequency: "monthly",
  is_active: true,
  requirements: "",
  required_documents: [] as { document_type: string; document_name: string; is_mandatory: boolean; display_order: number }[],
  employment_types: ["employed", "self_employed", "contract"],
  grace_period_days: 0,
  late_payment_penalty_percent: 5,
  early_repayment_allowed: true,
  early_repayment_fee_percent: 0,
  insurance_required: false,
  insurance_percent: 0,
  collateral_required: false,
  max_dti_ratio: 50,
  min_credit_score: 0,
  // New fields
  min_age: 18,
  max_age: 65,
  min_salary: 0,
  max_salary_percent: 50,
  max_concurrent_loans: 1,
  blacklist_check_required: true,
  mou_required: false,
  employer_whitelist_enabled: false,
  amount_logic: "fixed",
  vat_percent: 0,
  platform_fee_percent: 0,
  platform_fee_type: "percentage",
  repayment_frequency: "monthly",
  repayment_methods: ["bank_transfer", "mobile_money", "payroll_deduction"],
  installment_structure: "equal",
  auto_disbursement: false,
  partial_disbursement: false,
  default_threshold_days: 90,
  legal_escalation_days: 120,
  contract_template_url: "",
  digital_signature_required: false,
  // CRB & Guarantee fields
  crb_check_required: false,
  crb_auto_decline_score: 0,
  crb_manual_review_score: 300,
  crb_auto_approve_score: 600,
  guarantee_required: false,
  guarantee_provider: "",
  max_guarantee_percent: 80,
  guarantee_fee_percent: 0,
  eligible_locations: null as string[] | null,
};

// Type for preview calculation result
interface PreviewCalculation {
  principal: number;
  totalInterest: number;
  processingFee: number;
  enforcementFee: number;
  insuranceFee: number;
  vatAmount: number;
  platformFee: number;
  feesDeductedUpfront: number;
  disbursementAmount: number;
  totalRepayment: number;
  monthlyPayment: number;
  effectiveAnnualRate: number;
  termMonths: number;
}

const AdminLoanProducts = () => {
  const { can } = usePermissions();
  const canEditProducts = can("products", "update") || can("products", "edit");
  const canDeleteProducts = can("products", "delete");

  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<LoanProduct | null>(null);
  const [configuringProduct, setConfiguringProduct] = useState<LoanProduct | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  // State-based preview calculation (replaces innerHTML for security)
  const [previewPrincipal, setPreviewPrincipal] = useState<number>(0);
  const [previewTerm, setPreviewTerm] = useState<number>(0);
  const [previewResult, setPreviewResult] = useState<PreviewCalculation | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const calculationTriggeredRef = useRef(false);

  // Function to perform calculation preview (uses React state instead of innerHTML for security)
  const performCalculation = () => {
    const principal = previewPrincipal || formData.min_amount;
    const term = previewTerm || formData.min_term_months;

    // Convert term to months based on term_unit
    let termMonths = term;
    if (formData.term_unit === 'days') termMonths = term / 30;
    else if (formData.term_unit === 'weeks') termMonths = term / 4.33;
    else if (formData.term_unit === 'years') termMonths = term * 12;

    const result = calculateLoan(principal, termMonths, {
      interest_rate: formData.interest_rate,
      interest_period: formData.interest_period as any,
      interest_type: formData.interest_type as any,
      processing_fee_percent: formData.processing_fee_percent,
      insurance_percent: formData.insurance_percent,
      vat_percent: formData.vat_percent,
      platform_fee_percent: formData.platform_fee_percent,
      enforcement_fee_percent: formData.enforcement_fee_percent,
    });

    // Update state instead of using innerHTML (secure approach)
    setPreviewResult({
      principal: result.principal,
      totalInterest: result.totalInterest,
      processingFee: result.processingFee,
      enforcementFee: result.enforcementFee,
      insuranceFee: result.insuranceFee,
      vatAmount: result.vatAmount,
      platformFee: result.platformFee,
      feesDeductedUpfront: result.feesDeductedUpfront,
      disbursementAmount: result.disbursementAmount,
      totalRepayment: result.totalRepayment,
      monthlyPayment: result.monthlyPayment,
      effectiveAnnualRate: result.effectiveAnnualRate,
      termMonths,
    });
  };

  // Auto-calculate when relevant fields change (only if dialog is open and calculation has been triggered once)
  useEffect(() => {
    if (isDialogOpen && calculationTriggeredRef.current) {
      const timer = setTimeout(() => {
        performCalculation();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    formData.interest_rate,
    formData.interest_period,
    formData.interest_type,
    formData.processing_fee_percent,
    formData.enforcement_fee_percent,
    formData.insurance_percent,
    formData.vat_percent,
    formData.platform_fee_percent,
    isDialogOpen
  ]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["loan-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LoanProduct[];
    },
  });

  // Get linked loan counts for each product
  const { data: linkedLoansCounts } = useQuery({
    queryKey: ["loan-products-linked-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("loan_product_id");
      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((app) => {
        if (app.loan_product_id) {
          counts[app.loan_product_id] = (counts[app.loan_product_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: inserted, error } = await supabase.from("loan_products").insert(data).select("id").single();
      if (error) throw error;
      await logAudit({
        action: "CREATE",
        entity_type: "loan_product",
        entity_id: inserted?.id ?? "",
        module: "products",
        new_values: { name: data.name, interest_rate: data.interest_rate },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-products"] });
      toast({ title: "Loan product created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: async (error: Error) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "loan_product",
        entity_id: "",
        module: "products",
      });
      toast({
        title: handled ? "You don't have permission to perform this action." : "Error",
        description: handled ? undefined : error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LoanProduct> }) => {
      const { error } = await supabase.from("loan_products").update(data).eq("id", id);
      if (error) throw error;
      await logAudit({
        action: "UPDATE",
        entity_type: "loan_product",
        entity_id: id,
        module: "products",
        new_values: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-products"] });
      toast({ title: "Loan product updated successfully" });
      setIsDialogOpen(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: async (error: Error, variables) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "loan_product",
        entity_id: variables?.id ?? "",
        module: "products",
      });
      toast({
        title: handled ? "You don't have permission to perform this action." : "Error",
        description: handled ? undefined : error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const linkedCount = linkedLoansCounts?.[id] || 0;

      if (linkedCount > 0) {
        // Has linked applications - archive instead of delete
        const { error } = await supabase
          .from("loan_products")
          .update({ is_active: false, status: "archived" })
          .eq("id", id);
        if (error) throw error;
        await logAudit({
          action: "ARCHIVE",
          entity_type: "loan_product",
          entity_id: id,
          module: "products",
          new_values: { is_active: false, status: "archived" },
        });
        return { archived: true, count: linkedCount };
      } else {
        // No linked applications - safe to delete
        const { error } = await supabase.from("loan_products").delete().eq("id", id);
        if (error) throw error;
        await logAudit({
          action: "DELETE",
          entity_type: "loan_product",
          entity_id: id,
          module: "products",
        });
        return { archived: false };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["loan-products"] });
      setDeleteConfirmProduct(null);
      if (result?.archived) {
        toast({
          title: "Product archived",
          description: `This product has ${result.count} linked loan(s) and was archived instead of deleted.`
        });
      } else {
        toast({ title: "Loan product deleted successfully" });
      }
    },
    onError: async (error: Error, variables) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "loan_product",
        entity_id: variables ?? "",
        module: "products",
      });
      toast({
        title: handled ? "You don't have permission to perform this action." : "Error",
        description: handled ? undefined : error.message,
        variant: "destructive",
      });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (product: LoanProduct) => {
      const clonedData = {
        name: `${product.name} (Copy)`,
        description: product.description,
        product_code: null,
        channels: product.channels,
        status: "inactive",
        min_amount: product.min_amount,
        max_amount: product.max_amount,
        min_term_months: product.min_term_months,
        max_term_months: product.max_term_months,
        interest_rate: product.interest_rate,
        interest_type: product.interest_type,
        interest_period: product.interest_period,
        processing_fee_percent: product.processing_fee_percent,
        enforcement_fee_percent: product.enforcement_fee_percent,
        penalty_frequency: product.penalty_frequency,
        is_active: false,
        requirements: product.requirements,
        required_documents: (product as any).required_documents ?? [],
        employment_types: product.employment_types,
        grace_period_days: product.grace_period_days,
        late_payment_penalty_percent: product.late_payment_penalty_percent,
        early_repayment_allowed: product.early_repayment_allowed,
        early_repayment_fee_percent: product.early_repayment_fee_percent,
        insurance_required: product.insurance_required,
        insurance_percent: product.insurance_percent,
        collateral_required: product.collateral_required,
        max_dti_ratio: product.max_dti_ratio,
        min_credit_score: product.min_credit_score,
        min_age: product.min_age,
        max_age: product.max_age,
        min_salary: product.min_salary,
        max_salary_percent: product.max_salary_percent,
        max_concurrent_loans: product.max_concurrent_loans,
        blacklist_check_required: product.blacklist_check_required,
        mou_required: product.mou_required,
        employer_whitelist_enabled: product.employer_whitelist_enabled,
        amount_logic: product.amount_logic,
        vat_percent: product.vat_percent,
        platform_fee_percent: product.platform_fee_percent,
        platform_fee_type: product.platform_fee_type,
        repayment_frequency: product.repayment_frequency,
        repayment_methods: product.repayment_methods,
        installment_structure: product.installment_structure,
        auto_disbursement: product.auto_disbursement,
        partial_disbursement: product.partial_disbursement,
        default_threshold_days: product.default_threshold_days,
        legal_escalation_days: product.legal_escalation_days,
        contract_template_url: product.contract_template_url,
        digital_signature_required: product.digital_signature_required,
        parent_product_id: product.id,
        version: (product.version || 1) + 1,
        // CRB & Guarantee fields
        crb_check_required: product.crb_check_required,
        crb_auto_decline_score: product.crb_auto_decline_score,
        crb_manual_review_score: product.crb_manual_review_score,
        crb_auto_approve_score: product.crb_auto_approve_score,
        guarantee_required: product.guarantee_required,
        guarantee_provider: product.guarantee_provider,
        max_guarantee_percent: product.max_guarantee_percent,
        guarantee_fee_percent: product.guarantee_fee_percent,
      };

      const { error } = await supabase.from("loan_products").insert(clonedData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-products"] });
      toast({ title: "Product cloned successfully", description: "The copy is set to inactive by default." });
    },
    onError: async (error: Error) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "loan_product",
        entity_id: "",
        module: "products",
      });
      toast({
        title: handled ? "You don't have permission to perform this action." : "Error cloning product",
        description: handled ? undefined : error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    calculationTriggeredRef.current = false; // Reset calculation trigger when resetting
  };

  const handleEdit = (product: LoanProduct) => {
    setEditingProduct(product);
    calculationTriggeredRef.current = false; // Reset calculation trigger when editing
    setFormData({
      name: product.name,
      description: product.description || "",
      product_code: product.product_code || "",
      category: (product as any).category || "personal",  // NEW
      channels: product.channels || ["website", "admin"],
      status: product.status || "active",
      min_amount: product.min_amount,
      max_amount: product.max_amount,
      min_term_months: product.min_term_months,
      max_term_months: product.max_term_months,
      term_unit: (product as any).term_unit || "months",  // NEW
      interest_rate: product.interest_rate,
      interest_type: product.interest_type || "flat",
      interest_period: product.interest_period || "monthly",
      processing_fee_percent: product.processing_fee_percent || 2,
      processing_fee_type: (product as any).processing_fee_type || "percentage",  // NEW
      enforcement_fee_percent: product.enforcement_fee_percent || 0,
      enforcement_fee_type: (product as any).enforcement_fee_type || "percentage",  // NEW
      penalty_frequency: product.penalty_frequency || "monthly",
      is_active: product.is_active,
      requirements: product.requirements?.join("\n") || "",
      required_documents: Array.isArray((product as any).required_documents)
        ? ((product as any).required_documents as { document_type: string; document_name: string; doc_label?: string; is_mandatory?: boolean; display_order?: number }[]).map((d, i) => ({
            document_type: d.document_type || "",
            document_name: d.document_name || d.doc_label || d.document_type || "",
            is_mandatory: d.is_mandatory ?? true,
            display_order: d.display_order ?? i + 1,
          }))
        : [],
      employment_types: product.employment_types || ["employed", "self_employed", "contract"],
      grace_period_days: product.grace_period_days || 0,
      late_payment_penalty_percent: product.late_payment_penalty_percent || 5,
      early_repayment_allowed: product.early_repayment_allowed ?? true,
      early_repayment_fee_percent: product.early_repayment_fee_percent || 0,
      insurance_required: product.insurance_required || false,
      insurance_percent: product.insurance_percent || 0,
      collateral_required: product.collateral_required || false,
      max_dti_ratio: product.max_dti_ratio || 50,
      min_credit_score: product.min_credit_score || 0,
      min_age: product.min_age ?? 18,
      max_age: product.max_age ?? 65,
      min_salary: product.min_salary ?? 0,
      max_salary_percent: product.max_salary_percent ?? 50,
      max_concurrent_loans: product.max_concurrent_loans ?? 1,
      blacklist_check_required: product.blacklist_check_required ?? true,
      mou_required: product.mou_required ?? false,
      employer_whitelist_enabled: product.employer_whitelist_enabled ?? false,
      amount_logic: product.amount_logic || "fixed",
      vat_percent: product.vat_percent ?? 0,
      platform_fee_percent: product.platform_fee_percent ?? 0,
      platform_fee_type: product.platform_fee_type || "percentage",
      repayment_frequency: product.repayment_frequency || "monthly",
      repayment_methods: product.repayment_methods || ["bank_transfer", "mobile_money", "payroll_deduction"],
      installment_structure: product.installment_structure || "equal",
      auto_disbursement: product.auto_disbursement ?? false,
      partial_disbursement: product.partial_disbursement ?? false,
      default_threshold_days: product.default_threshold_days ?? 90,
      legal_escalation_days: product.legal_escalation_days ?? 120,
      contract_template_url: product.contract_template_url || "",
      digital_signature_required: product.digital_signature_required ?? false,
      // CRB & Guarantee fields
      crb_check_required: product.crb_check_required ?? false,
      crb_auto_decline_score: product.crb_auto_decline_score ?? 0,
      crb_manual_review_score: product.crb_manual_review_score ?? 300,
      crb_auto_approve_score: product.crb_auto_approve_score ?? 600,
      guarantee_required: product.guarantee_required ?? false,
      guarantee_provider: product.guarantee_provider || "",
      max_guarantee_percent: product.max_guarantee_percent ?? 80,
      guarantee_fee_percent: product.guarantee_fee_percent ?? 0,
      eligible_locations: (product as any).eligible_locations || null,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const productData = {
      name: formData.name,
      description: formData.description || null,
      product_code: formData.product_code || null,
      channels: formData.channels,
      status: formData.status,
      min_amount: formData.min_amount,
      max_amount: formData.max_amount,
      min_term_months: formData.min_term_months,
      max_term_months: formData.max_term_months,
      term_unit: formData.term_unit, // Save the term unit (days/weeks/months/years)
      interest_rate: formData.interest_rate,
      interest_type: formData.interest_type,
      interest_period: formData.interest_period,
      processing_fee_percent: formData.processing_fee_percent,
      enforcement_fee_percent: formData.enforcement_fee_percent,
      penalty_frequency: formData.penalty_frequency,
      is_active: formData.is_active,
      requirements: formData.requirements.split("\n").filter(r => r.trim()),
      required_documents: formData.required_documents?.length ? formData.required_documents : null,
      employment_types: formData.employment_types,
      grace_period_days: formData.grace_period_days,
      late_payment_penalty_percent: formData.late_payment_penalty_percent,
      early_repayment_allowed: formData.early_repayment_allowed,
      early_repayment_fee_percent: formData.early_repayment_fee_percent,
      insurance_required: formData.insurance_required,
      insurance_percent: formData.insurance_percent,
      collateral_required: formData.collateral_required,
      max_dti_ratio: formData.max_dti_ratio,
      min_credit_score: formData.min_credit_score,
      min_age: formData.min_age,
      max_age: formData.max_age,
      min_salary: formData.min_salary,
      max_salary_percent: formData.max_salary_percent,
      max_concurrent_loans: formData.max_concurrent_loans,
      blacklist_check_required: formData.blacklist_check_required,
      mou_required: formData.mou_required,
      employer_whitelist_enabled: formData.employer_whitelist_enabled,
      amount_logic: formData.amount_logic,
      vat_percent: formData.vat_percent,
      platform_fee_percent: formData.platform_fee_percent,
      platform_fee_type: formData.platform_fee_type,
      repayment_frequency: formData.repayment_frequency,
      repayment_methods: formData.repayment_methods,
      installment_structure: formData.installment_structure,
      auto_disbursement: formData.auto_disbursement,
      partial_disbursement: formData.partial_disbursement,
      default_threshold_days: formData.default_threshold_days,
      legal_escalation_days: formData.legal_escalation_days,
      contract_template_url: formData.contract_template_url || null,
      digital_signature_required: formData.digital_signature_required,
      // CRB & Guarantee fields
      crb_check_required: formData.crb_check_required,
      crb_auto_decline_score: formData.crb_auto_decline_score,
      crb_manual_review_score: formData.crb_manual_review_score,
      crb_auto_approve_score: formData.crb_auto_approve_score,
      guarantee_required: formData.guarantee_required,
      guarantee_provider: formData.guarantee_provider || null,
      max_guarantee_percent: formData.max_guarantee_percent,
      guarantee_fee_percent: formData.guarantee_fee_percent,
      eligible_locations: (formData as any).eligible_locations,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: productData });
    } else {
      createMutation.mutate(productData);
    }
  };

  const toggleActive = (product: LoanProduct) => {
    updateMutation.mutate({
      id: product.id,
      data: {
        is_active: !product.is_active,
        status: !product.is_active ? "active" : "inactive"
      },
    });
  };

  const toggleEmploymentType = (type: string) => {
    const current = formData.employment_types;
    if (current.includes(type)) {
      setFormData({ ...formData, employment_types: current.filter(t => t !== type) });
    } else {
      setFormData({ ...formData, employment_types: [...current, type] });
    }
  };

  const toggleChannel = (channel: string) => {
    const current = formData.channels;
    if (current.includes(channel)) {
      setFormData({ ...formData, channels: current.filter(c => c !== channel) });
    } else {
      setFormData({ ...formData, channels: [...current, channel] });
    }
  };

  const toggleRepaymentMethod = (method: string) => {
    const current = formData.repayment_methods;
    if (current.includes(method)) {
      setFormData({ ...formData, repayment_methods: current.filter(m => m !== method) });
    } else {
      setFormData({ ...formData, repayment_methods: [...current, method] });
    }
  };

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.product_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: products?.length || 0,
    active: products?.filter((p) => p.is_active && p.status !== "archived").length || 0,
    inactive: products?.filter((p) => !p.is_active && p.status !== "archived").length || 0,
    archived: products?.filter((p) => p.status === "archived").length || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Loan Products</h1>
            <p className="text-muted-foreground">Configure loan product templates and rules</p>
          </div>
          {canEditProducts && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingProduct(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus size={18} className="mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Edit Loan Product" : "Create Loan Product"}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-8 h-auto">
                  <TabsTrigger value="basic" className="text-xs px-2 py-2">
                    <Package size={12} className="mr-1" />
                    Basic
                  </TabsTrigger>
                  <TabsTrigger value="eligibility" className="text-xs px-2 py-2">
                    <Users size={12} className="mr-1" />
                    Eligibility
                  </TabsTrigger>
                  <TabsTrigger value="amount" className="text-xs px-2 py-2">
                    <DollarSign size={12} className="mr-1" />
                    Amount
                  </TabsTrigger>
                  <TabsTrigger value="interest" className="text-xs px-2 py-2">
                    <Percent size={12} className="mr-1" />
                    Fees
                  </TabsTrigger>
                  <TabsTrigger value="penalties" className="text-xs px-2 py-2">
                    <AlertTriangle size={12} className="mr-1" />
                    Penalties
                  </TabsTrigger>
                  <TabsTrigger value="repayment" className="text-xs px-2 py-2">
                    <Wallet size={12} className="mr-1" />
                    Repayment
                  </TabsTrigger>
                  <TabsTrigger value="crb_guarantee" className="text-xs px-2 py-2">
                    <ShieldAlert size={12} className="mr-1" />
                    CRB/Guarantee
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs px-2 py-2">
                    <FileText size={12} className="mr-1" />
                    Docs
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs px-2 py-2">
                    <Calculator size={12} className="mr-1" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Basic Info */}
                <TabsContent value="basic" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Product Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Salary Advance, Payroll Loan"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Product Code</Label>
                      <Input
                        value={formData.product_code}
                        onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                        placeholder="e.g., SAL-ADV-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Loan Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(v) => setFormData({ ...formData, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">Personal Loan</SelectItem>
                          <SelectItem value="salary_advance">Salary Advance</SelectItem>
                          <SelectItem value="sme">SME / Business Loan</SelectItem>
                          <SelectItem value="asset_backed">Asset-Backed Loan</SelectItem>
                          <SelectItem value="emergency">Emergency Loan</SelectItem>
                          <SelectItem value="group">Group Loan</SelectItem>
                          <SelectItem value="payroll">Payroll Deduction Loan</SelectItem>
                          <SelectItem value="bnpl">Buy Now Pay Later</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of the loan product"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(v) => setFormData({ ...formData, status: v, is_active: v === "active" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Distribution Channels</Label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {["website", "admin", "ussd", "partner"].map((channel) => (
                          <Badge
                            key={channel}
                            variant={formData.channels.includes(channel) ? "default" : "outline"}
                            className="cursor-pointer capitalize"
                            onClick={() => toggleChannel(channel)}
                          >
                            {channel}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2: Eligibility Rules */}
                <TabsContent value="eligibility" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Minimum Age</Label>
                      <Input
                        type="number"
                        value={formData.min_age}
                        onChange={(e) => setFormData({ ...formData, min_age: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum Age</Label>
                      <Input
                        type="number"
                        value={formData.max_age}
                        onChange={(e) => setFormData({ ...formData, max_age: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Salary (K)</Label>
                      <Input
                        type="number"
                        value={formData.min_salary}
                        onChange={(e) => setFormData({ ...formData, min_salary: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Credit Score</Label>
                      <Input
                        type="number"
                        value={formData.min_credit_score}
                        onChange={(e) => setFormData({ ...formData, min_credit_score: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">0 = no minimum</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum DTI Ratio (%)</Label>
                      <Input
                        type="number"
                        value={formData.max_dti_ratio}
                        onChange={(e) => setFormData({ ...formData, max_dti_ratio: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Concurrent Loans</Label>
                      <Input
                        type="number"
                        value={formData.max_concurrent_loans}
                        onChange={(e) => setFormData({ ...formData, max_concurrent_loans: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Eligible Employment Types</Label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {["employed", "self_employed", "contract", "other"].map((type) => (
                          <Badge
                            key={type}
                            variant={formData.employment_types.includes(type) ? "default" : "outline"}
                            className="cursor-pointer capitalize"
                            onClick={() => toggleEmploymentType(type)}
                          >
                            {type.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {/* NEW: Location Eligibility with Multi-Select */}
                    <div className="col-span-2 space-y-2">
                      <Label>Eligible Locations</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between h-auto min-h-10"
                          >
                            <div className="flex flex-wrap gap-1 flex-1 text-left">
                              {!formData.eligible_locations || formData.eligible_locations.length === 0 ? (
                                <span className="text-muted-foreground">Nationwide (All Locations)</span>
                              ) : (
                                formData.eligible_locations.map((location) => (
                                  <Badge key={location} variant="secondary" className="text-xs">
                                    {location}
                                  </Badge>
                                ))
                              )}
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <div className="p-2 border-b">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-success"
                              onClick={() => setFormData({ ...formData, eligible_locations: null })}
                            >
                              <Globe size={14} className="mr-2" />
                              Nationwide (All Locations)
                            </Button>
                          </div>
                          <ScrollArea className="h-64">
                            <div className="p-2 space-y-1">
                              {ZAMBIAN_CITIES_LIST.map((city) => {
                                const isSelected = formData.eligible_locations?.includes(city) || false;
                                return (
                                  <div
                                    key={city}
                                    className={cn(
                                      "flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent",
                                      isSelected && "bg-primary/10"
                                    )}
                                    onClick={() => {
                                      const current = formData.eligible_locations || [];
                                      if (isSelected) {
                                        const newLocations = current.filter(l => l !== city);
                                        setFormData({ 
                                          ...formData, 
                                          eligible_locations: newLocations.length > 0 ? newLocations : null 
                                        });
                                      } else {
                                        setFormData({ 
                                          ...formData, 
                                          eligible_locations: [...current, city] 
                                        });
                                      }
                                    }}
                                  >
                                    <div className={cn(
                                      "w-4 h-4 border rounded flex items-center justify-center",
                                      isSelected ? "bg-primary border-primary" : "border-input"
                                    )}>
                                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <MapPin size={14} className="text-muted-foreground" />
                                    <span className="text-sm">{city}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Globe size={12} />
                        Leave empty/select "Nationwide" for all locations. Select specific cities to restrict.
                      </p>
                    </div>
                    
                    <div className="col-span-2 grid grid-cols-3 gap-4 pt-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={formData.blacklist_check_required}
                          onCheckedChange={(checked) => setFormData({ ...formData, blacklist_check_required: !!checked })}
                        />
                        <Label className="text-sm">Blacklist Check Required</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={formData.mou_required}
                          onCheckedChange={(checked) => setFormData({ ...formData, mou_required: !!checked })}
                        />
                        <Label className="text-sm">Employer MOU Required</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={formData.employer_whitelist_enabled}
                          onCheckedChange={(checked) => setFormData({ ...formData, employer_whitelist_enabled: !!checked })}
                        />
                        <Label className="text-sm">Employer Whitelist Only</Label>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: Amount & Term */}
                <TabsContent value="amount" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount Logic</Label>
                      <Select
                        value={formData.amount_logic}
                        onValueChange={(v) => setFormData({ ...formData, amount_logic: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed Range</SelectItem>
                          <SelectItem value="salary_based">Salary Based (%)</SelectItem>
                          <SelectItem value="vendor_based">Vendor Based (BNPL)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Max % of Salary (if salary-based)</Label>
                      <Input
                        type="number"
                        value={formData.max_salary_percent}
                        onChange={(e) => setFormData({ ...formData, max_salary_percent: Number(e.target.value) })}
                        disabled={formData.amount_logic !== "salary_based"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Amount (K)</Label>
                      <Input
                        type="number"
                        value={formData.min_amount}
                        onChange={(e) => setFormData({ ...formData, min_amount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Amount (K)</Label>
                      <Input
                        type="number"
                        value={formData.max_amount}
                        onChange={(e) => setFormData({ ...formData, max_amount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Term (months)</Label>
                      <Input
                        type="number"
                        value={formData.min_term_months}
                        onChange={(e) => setFormData({ ...formData, min_term_months: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Term</Label>
                      <Input
                        type="number"
                        value={formData.max_term_months}
                        onChange={(e) => setFormData({ ...formData, max_term_months: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Term Unit</Label>
                      <Select
                        value={formData.term_unit}
                        onValueChange={(v) => setFormData({ ...formData, term_unit: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                          <SelectItem value="years">Years</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Loan duration unit for min/max term</p>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 4: Interest & Fees */}
                <TabsContent value="interest" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Interest Type</Label>
                      <Select
                        value={formData.interest_type}
                        onValueChange={(v) => {
                          setFormData({ ...formData, interest_type: v });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat Rate</SelectItem>
                          <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                          <SelectItem value="compound">Compound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Interest Period</Label>
                      <Select
                        value={formData.interest_period}
                        onValueChange={(v) => {
                          setFormData({ ...formData, interest_period: v });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Per Day</SelectItem>
                          <SelectItem value="weekly">Per Week</SelectItem>
                          <SelectItem value="monthly">Per Month</SelectItem>
                          <SelectItem value="yearly">Per Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Interest Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.interest_rate}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setFormData({ ...formData, interest_rate: newValue });
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Rate per {formData.interest_period}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Processing Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.processing_fee_percent}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setFormData({ ...formData, processing_fee_percent: newValue });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Enforcement/Legal Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.enforcement_fee_percent}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setFormData({ ...formData, enforcement_fee_percent: newValue });
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Deducted before disbursement</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Insurance Premium (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.insurance_percent}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setFormData({ ...formData, insurance_percent: newValue });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>VAT (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.vat_percent}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setFormData({ ...formData, vat_percent: newValue });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Platform Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.platform_fee_percent}
                        onChange={(e) => {
                          const newValue = Number(e.target.value);
                          setFormData({ ...formData, platform_fee_percent: newValue });
                        }}
                      />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-4 pt-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={formData.insurance_required}
                          onCheckedChange={(checked) => setFormData({ ...formData, insurance_required: !!checked })}
                        />
                        <Label className="text-sm">Insurance Required</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={formData.collateral_required}
                          onCheckedChange={(checked) => setFormData({ ...formData, collateral_required: !!checked })}
                        />
                        <Label className="text-sm">Collateral Required</Label>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 5: Penalties & Default */}
                <TabsContent value="penalties" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Grace Period (days)</Label>
                      <Input
                        type="number"
                        value={formData.grace_period_days}
                        onChange={(e) => setFormData({ ...formData, grace_period_days: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Days after due date before late fees apply</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Late Payment Penalty (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.late_payment_penalty_percent}
                        onChange={(e) => setFormData({ ...formData, late_payment_penalty_percent: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Penalty Frequency</Label>
                      <Select
                        value={formData.penalty_frequency}
                        onValueChange={(v) => setFormData({ ...formData, penalty_frequency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Early Repayment Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.early_repayment_fee_percent}
                        onChange={(e) => setFormData({ ...formData, early_repayment_fee_percent: Number(e.target.value) })}
                        disabled={!formData.early_repayment_allowed}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Threshold (days)</Label>
                      <Input
                        type="number"
                        value={formData.default_threshold_days}
                        onChange={(e) => setFormData({ ...formData, default_threshold_days: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Days overdue to mark as defaulted</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Legal Escalation (days)</Label>
                      <Input
                        type="number"
                        value={formData.legal_escalation_days}
                        onChange={(e) => setFormData({ ...formData, legal_escalation_days: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Days overdue for legal action trigger</p>
                    </div>
                    <div className="col-span-2 flex items-center gap-3 pt-2">
                      <Checkbox
                        checked={formData.early_repayment_allowed}
                        onCheckedChange={(checked) => setFormData({ ...formData, early_repayment_allowed: !!checked })}
                      />
                      <Label className="text-sm">Allow Early Repayment</Label>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 6: Repayment Rules */}
                <TabsContent value="repayment" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Repayment Frequency</Label>
                      <Select
                        value={formData.repayment_frequency}
                        onValueChange={(v) => setFormData({ ...formData, repayment_frequency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Installment Structure</Label>
                      <Select
                        value={formData.installment_structure}
                        onValueChange={(v) => setFormData({ ...formData, installment_structure: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equal">Equal Installments</SelectItem>
                          <SelectItem value="balloon">Balloon Payment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Repayment Methods</Label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {["bank_transfer", "mobile_money", "payroll_deduction", "cash"].map((method) => (
                          <Badge
                            key={method}
                            variant={formData.repayment_methods.includes(method) ? "default" : "outline"}
                            className="cursor-pointer capitalize"
                            onClick={() => toggleRepaymentMethod(method)}
                          >
                            {method.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-4 pt-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={formData.auto_disbursement}
                          onCheckedChange={(checked) => setFormData({ ...formData, auto_disbursement: !!checked })}
                        />
                        <Label className="text-sm">Auto Disbursement</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={formData.partial_disbursement}
                          onCheckedChange={(checked) => setFormData({ ...formData, partial_disbursement: !!checked })}
                        />
                        <Label className="text-sm">Allow Partial Disbursement</Label>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 7: Documents & Contracts */}
                <TabsContent value="documents" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Contract Template URL</Label>
                      <Input
                        value={formData.contract_template_url}
                        onChange={(e) => setFormData({ ...formData, contract_template_url: e.target.value })}
                        placeholder="https://storage.example.com/templates/contract.pdf"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Required documents (applicants must upload these)</Label>
                          <p className="text-sm text-muted-foreground">Configure which documents applicants must upload for this product. If empty, applicants cannot complete the document step.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFormData({
                            ...formData,
                            required_documents: [
                              ...(formData.required_documents || []),
                              {
                                document_type: REQUIRED_DOC_TYPE_OPTIONS[0].value,
                                document_name: REQUIRED_DOC_TYPE_OPTIONS[0].label,
                                is_mandatory: true,
                                display_order: (formData.required_documents?.length ?? 0) + 1,
                              },
                            ],
                          })}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add document
                        </Button>
                      </div>
                      {(formData.required_documents?.length ?? 0) > 0 && (
                        <div className="border rounded-md divide-y">
                          {(formData.required_documents || []).map((doc, idx) => (
                            <div key={idx} className="p-3 flex flex-wrap items-center gap-3 bg-muted/30">
                              <Select
                                value={doc.document_type}
                                onValueChange={(v) => {
                                  const opt = REQUIRED_DOC_TYPE_OPTIONS.find(o => o.value === v);
                                  const next = [...(formData.required_documents || [])];
                                  next[idx] = { ...next[idx], document_type: v, document_name: opt?.label ?? v };
                                  setFormData({ ...formData, required_documents: next });
                                }}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {REQUIRED_DOC_TYPE_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                className="flex-1 min-w-[140px]"
                                value={doc.document_name}
                                onChange={(e) => {
                                  const next = [...(formData.required_documents || [])];
                                  next[idx] = { ...next[idx], document_name: e.target.value };
                                  setFormData({ ...formData, required_documents: next });
                                }}
                                placeholder="Display name"
                              />
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`req-mandatory-${idx}`}
                                  checked={doc.is_mandatory}
                                  onCheckedChange={(c) => {
                                    const next = [...(formData.required_documents || [])];
                                    next[idx] = { ...next[idx], is_mandatory: !!c };
                                    setFormData({ ...formData, required_documents: next });
                                  }}
                                />
                                <Label htmlFor={`req-mandatory-${idx}`} className="text-sm whitespace-nowrap">Mandatory</Label>
                              </div>
                              <Input
                                type="number"
                                className="w-16"
                                min={1}
                                value={doc.display_order}
                                onChange={(e) => {
                                  const next = [...(formData.required_documents || [])];
                                  next[idx] = { ...next[idx], display_order: parseInt(e.target.value, 10) || 1 };
                                  setFormData({ ...formData, required_documents: next });
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setFormData({
                                  ...formData,
                                  required_documents: formData.required_documents?.filter((_, i) => i !== idx) ?? [],
                                })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Document Requirements (one per line)</Label>
                      <Textarea
                        value={formData.requirements}
                        onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                        placeholder="Valid NRC (front & back)&#10;Latest payslip&#10;3 months bank statement&#10;Proof of residence"
                        rows={6}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <Checkbox
                        checked={formData.digital_signature_required}
                        onCheckedChange={(checked) => setFormData({ ...formData, digital_signature_required: !!checked })}
                      />
                      <Label className="text-sm">Digital Signature Required</Label>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 8: CRB & Credit Guarantee */}
                <TabsContent value="crb_guarantee" className="space-y-4 pt-4">
                  <div className="space-y-6">
                    {/* CRB Settings */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">Credit Reference Bureau (CRB)</h4>
                          <p className="text-sm text-muted-foreground">Require credit check before loan approval</p>
                        </div>
                        <Switch
                          checked={formData.crb_check_required}
                          onCheckedChange={(checked) => setFormData({ ...formData, crb_check_required: checked })}
                        />
                      </div>

                      {formData.crb_check_required && (
                        <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-primary/30">
                          <div className="space-y-2">
                            <Label>Auto-Decline Score</Label>
                            <Input
                              type="number"
                              value={formData.crb_auto_decline_score}
                              onChange={(e) => setFormData({ ...formData, crb_auto_decline_score: Number(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">Below this = auto reject</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Manual Review Score</Label>
                            <Input
                              type="number"
                              value={formData.crb_manual_review_score}
                              onChange={(e) => setFormData({ ...formData, crb_manual_review_score: Number(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">Between decline & approve = manual</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Auto-Approve Score</Label>
                            <Input
                              type="number"
                              value={formData.crb_auto_approve_score}
                              onChange={(e) => setFormData({ ...formData, crb_auto_approve_score: Number(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">Above this = auto approve</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Guarantee Settings */}
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">Credit Guarantee</h4>
                          <p className="text-sm text-muted-foreground">Require PMIC/ZCGS guarantee coverage</p>
                        </div>
                        <Switch
                          checked={formData.guarantee_required}
                          onCheckedChange={(checked) => setFormData({ ...formData, guarantee_required: checked })}
                        />
                      </div>

                      {formData.guarantee_required && (
                        <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-primary/30">
                          <div className="space-y-2">
                            <Label>Guarantee Provider</Label>
                            <Select
                              value={formData.guarantee_provider}
                              onValueChange={(v) => setFormData({ ...formData, guarantee_provider: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pmic">PMIC</SelectItem>
                                <SelectItem value="zcgs">ZCGS</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Max Guarantee %</Label>
                            <Input
                              type="number"
                              value={formData.max_guarantee_percent}
                              onChange={(e) => setFormData({ ...formData, max_guarantee_percent: Number(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">Coverage percentage</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Guarantee Fee %</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.guarantee_fee_percent}
                              onChange={(e) => setFormData({ ...formData, guarantee_fee_percent: Number(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">Fee charged to borrower</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 9: Calculation Preview */}
                <TabsContent value="preview" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Calculator size={18} className="text-primary" />
                        Test Calculation Preview
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Enter sample values to preview how this product calculates loans.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Sample Principal (K)</Label>
                          <Input
                            type="number"
                            value={previewPrincipal || formData.min_amount}
                            onChange={(e) => setPreviewPrincipal(Number(e.target.value))}
                            placeholder="e.g., 5000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Sample Term ({formData.term_unit})</Label>
                          <Input
                            type="number"
                            value={previewTerm || formData.min_term_months}
                            onChange={(e) => setPreviewTerm(Number(e.target.value))}
                            placeholder="e.g., 6"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                          calculationTriggeredRef.current = true;
                          performCalculation();
                        }}
                      >
                        <Calculator size={16} className="mr-2" />
                        Calculate Preview
                      </Button>
                    </div>

                    {/* React state-based preview result (secure - no innerHTML) */}
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50 min-h-[200px]">
                      {previewResult ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-3 rounded-lg bg-background border">
                            <span className="text-muted-foreground">Principal</span>
                            <p className="font-semibold text-foreground">{formatCurrency(previewResult.principal)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-background border">
                            <span className="text-muted-foreground">Interest ({formData.interest_rate}% {getInterestPeriodLabel(formData.interest_period as any)})</span>
                            <p className="font-semibold text-foreground">{formatCurrency(previewResult.totalInterest)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-background border">
                            <span className="text-muted-foreground">Processing Fee</span>
                            <p className="font-semibold text-foreground">{formatCurrency(previewResult.processingFee)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-background border">
                            <span className="text-muted-foreground">Enforcement Fee</span>
                            <p className="font-semibold text-foreground">{formatCurrency(previewResult.enforcementFee)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-background border">
                            <span className="text-muted-foreground">Insurance</span>
                            <p className="font-semibold text-foreground">{formatCurrency(previewResult.insuranceFee)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-background border">
                            <span className="text-muted-foreground">VAT</span>
                            <p className="font-semibold text-foreground">{formatCurrency(previewResult.vatAmount)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-background border">
                            <span className="text-muted-foreground">Platform Fee</span>
                            <p className="font-semibold text-foreground">{formatCurrency(previewResult.platformFee)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-background border">
                            <span className="text-muted-foreground">Total Fees (deducted)</span>
                            <p className="font-semibold text-foreground">{formatCurrency(previewResult.feesDeductedUpfront)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-success/10 border border-success/30">
                            <span className="text-muted-foreground">Borrower Receives</span>
                            <p className="font-bold text-success">{formatCurrency(previewResult.disbursementAmount)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                            <span className="text-muted-foreground">Total Repayment</span>
                            <p className="font-bold text-primary">{formatCurrency(previewResult.totalRepayment)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-background border col-span-2">
                            <span className="text-muted-foreground">Monthly Payment ({previewResult.termMonths.toFixed(1)} months)</span>
                            <p className="font-semibold text-lg text-foreground">{formatCurrency(previewResult.monthlyPayment)} /month</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50 border col-span-2 text-xs text-muted-foreground">
                            Effective Annual Rate: {previewResult.effectiveAnnualRate.toFixed(2)}% | Interest Type: {formData.interest_type}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          Click "Calculate Preview" to see results
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 text-sm">
                      <p className="font-medium text-warning mb-1">⚠️ Formula Details</p>
                      <ul className="text-muted-foreground space-y-1">
                        <li>• <strong>Flat Rate:</strong> Interest = Principal × Rate × Term</li>
                        <li>• <strong>Reducing Balance:</strong> Uses amortization formula (PMT)</li>
                        <li>• <strong>Fees:</strong> Deducted from principal before disbursement</li>
                        <li>• <strong>Repayment:</strong> Principal + Interest (fees already taken)</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="gradient-primary"
                  onClick={handleSubmit}
                  disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                >
                  {editingProduct ? "Update Product" : "Create Product"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl gradient-primary">
                  <Package className="text-primary-foreground" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <CheckCircle className="text-success" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted">
                  <XCircle className="text-muted-foreground" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inactive</p>
                  <p className="text-2xl font-bold text-foreground">{stats.inactive}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Archive className="text-warning" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Archived</p>
                  <p className="text-2xl font-bold text-foreground">{stats.archived}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Products Table */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>All Products</CardTitle>
            <CardDescription>Configure loan product templates and rules</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Amount Range</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead>Linked Loans</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts?.map((product) => (
                    <TableRow key={product.id} className={product.status === "archived" ? "opacity-60" : ""}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          {product.product_code && (
                            <p className="text-xs text-muted-foreground font-mono">{product.product_code}</p>
                          )}
                          <div className="flex gap-1 mt-1">
                            {product.channels?.map((ch) => (
                              <Badge key={ch} variant="outline" className="text-[10px] capitalize">{ch}</Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign size={14} className="text-muted-foreground" />
                          K{product.min_amount.toLocaleString()} - K{product.max_amount.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock size={14} className="text-muted-foreground" />
                          {product.min_term_months} - {product.max_term_months} {(product as any).term_unit?.slice(0, 1) || 'mo'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Percent size={14} className="text-muted-foreground" />
                            {product.interest_rate}% <span className="text-xs text-muted-foreground">/{product.interest_period?.charAt(0)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">{product.interest_type}</p>
                        </div>
                      </TableCell>
                      {/* Availability column */}
                      <TableCell>
                        {(() => {
                          const locations = (product as any).eligible_locations;
                          const isNationwide = !locations || locations.length === 0;
                          return (
                            <div className="flex items-center gap-1">
                              {isNationwide ? (
                                <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                                  <Globe size={12} className="mr-1" />
                                  Nationwide
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                                  <MapPin size={12} className="mr-1" />
                                  {locations.length === 1 
                                    ? locations[0] 
                                    : `${locations.length} cities`}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Link2 size={14} className="text-muted-foreground" />
                          {linkedLoansCounts?.[product.id] || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.status === "archived" ? (
                          <Badge variant="secondary" className="bg-warning/10 text-warning">
                            <Archive size={12} className="mr-1" />
                            Archived
                          </Badge>
                        ) : (
                          <Badge
                            variant={product.is_active ? "default" : "secondary"}
                            className={product.is_active ? "bg-success/10 text-success border-success/20" : ""}
                          >
                            {product.is_active ? "Active" : "Inactive"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {product.status !== "archived" && (
                            <Switch
                              checked={product.is_active}
                              onCheckedChange={() => toggleActive(product)}
                            />
                          )}
                          {canEditProducts && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cloneMutation.mutate(product)}
                                title="Clone product"
                              >
                                <Copy size={16} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                                <Pencil size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setConfiguringProduct(product)}
                                title="Configure Docs & Workflow"
                              >
                                <Settings size={16} className="text-primary" />
                              </Button>
                              {canDeleteProducts && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirmProduct(product)}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Configure Product Sheet (Docs & Workflow) */}
        <Sheet open={!!configuringProduct} onOpenChange={(open) => !open && setConfiguringProduct(null)}>
          <SheetContent className="sm:max-w-4xl overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl flex items-center gap-2">
                <Settings className="text-primary" size={24} />
                Configure: {configuringProduct?.name}
              </SheetTitle>
              <SheetDescription>
                Manage document requirements and the approval workflow for this loan product.
              </SheetDescription>
            </SheetHeader>

            {configuringProduct && (
              <Tabs defaultValue="documents" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="documents" className="flex items-center gap-2">
                    <FileText size={16} />
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="workflow" className="flex items-center gap-2">
                    <GitBranch size={16} />
                    Approval Workflow
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="documents" className="mt-0 border-none p-0">
                  <ProductDocumentManager
                    productId={configuringProduct.id}
                    productName={configuringProduct.name}
                  />
                </TabsContent>
                <TabsContent value="workflow" className="mt-0 border-none p-0">
                  <WorkflowConfiguration
                    productId={configuringProduct.id}
                    productName={configuringProduct.name}
                  />
                </TabsContent>
              </Tabs>
            )}
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmProduct} onOpenChange={() => setDeleteConfirmProduct(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Loan Product?</AlertDialogTitle>
              <AlertDialogDescription>
                {(linkedLoansCounts?.[deleteConfirmProduct?.id || ""] || 0) > 0 ? (
                  <>
                    This product has <strong>{linkedLoansCounts?.[deleteConfirmProduct?.id || ""]}</strong> linked loan(s).
                    It will be <strong>archived</strong> instead of deleted to preserve history.
                  </>
                ) : (
                  <>This product has no linked loans and will be permanently deleted.</>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteConfirmProduct && deleteMutation.mutate(deleteConfirmProduct.id)}
              >
                {(linkedLoansCounts?.[deleteConfirmProduct?.id || ""] || 0) > 0 ? "Archive" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminLoanProducts;
