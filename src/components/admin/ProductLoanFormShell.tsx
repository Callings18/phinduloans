import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoan } from "@/utils/loanCalculations";
import { useProductLoanRules } from "@/hooks/useProductLoanRules";
import type { LoanProductCode } from "@/config/loanProductModules";
import { calculateMarketeerLoan, getMarketeerTiersOrDefault, generateMarketeerCollectionDates } from "@/lib/marketeerCalculations";
import { fetchHouseProductByCode } from "@/services/repositories/houseRepository";
import { BetaBadge } from "@/components/admin/BetaBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addDays, format } from "date-fns";
import { AlertTriangle, CalendarDays, FileText, User, Briefcase, MapPin, CheckCircle2, Upload, Camera, X, RotateCcw, Trash2, Save, Loader2 } from "lucide-react";
import CollateralBorrowersSection, {
  type CollateralBorrowerEntry,
  makeBlankBorrower,
  validateCollateralBorrowers,
} from "@/components/loans/CollateralBorrowersSection";

type Borrower = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  nrc_number: string | null;
  address: string | null;
  city: string | null;
  employer_name: string | null;
  employment_type: string | null;
  job_title: string | null;
  net_income: number | null;
};

interface ProductLoanFormShellProps {
  productCode: LoanProductCode;
  title: string;
  description: string;
  termUnit: "days" | "weeks" | "months";
  defaultTermValue: number;
  showChecklist?: boolean;
  successRedirectPath?: string;
}

export default function ProductLoanFormShell({
  productCode,
  title,
  description,
  termUnit,
  defaultTermValue,
  showChecklist = true,
  successRedirectPath = "/admin/applications",
}: ProductLoanFormShellProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rules = useProductLoanRules(productCode);

  const resolveProduct = async (code: LoanProductCode) => {
    return fetchHouseProductByCode(code);
  };

  // --- Core fields ---
  const [borrowerId, setBorrowerId] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [termValue, setTermValue] = useState(String(defaultTermValue));
  const [loanPurpose, setLoanPurpose] = useState("");
  const [employmentType, setEmploymentType] = useState<"employed" | "self_employed" | "contract" | "other">(
    productCode === "MARKETEER" ? "self_employed" : "employed"
  );
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [city, setCity] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [repaymentStartDate, setRepaymentStartDate] = useState(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));

  // --- Marketeer-specific fields ---
  const [businessMonths, setBusinessMonths] = useState("0");
  const [isCivilServantConfirmed, setIsCivilServantConfirmed] = useState(false);
  const [hasLocalAuthorityCompliance, setHasLocalAuthorityCompliance] = useState(false);
  const [businessAddress, setBusinessAddress] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [idType, setIdType] = useState("NRC");
  const [idNumber, setIdNumber] = useState("");
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  // --- Document uploads ---
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({});
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [vaultDocs, setVaultDocs] = useState<Record<string, { file_url: string; file_name: string }>>({});

  // --- Collateral multi-borrower (COLLATERAL product only) ---
  const [primaryBorrowerEntry, setPrimaryBorrowerEntry] = useState<CollateralBorrowerEntry>(() =>
    makeBlankBorrower("PRIMARY_BORROWER"),
  );
  const [coBorrowerEntries, setCoBorrowerEntries] = useState<CollateralBorrowerEntry[]>([]);
  const [absoluteOwnerEntries, setAbsoluteOwnerEntries] = useState<CollateralBorrowerEntry[]>([]);

  // Failure recovery state — captures last error and any partially created loan id
  // so the user can retry the submit or roll back the orphaned draft in one click.
  const [lastError, setLastError] = useState<string | null>(null);
  const [pendingLoanId, setPendingLoanId] = useState<string | null>(null);
  const [rollbackPending, setRollbackPending] = useState(false);

  // Pre-populate docs from borrower's permanent vault
  useEffect(() => {
    if (!borrowerId) { setVaultDocs({}); return; }
    (async () => {
      const { data } = await supabase
        .from("borrower_document_vault")
        .select("doc_type, doc_label, file_url, file_name")
        .eq("borrower_id", borrowerId)
        .order("uploaded_at", { ascending: false });
      if (!data) return;
      const map: Record<string, { file_url: string; file_name: string }> = {};
      data.forEach((d) => {
        // Map vault doc_type to checklist label
        const label = d.doc_label || d.doc_type;
        if (!map[label]) map[label] = { file_url: d.file_url, file_name: d.file_name };
      });
      setVaultDocs(map);
    })();
  }, [borrowerId]);

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product-by-code", productCode],
    queryFn: () => resolveProduct(productCode),
  });

  const { data: borrowers } = useQuery({
    queryKey: ["product-loan-borrowers", productCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, nrc_number, address, city, employer_name, employment_type, job_title, net_income")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Borrower[];
    },
  });

  const selectedBorrower = useMemo(
    () => (borrowers || []).find((b) => b.id === borrowerId) || null,
    [borrowers, borrowerId]
  );

  useEffect(() => {
    if (selectedBorrower) {
      if (selectedBorrower.phone) setContactNumber(selectedBorrower.phone);
      if (selectedBorrower.nrc_number) setIdNumber(selectedBorrower.nrc_number);
      if (selectedBorrower.address) setResidentialAddress(selectedBorrower.address);
      if (selectedBorrower.city) setCity(selectedBorrower.city);
      if (selectedBorrower.employer_name) setEmployerName(selectedBorrower.employer_name);
      if (selectedBorrower.job_title) setJobTitle(selectedBorrower.job_title);
      if (selectedBorrower.net_income) setMonthlyIncome(String(selectedBorrower.net_income));
      if (selectedBorrower.employment_type) setEmploymentType(selectedBorrower.employment_type as any);

      // Sync primary borrower entry for collateral multi-borrower section
      setPrimaryBorrowerEntry((prev) => ({
        ...prev,
        customer_id: selectedBorrower.id,
        full_name: selectedBorrower.full_name || "",
        nrc_number: selectedBorrower.nrc_number || "",
        phone: selectedBorrower.phone || "",
        address: selectedBorrower.address || "",
        is_signatory: true,
      }));
    }
  }, [selectedBorrower]);

  const validationErrors = useMemo(
    () =>
      rules.validate({
        employmentType,
        city,
        loanAmount: Number(loanAmount || 0),
        termValue: Number(termValue || 0),
        businessMonths: Number(businessMonths || 0),
        isCivilServantConfirmed,
        hasLocalAuthorityCompliance,
        productMinAmount: product?.min_amount ?? null,
        productMaxAmount: product?.max_amount ?? null,
      }),
    [rules, employmentType, city, loanAmount, termValue, businessMonths, isCivilServantConfirmed, hasLocalAuthorityCompliance, product?.min_amount, product?.max_amount]
  );

  const collateralBorrowersValidation = useMemo(
    () =>
      productCode === "COLLATERAL"
        ? validateCollateralBorrowers(primaryBorrowerEntry, coBorrowerEntries, absoluteOwnerEntries)
        : { isValid: true, errors: [] as string[], warnings: [] as string[], signatoryCount: 0 },
    [productCode, primaryBorrowerEntry, coBorrowerEntries, absoluteOwnerEntries],
  );

  const isMarketeer = productCode === "MARKETEER";
  const isSalaryAdvanceFamily = productCode === "SALARY_ADVANCE" || productCode === "SALARY_ADVANCE_STAFF";
  const usesDailySchedule = termUnit === "days";
  const minRepaymentStartDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const marketeerMinAmount = isMarketeer ? Number(product?.min_amount || 500) : 0;
  const marketeerMaxAmount = isMarketeer ? Number(product?.max_amount || 10000) : 0;
  const marketeerRangeLabel = `K${marketeerMinAmount.toLocaleString()} – K${marketeerMaxAmount.toLocaleString()}`;

  const marketeerResult = useMemo(() => {
    if (!isMarketeer || !product || !loanAmount) return null;
    const principal = Number(loanAmount || 0);
    if (principal <= 0) return null;
    const tiers = getMarketeerTiersOrDefault((product as any).pricing_tiers, product.min_amount, product.max_amount);
    return calculateMarketeerLoan(principal, tiers);
  }, [isMarketeer, product, loanAmount]);

  const collectionDates = useMemo(() => {
    if (!isMarketeer || !marketeerResult) return [];
    const start = repaymentStartDate ? new Date(repaymentStartDate) : new Date();
    return generateMarketeerCollectionDates(start, marketeerResult.durationDays);
  }, [isMarketeer, marketeerResult, repaymentStartDate]);

  const preview = useMemo(() => {
    if (!product || !loanAmount || !termValue) return null;
    const principal = Number(loanAmount || 0);
    if (principal <= 0) return null;

    if (isMarketeer && marketeerResult) {
      return {
        repayment: marketeerResult.totalRepayment,
        interest: marketeerResult.totalInterest,
        installmentLabel: `Daily installment (${marketeerResult.durationDays} days, Mon–Fri)`,
        installment: marketeerResult.dailyInstallment,
        dailyRate: `${(marketeerResult.tier.interestPercent / marketeerResult.durationDays).toFixed(3)}%`,
      };
    }

    const calc = calculateLoan(
      principal,
      Number(termValue),
      {
        product_code: productCode,
        interest_rate: Number(product.interest_rate || 0),
        interest_period: (product.interest_period || "monthly") as "daily" | "weekly" | "monthly" | "yearly",
        interest_type: ((product.interest_type as string) || "flat") as "flat" | "reducing",
        processing_fee_percent: Number(product.processing_fee_percent || 0),
        enforcement_fee_percent: Number(product.enforcement_fee_percent || 0),
        insurance_percent: Number(product.insurance_percent || 0),
        vat_percent: Number(product.vat_percent || 0),
        platform_fee_percent: Number(product.platform_fee_percent || 0),
      },
      termUnit
    );
    return {
      repayment: calc.totalRepayment,
      interest: calc.totalInterest,
      installmentLabel: termUnit === "days" ? "Daily installment" : termUnit === "weeks" ? "Weekly installment" : "Monthly installment",
      installment: calc.dailyPayment || calc.weeklyPayment || calc.monthlyPayment,
      dailyRate: null,
    };
  }, [product, loanAmount, termValue, productCode, termUnit, isMarketeer, marketeerResult]);

  const handleFileSelect = (docLabel: string, file: File | null) => {
    setDocFiles((prev) => ({ ...prev, [docLabel]: file }));
  };

  const uploadDocuments = async (loanId: string, borrowerId: string): Promise<Record<string, string>> => {
    const uploaded: Record<string, string> = {};
    for (const [label, file] of Object.entries(docFiles)) {
      if (!file) continue;
      const ext = file.name.split(".").pop() || "jpg";
      const sanitizedLabel = label.replace(/\s+/g, "_").toLowerCase();
      const path = `loan-docs/${borrowerId}/${loanId}/${sanitizedLabel}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(path, file, { upsert: true });
      if (uploadError) {
        console.error(`Upload failed for ${label}:`, uploadError);
        continue;
      }
      uploaded[label] = path;

      // Save to permanent borrower vault (persists across loans)
      await supabase.from("borrower_document_vault").insert({
        borrower_id: borrowerId,
        doc_type: sanitizedLabel,
        doc_label: label,
        file_url: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      }).then(({ error }) => { if (error) console.warn("Vault insert:", error); });

      // Save to application_documents (per-loan, visible to admin)
      await supabase.from("application_documents").insert({
        application_id: loanId,
        borrower_id: borrowerId,
        doc_type: sanitizedLabel,
        doc_label: label,
        file_url: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      }).then(({ error }) => { if (error) console.warn("App doc insert:", error); });
    }

    // Also link any vault docs that weren't re-uploaded (reused from previous loans)
    for (const [label, vDoc] of Object.entries(vaultDocs)) {
      if (uploaded[label]) continue; // already uploaded fresh
      // Link vault doc to this application
      await supabase.from("application_documents").insert({
        application_id: loanId,
        borrower_id: borrowerId,
        doc_type: label.replace(/\s+/g, "_").toLowerCase(),
        doc_label: label,
        file_url: vDoc.file_url,
        file_name: vDoc.file_name,
        mime_type: "image/jpeg",
        file_size: 0,
      }).then(({ error }) => { if (error) console.warn("Vault link:", error); });
      uploaded[label] = vDoc.file_url;
    }

    return uploaded;
  };

  const allDocsProvided = rules.checklist.every((item) => docFiles[item] || vaultDocs[item]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBorrower) throw new Error("Select a borrower first.");
      if (!user?.id) throw new Error("User session not found.");
      if (!loanAmount || !termValue || !loanPurpose || !monthlyIncome) {
        throw new Error("Fill in all required loan fields.");
      }
      if (usesDailySchedule && !repaymentStartDate) {
        throw new Error("Repayment start date is required.");
      }
      if (usesDailySchedule && repaymentStartDate < minRepaymentStartDate) {
        throw new Error("Repayment start date must be tomorrow or later.");
      }
      if (validationErrors.length > 0) throw new Error(validationErrors[0]);
      if (productCode === "COLLATERAL" && !collateralBorrowersValidation.isValid) {
        throw new Error(collateralBorrowersValidation.errors[0] || "Borrowers section incomplete.");
      }

      const activeProduct = product?.id ? product : await resolveProduct(productCode);
      if (activeProduct?.id) {
        queryClient.setQueryData(["product-by-code", productCode], activeProduct);
      }
      if (!activeProduct?.id) throw new Error("Loan product not found. Check product_code setup.");

      // SAFEGUARD: if a previous attempt already created a pending loan row,
      // do NOT insert another. Verify it still exists & is pending; if so, resume
      // the flow against that same id (re-upload docs, refresh metadata).
      // If it's gone or no longer pending, clear the marker and proceed fresh.
      if (pendingLoanId) {
        const { data: existing } = await supabase
          .from("loan_applications")
          .select("id, status")
          .eq("id", pendingLoanId)
          .maybeSingle();
        if (existing && existing.status === "pending") {
          setDocUploading(true);
          try {
            await uploadDocuments(existing.id, selectedBorrower.id);
          } finally {
            setDocUploading(false);
          }
          return existing.id;
        }
        // Stale marker — clear and fall through to a fresh insert.
        setPendingLoanId(null);
      }

      let totalRepayment = 0;
      let installmentAmount = 0;

      if (isMarketeer && marketeerResult) {
        totalRepayment = marketeerResult.totalRepayment;
        installmentAmount = marketeerResult.dailyInstallment;
      } else {
        const calc = calculateLoan(
          Number(loanAmount),
          Number(termValue),
          {
            product_code: productCode,
            interest_rate: Number(activeProduct.interest_rate || 0),
            interest_period: (activeProduct.interest_period || "monthly") as "daily" | "weekly" | "monthly" | "yearly",
            interest_type: ((activeProduct.interest_type as string) || "flat") as "flat" | "reducing",
            processing_fee_percent: Number(activeProduct.processing_fee_percent || 0),
            enforcement_fee_percent: Number(activeProduct.enforcement_fee_percent || 0),
            insurance_percent: Number(activeProduct.insurance_percent || 0),
            vat_percent: Number(activeProduct.vat_percent || 0),
            platform_fee_percent: Number(activeProduct.platform_fee_percent || 0),
          },
          termUnit
        );
        totalRepayment = calc.totalRepayment;
        installmentAmount = calc.monthlyPayment;
      }

      const payload = {
        user_id: selectedBorrower.id,
        loan_product_id: activeProduct.id,
        full_name: selectedBorrower.full_name || selectedBorrower.email,
        email: selectedBorrower.email,
        phone: contactNumber || selectedBorrower.phone || "",
        nrc_number: idNumber || selectedBorrower.nrc_number || "",
        address: residentialAddress || selectedBorrower.address || null,
        city: city || selectedBorrower.city || null,
        employer_name: employerName || selectedBorrower.employer_name || null,
        job_title: jobTitle || selectedBorrower.job_title || null,
        employment_type: employmentType,
        monthly_income: Number(monthlyIncome),
        loan_amount: Number(loanAmount),
        loan_term_months: Number(termValue),
        term_unit: termUnit,
        loan_purpose: loanPurpose,
        interest_rate: Number(activeProduct.interest_rate || 0),
        monthly_payment: installmentAmount,
        total_repayment: totalRepayment,
        admin_notes: adminNotes || null,
        source: "internal",
        status: "pending" as const,
        repayment_start_date: usesDailySchedule ? repaymentStartDate : null,
        product_specific_data: {
          product_code: productCode,
          business_months: Number(businessMonths || 0),
          civil_servant_confirmed: isCivilServantConfirmed,
          local_authority_compliance: hasLocalAuthorityCompliance,
          business_address: businessAddress,
          residential_address: residentialAddress,
          id_type: idType,
          id_number: idNumber,
          gender,
          marital_status: maritalStatus,
          contact_number: contactNumber,
          uploaded_docs: {} as Record<string, string>,
          approvals: {
            loan_officer: { status: "pending" },
            finance: { status: "pending" },
            manager: { status: "pending" },
          },
        },
      };

      const { data: inserted, error } = await supabase
        .from("loan_applications")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // Persist multi-borrower structure for COLLATERAL only (DB trigger also enforces this)
      if (productCode === "COLLATERAL" && inserted?.id) {
        const rows = [
          {
            loan_application_id: inserted.id,
            customer_id: primaryBorrowerEntry.customer_id || selectedBorrower.id,
            full_name: primaryBorrowerEntry.full_name,
            nrc_number: primaryBorrowerEntry.nrc_number,
            phone: primaryBorrowerEntry.phone || null,
            address: primaryBorrowerEntry.address || null,
            role: "PRIMARY_BORROWER" as const,
            is_signatory: primaryBorrowerEntry.is_signatory,
            created_by: user?.id ?? null,
          },
          ...coBorrowerEntries.map((b) => ({
            loan_application_id: inserted.id,
            customer_id: b.customer_id || null,
            full_name: b.full_name,
            nrc_number: b.nrc_number,
            phone: b.phone || null,
            address: b.address || null,
            role: "CO_BORROWER" as const,
            is_signatory: b.is_signatory,
            created_by: user?.id ?? null,
          })),
          ...absoluteOwnerEntries.map((b) => ({
            loan_application_id: inserted.id,
            customer_id: b.customer_id || null,
            full_name: b.full_name,
            nrc_number: b.nrc_number,
            phone: b.phone || null,
            address: b.address || null,
            role: "ABSOLUTE_OWNER" as const,
            is_signatory: b.is_signatory,
            created_by: user?.id ?? null,
          })),
        ];
        const { error: borrowersErr } = await supabase.from("loan_borrowers").insert(rows);
        if (borrowersErr) console.error("Failed to insert loan_borrowers:", borrowersErr);
      }

      if (inserted?.id) {
        setPendingLoanId(inserted.id);
        setDocUploading(true);
        try {
          const uploadedPaths = await uploadDocuments(inserted.id, selectedBorrower.id);
          if (Object.keys(uploadedPaths).length > 0) {
            await supabase
              .from("loan_applications")
              .update({
                product_specific_data: {
                  ...payload.product_specific_data,
                  uploaded_docs: uploadedPaths,
                },
              })
              .eq("id", inserted.id);
          }
        } finally {
          setDocUploading(false);
        }
      }
      return inserted?.id ?? null;
    },
    onSuccess: () => {
      setLastError(null);
      setPendingLoanId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      toast({ title: `${title} application created`, description: "Loan moved to pending review." });
      navigate(successRedirectPath);
    },
    onError: (error: Error) => {
      setLastError(error.message || "Loan creation failed.");
      toast({ title: "Unable to create loan", description: error.message, variant: "destructive" });
    },
  });

  const rollbackPendingLoan = async () => {
    if (!pendingLoanId) return;
    setRollbackPending(true);
    try {
      const { error } = await supabase
        .from("loan_applications")
        .delete()
        .eq("id", pendingLoanId)
        .eq("status", "pending");
      if (error) throw error;
      toast({ title: "Draft rolled back", description: "The unfinished loan has been removed. You can edit and try again." });
      setPendingLoanId(null);
      setLastError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rollback failed.";
      toast({ title: "Rollback failed", description: msg, variant: "destructive" });
    } finally {
      setRollbackPending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <BetaBadge />
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge variant="outline" className="text-sm">{productCode}</Badge>
        </div>

        {/* Tabbed Form - compact, no excessive spacing */}
        <Tabs defaultValue="customer" className="space-y-3">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="customer" className="text-xs">
              <User className="h-3.5 w-3.5 mr-1" /> Customer
            </TabsTrigger>
            <TabsTrigger value="loan" className="text-xs">
              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Loan Details
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1" /> Documents
              {allDocsProvided && <CheckCircle2 className="h-3 w-3 ml-1 text-green-600" />}
            </TabsTrigger>
            {isMarketeer && collectionDates.length > 0 && (
              <TabsTrigger value="schedule" className="text-xs">
                <CalendarDays className="h-3.5 w-3.5 mr-1" /> Schedule
              </TabsTrigger>
            )}
          </TabsList>

          {/* ===== TAB 1: Customer Info + Address + Employment ===== */}
          <TabsContent value="customer" className="space-y-3 mt-0">
            {/* Borrower Select */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-semibold">Borrower *</Label>
                    <Select value={borrowerId} onValueChange={setBorrowerId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Search and select borrower..." /></SelectTrigger>
                      <SelectContent>
                        {(borrowers || []).map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {(b.full_name || b.email) + (b.nrc_number ? ` — ${b.nrc_number}` : "") + (b.phone ? ` — ${b.phone}` : "")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedBorrower && (
                    <div className="md:col-span-2 bg-muted/30 rounded-md px-3 py-2 text-xs flex gap-4 flex-wrap">
                      <span><span className="text-muted-foreground">Name:</span> <strong>{selectedBorrower.full_name}</strong></span>
                      <span><span className="text-muted-foreground">Phone:</span> {selectedBorrower.phone || "—"}</span>
                      <span><span className="text-muted-foreground">NRC:</span> {selectedBorrower.nrc_number || "—"}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Contact Number *</Label>
                    <Input className="h-9" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="0971234567" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">ID Type</Label>
                    <Select value={idType} onValueChange={setIdType}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NRC">NRC</SelectItem>
                        <SelectItem value="Passport">Passport</SelectItem>
                        <SelectItem value="Driver License">Driver License</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">ID Number *</Label>
                    <Input className="h-9" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="123456/78/9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Marital Status</Label>
                    <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single">Single</SelectItem>
                        <SelectItem value="Married">Married</SelectItem>
                        <SelectItem value="Divorced">Divorced</SelectItem>
                        <SelectItem value="Widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address & Employment side by side */}
            <div className="grid md:grid-cols-2 gap-3">
              {/* Address */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Address & Location</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  {isMarketeer && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Business Address *</Label>
                      <Input className="h-9" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="Market stall / stand number" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Residential Address</Label>
                    <Input className="h-9" value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} placeholder="House number, area" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">City / Town</Label>
                    <Input className="h-9" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              {/* Employment / Business */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">{isMarketeer ? "Business Info" : "Employment"}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employment Type *</Label>
                    <Select value={employmentType} onValueChange={(v: any) => setEmploymentType(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employed">Employed</SelectItem>
                        <SelectItem value="self_employed">Self-employed / Business Owner</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isMarketeer ? "Monthly Business Income (K)" : "Monthly Income (K)"} *</Label>
                    <Input className="h-9" type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
                  </div>
                  {!isMarketeer && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Employer Name</Label>
                        <Input className="h-9" value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Job Title</Label>
                        <Input className="h-9" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                      </div>
                    </>
                  )}
                  {isMarketeer && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Business Age (months) *</Label>
                      <Input className="h-9" type="number" value={businessMonths} onChange={(e) => setBusinessMonths(e.target.value)} min={0} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Eligibility Checks inline */}
            {isMarketeer && (
              <Card className="border-primary/20">
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Eligibility Checks
                  </p>
                  <div className="grid md:grid-cols-3 gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={employmentType === "self_employed"} onCheckedChange={() => setEmploymentType("self_employed")} />
                      <span className="text-xs">Business owner</span>
                      {employmentType === "self_employed" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={hasLocalAuthorityCompliance} onCheckedChange={(v) => setHasLocalAuthorityCompliance(Boolean(v))} />
                      <span className="text-xs">Local authority compliance</span>
                      {hasLocalAuthorityCompliance && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={Number(businessMonths) >= 6} disabled />
                      <span className="text-xs">6+ months ({businessMonths}m)</span>
                      {Number(businessMonths) >= 6 && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isSalaryAdvanceFamily && (
              <Card>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isCivilServantConfirmed} onCheckedChange={(v) => setIsCivilServantConfirmed(Boolean(v))} />
                    <span className="text-xs">
                      {productCode === "SALARY_ADVANCE_STAFF"
                        ? "Confirmed borrower is an eligible staff member"
                        : "Confirmed borrower is a civil servant"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== TAB 2: Loan Details ===== */}
          <TabsContent value="loan" className="space-y-3 mt-0">
            <Card>
              <CardContent className="pt-4 pb-4">
                {isMarketeer && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Interest: 30% flat · Duration: 26 business days (Mon–Sat, Sundays excluded) · Daily collection · Range: {marketeerRangeLabel}
                  </p>
                )}
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Loan Amount (K) *</Label>
                    <Input
                      className="h-9"
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      min={isMarketeer ? marketeerMinAmount : 0}
                      max={isMarketeer ? marketeerMaxAmount : undefined}
                      placeholder={isMarketeer ? marketeerRangeLabel : "Enter amount"}
                    />
                    {isMarketeer && loanAmount && (Number(loanAmount) < marketeerMinAmount || Number(loanAmount) > marketeerMaxAmount) && (
                      <p className="text-[10px] text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Must be {marketeerRangeLabel}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Tenure ({termUnit})
                      {isMarketeer && <span className="text-muted-foreground ml-1">(Fixed)</span>}
                      {productCode === "COLLATERAL" && <span className="text-muted-foreground ml-1">(1–6 months)</span>}
                    </Label>
                    {productCode === "COLLATERAL" ? (
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={termValue}
                        onChange={(e) => setTermValue(e.target.value)}
                      >
                        {[1, 2, 3, 4, 5, 6].map((m) => (
                          <option key={m} value={m}>{m} {m === 1 ? "month" : "months"}</option>
                        ))}
                      </select>
                    ) : (
                      <Input className="h-9" type="number" value={termValue} onChange={(e) => setTermValue(e.target.value)} disabled={isMarketeer} />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Purpose *</Label>
                    <Input className="h-9" value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} placeholder={isMarketeer ? "Stock purchase, working capital" : "Loan purpose"} />
                  </div>
                  {usesDailySchedule && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Repayment Start Date *</Label>
                      <Input
                        className="h-9"
                        type="date"
                        value={repaymentStartDate}
                        min={minRepaymentStartDate}
                        onChange={(e) => setRepaymentStartDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Loan Preview */}
                {preview && (
                  <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Principal</p>
                        <p className="font-bold text-sm">K{Number(loanAmount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Interest</p>
                        <p className="font-bold text-sm">K{Number(preview.interest).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Total Repayment</p>
                        <p className="font-bold text-sm text-primary">K{Number(preview.repayment).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">{preview.installmentLabel}</p>
                        <p className="font-bold text-sm">K{Number(preview.installment).toLocaleString()}</p>
                      </div>
                    </div>
                    {preview.dailyRate && (
                      <p className="text-[10px] text-muted-foreground text-center mt-1">Daily rate: {preview.dailyRate}/day</p>
                    )}
                    {productCode === "COLLATERAL" && Number(termValue) > 0 && (
                      <p className="text-[11px] text-muted-foreground text-center mt-2 border-t border-primary/20 pt-2">
                        <span className="font-medium text-foreground">30% flat interest, charged once on the principal</span> — regardless of term.
                        Split across {termValue} {Number(termValue) === 1 ? "month" : "months"} =
                        <span className="font-medium"> {(30 / Number(termValue)).toFixed(2)}% / month</span> effective.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Collateral: Co-Borrowers + Absolute Owners (collateral loans only) */}
            {productCode === "COLLATERAL" && (
              <CollateralBorrowersSection
                primary={primaryBorrowerEntry}
                coBorrowers={coBorrowerEntries}
                absoluteOwners={absoluteOwnerEntries}
                onPrimaryChange={setPrimaryBorrowerEntry}
                onCoBorrowersChange={setCoBorrowerEntries}
                onAbsoluteOwnersChange={setAbsoluteOwnerEntries}
                primaryLocked={!!selectedBorrower}
              />
            )}

            <Card>
              <CardContent className="pt-4 pb-4">
                <Label className="text-xs font-semibold">Admin Notes</Label>
                <Textarea
                  className="mt-1.5"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes about this application..."
                  rows={2}
                />
              </CardContent>
            </Card>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {validationErrors.map((e) => (
                      <p key={e} className="text-xs text-destructive">{e}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex flex-col gap-2 pt-1">
              {productCode === "COLLATERAL" && !collateralBorrowersValidation.isValid && (
                <p className="text-xs text-destructive text-right">
                  Fix {collateralBorrowersValidation.errors.length} borrower issue
                  {collateralBorrowersValidation.errors.length === 1 ? "" : "s"} above before submitting.
                </p>
              )}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => navigate(-1)}>Cancel</Button>
                <Button
                  onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || docUploading || productLoading || validationErrors.length > 0 || (productCode === "COLLATERAL" && !collateralBorrowersValidation.isValid)}
                >
                  {createMutation.isPending || docUploading ? "Creating..." : "Create Loan Application"}
                </Button>
              </div>
            </div>

            {/* Failure recovery: one-click retry + rollback */}
            {lastError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-destructive">Loan creation failed</p>
                    <p className="text-xs text-destructive/90">{lastError}</p>
                    {pendingLoanId && (
                      <p className="text-[11px] text-muted-foreground">
                        A draft loan record was created but not finalised. You can retry to finish it, or roll it back to start clean.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || docUploading || rollbackPending || productLoading || validationErrors.length > 0 || (productCode === "COLLATERAL" && !collateralBorrowersValidation.isValid)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
                  </Button>
                  {pendingLoanId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={rollbackPendingLoan}
                      disabled={rollbackPending || createMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {rollbackPending ? "Rolling back..." : "Rollback draft"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setLastError(null)} disabled={rollbackPending || createMutation.isPending}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ===== TAB 3: Documents (file uploads) ===== */}
          <TabsContent value="documents" className="mt-0">
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Required Documents</CardTitle>
                  <BetaBadge />
                </div>
                <CardDescription className="text-xs">
                  Upload each required document. Photos can be captured directly from camera or selected from files.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid md:grid-cols-2 gap-3">
                  {rules.checklist.map((item) => {
                    const hasFile = !!docFiles[item];
                    const hasVault = !!vaultDocs[item];
                    const covered = hasFile || hasVault;
                    return (
                      <div
                        key={item}
                        className={`border rounded-lg p-3 transition-colors ${
                          covered ? "border-green-600/40 bg-green-600/5" : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">{item}</span>
                          {covered && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        </div>
                        {hasFile ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground truncate flex-1">
                              {docFiles[item]!.name}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => handleFileSelect(item, null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : hasVault ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] border-green-600/30 text-green-600">
                              ✓ From vault: {vaultDocs[item].file_name}
                            </Badge>
                            <input
                              ref={(el) => { fileInputRefs.current[item] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                handleFileSelect(item, f);
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px]"
                              onClick={() => fileInputRefs.current[item]?.click()}
                            >
                              Replace
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <input
                              ref={(el) => { fileInputRefs.current[item] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                handleFileSelect(item, f);
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] flex-1"
                              onClick={() => fileInputRefs.current[item]?.click()}
                            >
                              <Upload className="h-3 w-3 mr-1" /> Upload
                            </Button>
                            <input
                              ref={(el) => { fileInputRefs.current[`${item}_camera`] = el; }}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                handleFileSelect(item, f);
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px]"
                              onClick={() => fileInputRefs.current[`${item}_camera`]?.click()}
                            >
                              <Camera className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {rules.checklist.filter((item) => docFiles[item] || vaultDocs[item]).length} / {rules.checklist.length} documents attached
                  </p>
                  {allDocsProvided && (
                    <Badge variant="outline" className="border-green-600/40 text-green-600 text-xs">
                      All documents attached ✓
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB 4: Collection Schedule (Marketeer) ===== */}
          {isMarketeer && collectionDates.length > 0 && (
            <TabsContent value="schedule" className="mt-0">
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Collection Schedule ({collectionDates.length} business days)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-xs">Day</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Day</TableHead>
                        <TableHead className="text-xs text-right">Amount (K)</TableHead>
                        <TableHead className="text-xs text-right">Running Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketeerResult && collectionDates.map((date, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium py-1.5">{i + 1}</TableCell>
                          <TableCell className="text-xs py-1.5">{format(date, "dd MMM yyyy")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground py-1.5">{format(date, "EEE")}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">K{marketeerResult.dailyInstallment.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right font-medium py-1.5">
                            K{((i + 1) * marketeerResult.dailyInstallment).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
