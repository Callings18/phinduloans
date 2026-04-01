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

export const REQUIRED_DOC_TYPE_OPTIONS: { value: string; label: string; category: string }[] = [
  // KYC / Identity docs
  { value: "nrc_front", label: "NRC Front", category: "Identity (NRC)" },
  { value: "nrc_back", label: "NRC Back", category: "Identity (NRC)" },
  { value: "selfie_holding_nrc", label: "Selfie Holding NRC", category: "Identity (NRC)" },
  // Bank Statements
  { value: "bank_statement_1", label: "Month 1", category: "Bank Statements" },
  { value: "bank_statement_2", label: "Month 2", category: "Bank Statements" },
  { value: "bank_statement_3", label: "Month 3", category: "Bank Statements" },
  // Payslips
  { value: "payslip_1", label: "Latest", category: "Payslips" },
  { value: "payslip_2", label: "Month 2", category: "Payslips" },
  { value: "payslip_3", label: "Month 3", category: "Payslips" },
  // Proof & Employment
  { value: "proof_of_residence", label: "Proof of Residence (Utility Bill)", category: "Proof & Employment" },
  { value: "employer_letter", label: "Employment Letter", category: "Proof & Employment" },
  // Business Docs
  { value: "certificate_of_incorporation", label: "Certificate of Incorporation", category: "Business Documents" },
  { value: "shareholders_details", label: "Shareholders Details", category: "Business Documents" },
  { value: "proof_of_business", label: "Proof of Place of Business", category: "Business Documents" },
  { value: "financial_statement", label: "Financial Statement", category: "Business Documents" },
  // Collateral
  { value: "collateral_details", label: "Collateral Full Details", category: "Collateral" },
  { value: "collateral_images", label: "Collateral Pictures", category: "Collateral" },
  { value: "collateral_estimated_value", label: "Estimated Value of Collateral", category: "Collateral" },
];

/** Group doc options by category */
export function groupDocsByCategory(docs: typeof REQUIRED_DOC_TYPE_OPTIONS) {
  const groups: { category: string; docs: typeof REQUIRED_DOC_TYPE_OPTIONS }[] = [];
  const seen = new Set<string>();
  for (const d of docs) {
    if (!seen.has(d.category)) {
      seen.add(d.category);
      groups.push({ category: d.category, docs: [] });
    }
    groups.find(g => g.category === d.category)!.docs.push(d);
  }
  return groups;
}

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
      product_name: formData.name,
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
              {/* V1.0.1: Simplified single-page form with essential fields only */}
              <div className="space-y-6 pt-4">
                {/* Row 1: Name & Interest Type */}
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
                    <Label>Interest Type *</Label>
                    <Select
                      value={formData.interest_type}
                      onValueChange={(v) => setFormData({ ...formData, interest_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate</SelectItem>
                        <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Amount & Term */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Min Amount (K) *</Label>
                    <Input
                      type="number"
                      value={formData.min_amount}
                      onChange={(e) => setFormData({ ...formData, min_amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Amount (K) *</Label>
                    <Input
                      type="number"
                      value={formData.max_amount}
                      onChange={(e) => setFormData({ ...formData, max_amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Term (months) *</Label>
                    <Input
                      type="number"
                      value={formData.max_term_months}
                      onChange={(e) => setFormData({ ...formData, max_term_months: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Row 3: Interest Rate & Processing Fee */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Interest Rate (%) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.interest_rate}
                      onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">Rate per month</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Processing Fee (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.processing_fee_percent}
                      onChange={(e) => setFormData({ ...formData, processing_fee_percent: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Row 4: Required Documents */}
                <div className="space-y-3">
                  <Label>Required Documents</Label>
                  <div className="space-y-4">
                    {groupDocsByCategory(REQUIRED_DOC_TYPE_OPTIONS).map((group) => (
                      <div key={group.category} className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.category}</p>
                        <div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-border">
                          {group.docs.map((doc) => {
                            const isSelected = formData.required_documents?.some(d => d.document_type === doc.value) || false;
                            return (
                              <div key={doc.value} className="flex items-center gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData({
                                        ...formData,
                                        required_documents: [
                                          ...(formData.required_documents || []),
                                          {
                                            document_type: doc.value,
                                            document_name: doc.label,
                                            is_mandatory: true,
                                            display_order: (formData.required_documents?.length ?? 0) + 1,
                                          },
                                        ],
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        required_documents: formData.required_documents?.filter(d => d.document_type !== doc.value) ?? [],
                                      });
                                    }
                                  }}
                                />
                                <Label className="text-sm font-normal">{doc.label}</Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 5: Description */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the loan product"
                    rows={3}
                  />
                </div>

                {/* Row 6: Active Status */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked, status: checked ? "active" : "inactive" })}
                  />
                  <Label>Product is Active</Label>
                </div>
              </div>

              {/* Fees, Penalties & Advanced */}
              <details className="border border-border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-semibold text-sm text-foreground hover:bg-muted/50 rounded-lg">
                  Fees, Penalties & Advanced Settings
                </summary>
                <div className="px-4 pb-4 pt-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Late Payment Penalty (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.late_payment_penalty_percent}
                        onChange={(e) => setFormData({ ...formData, late_payment_penalty_percent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Penalty Frequency</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={formData.penalty_frequency}
                        onChange={(e) => setFormData({ ...formData, penalty_frequency: e.target.value })}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="one_time">One-time</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Grace Period (days)</Label>
                      <Input
                        type="number"
                        value={formData.grace_period_days}
                        onChange={(e) => setFormData({ ...formData, grace_period_days: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Enforcement Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.enforcement_fee_percent}
                        onChange={(e) => setFormData({ ...formData, enforcement_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Insurance Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.insurance_percent}
                        onChange={(e) => setFormData({ ...formData, insurance_percent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <Switch
                        checked={formData.insurance_required}
                        onCheckedChange={(checked) => setFormData({ ...formData, insurance_required: checked })}
                      />
                      <Label>Insurance Required</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>VAT (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.vat_percent}
                        onChange={(e) => setFormData({ ...formData, vat_percent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Platform Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.platform_fee_percent}
                        onChange={(e) => setFormData({ ...formData, platform_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Early Repayment Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.early_repayment_fee_percent}
                        onChange={(e) => setFormData({ ...formData, early_repayment_fee_percent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={formData.early_repayment_allowed}
                      onCheckedChange={(checked) => setFormData({ ...formData, early_repayment_allowed: checked })}
                    />
                    <Label>Allow Early Repayment</Label>
                  </div>
                </div>
              </details>

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
