import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { AlertTriangle, CalendarDays, FileText, User, Briefcase, MapPin, CheckCircle2, Upload, Camera, X, RotateCcw, Trash2, Save, Loader2, FolderOpen, Search, ChevronsUpDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
  gender: string | null;
  marital_status: string | null;
};

interface ProductLoanFormShellProps {
  productCode: LoanProductCode;
  title: string;
  description: string;
  termUnit: "days" | "weeks" | "months";
  defaultTermValue: number;
  showChecklist?: boolean;
  successRedirectPath?: string;
  /** When set, the form runs in EDIT mode against an existing loan_applications.id. */
  editLoanId?: string;
}

export default function ProductLoanFormShell({
  productCode,
  title,
  description,
  termUnit,
  defaultTermValue,
  showChecklist = true,
  successRedirectPath = "/admin/applications",
  editLoanId,
}: ProductLoanFormShellProps) {
  const isEditMode = !!editLoanId;
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rules = useProductLoanRules(productCode);
  const [searchParams] = useSearchParams();
  // Optional URL params used by the Drafts page when resuming.
  // ?borrower=<uuid>  → preselects the borrower so the auto-resume effect kicks in.
  // ?draft=<uuid>     → falls back to a direct fetch by draft id (ignores borrower
  //                     mismatch so even an orphaned draft can be opened once).
  const initialBorrowerParam = searchParams.get("borrower") || "";
  const draftIdParam = searchParams.get("draft") || "";

  const resolveProduct = async (code: LoanProductCode) => {
    return fetchHouseProductByCode(code);
  };

  // --- Core fields ---
  const [borrowerId, setBorrowerId] = useState(initialBorrowerParam);
  const [borrowerPickerOpen, setBorrowerPickerOpen] = useState(false);
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

  // --- Editable interest (admin can override the product defaults per loan) ---
  // Empty string means "not yet initialised" — defaults are seeded from the
  // product (or the loan being edited) once data loads.
  const [interestRate, setInterestRate] = useState("");
  const [interestPeriod, setInterestPeriod] = useState("");
  const interestInitedRef = useRef(false);



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

  // Draft save & resume
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const draftLoadedRef = useRef(false);

  // Hydrate every form field from a saved draft payload. Used by both the
  // auto-resume effect (matches by staff+borrower+product) and the explicit
  // ?draft=<id> URL flow used by the Drafts page.
  const hydrateFromDraft = (draft: { id: string; form_data: any; updated_at: string }) => {
    const f: any = draft.form_data || {};
    setDraftId(draft.id);
    setDraftSavedAt(new Date(draft.updated_at));
    if (f.loanAmount) setLoanAmount(f.loanAmount);
    if (f.termValue) setTermValue(f.termValue);
    if (f.loanPurpose) setLoanPurpose(f.loanPurpose);
    if (f.employmentType) setEmploymentType(f.employmentType);
    if (f.monthlyIncome) setMonthlyIncome(f.monthlyIncome);
    if (f.employerName) setEmployerName(f.employerName);
    if (f.jobTitle) setJobTitle(f.jobTitle);
    if (f.city) setCity(f.city);
    if (f.adminNotes) setAdminNotes(f.adminNotes);
    if (f.repaymentStartDate) setRepaymentStartDate(f.repaymentStartDate);
    if (f.businessMonths) setBusinessMonths(f.businessMonths);
    if (f.businessAddress) setBusinessAddress(f.businessAddress);
    if (f.residentialAddress) setResidentialAddress(f.residentialAddress);
    if (f.idType) setIdType(f.idType);
    if (f.idNumber) setIdNumber(f.idNumber);
    if (f.gender) setGender(f.gender);
    if (f.maritalStatus) setMaritalStatus(f.maritalStatus);
    if (f.contactNumber) setContactNumber(f.contactNumber);
    // Collateral multi-borrower section (only meaningful for productCode === "COLLATERAL")
    if (f.primaryBorrowerEntry) setPrimaryBorrowerEntry(f.primaryBorrowerEntry);
    if (Array.isArray(f.coBorrowerEntries)) setCoBorrowerEntries(f.coBorrowerEntries);
    if (Array.isArray(f.absoluteOwnerEntries)) setAbsoluteOwnerEntries(f.absoluteOwnerEntries);
  };

  // Load draft when borrower selected (auto-resume by composite key).
  useEffect(() => {
    if (!borrowerId || !user?.id) return;
    draftLoadedRef.current = false;
    (async () => {
      const { data } = await supabase
        .from("loan_application_drafts")
        .select("id, form_data, updated_at")
        .eq("staff_user_id", user.id)
        .eq("borrower_id", borrowerId)
        .eq("product_code", productCode)
        .maybeSingle();
      if (data?.form_data) {
        hydrateFromDraft(data);
        toast({ title: "Draft restored", description: `Resumed your saved draft from ${new Date(data.updated_at).toLocaleString()}` });
      } else {
        setDraftId(null);
        setDraftSavedAt(null);
      }
      draftLoadedRef.current = true;
    })();
  }, [borrowerId, user?.id, productCode]);

  // Direct ?draft=<id> resume — fetch by id even if no borrower is preselected.
  // Useful if the borrower row was deleted or the draft pre-dates picker logic.
  useEffect(() => {
    if (!draftIdParam || !user?.id) return;
    if (draftId === draftIdParam) return;
    (async () => {
      const { data, error } = await supabase
        .from("loan_application_drafts")
        .select("id, form_data, updated_at, borrower_id, product_code")
        .eq("id", draftIdParam)
        .maybeSingle();
      if (error || !data) return;
      if (data.borrower_id && !borrowerId) {
        setBorrowerId(data.borrower_id);
      }
      hydrateFromDraft({ id: data.id, form_data: data.form_data, updated_at: data.updated_at });
      toast({
        title: "Draft restored",
        description: `Resumed your saved draft from ${new Date(data.updated_at).toLocaleString()}`,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftIdParam, user?.id]);

  const saveDraft = async () => {
    if (!user?.id) return;
    if (!borrowerId) {
      toast({ title: "Select borrower first", description: "A borrower must be selected before saving a draft.", variant: "destructive" });
      return;
    }
    setSavingDraft(true);
    try {
      const form_data = {
        loanAmount, termValue, loanPurpose, employmentType, monthlyIncome,
        employerName, jobTitle, city, adminNotes, repaymentStartDate,
        businessMonths, businessAddress, residentialAddress,
        idType, idNumber, gender, maritalStatus, contactNumber,
        // Collateral multi-borrower section (no-op for non-collateral products).
        // The Supabase generated types want a JSON object here; the entry shape is
        // a plain TS interface with no index signature, so we serialize through
        // JSON to satisfy the type-checker without losing any fields.
        primaryBorrowerEntry,
        coBorrowerEntries,
        absoluteOwnerEntries,
      };
      const form_data_json = JSON.parse(JSON.stringify(form_data));
      const { data, error } = await supabase
        .from("loan_application_drafts")
        .upsert(
          { staff_user_id: user.id, borrower_id: borrowerId, product_code: productCode, form_data: form_data_json, updated_at: new Date().toISOString() },
          { onConflict: "staff_user_id,borrower_id,product_code" }
        )
        .select("id")
        .single();
      if (error) throw error;
      setDraftId(data.id);
      setDraftSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ["admin-loan-drafts"] });
      toast({ title: "Draft saved", description: "You can come back and resume this loan anytime." });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  const deleteDraft = async () => {
    if (!draftId) return;
    await supabase.from("loan_application_drafts").delete().eq("id", draftId);
    setDraftId(null);
    setDraftSavedAt(null);
    queryClient.invalidateQueries({ queryKey: ["admin-loan-drafts"] });
  };


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

  // Seed the editable interest rate/period from the product defaults once it loads.
  // In edit mode the dedicated edit-hydration effect seeds these instead (so we skip
  // here once that has run). After the first seed the admin's manual edits stick.
  useEffect(() => {
    if (interestInitedRef.current) return;
    if (isEditMode) return; // edit hydration handles seeding
    if (!product) return;
    setInterestRate(String(product.interest_rate ?? ""));
    setInterestPeriod(((product.interest_period as string) || "monthly"));
    interestInitedRef.current = true;
  }, [product, isEditMode]);


  const { data: borrowers } = useQuery({
    queryKey: ["product-loan-borrowers", productCode],
    queryFn: async () => {
      // Load borrowers that belong to THIS product house, newest first, so a
      // freshly added borrower appears at the very top of the picker.
      const { data: memberships, error: membershipError } = await (supabase.from as any)("product_house_borrowers")
        .select("borrower_id, created_at")
        .eq("product_code", productCode)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (membershipError) throw membershipError;

      const orderedIds: string[] = Array.from(
        new Set(
          (memberships ?? [])
            .map((row: { borrower_id: unknown }) => row.borrower_id)
            .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
        )
      );
      if (orderedIds.length === 0) return [] as Borrower[];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, nrc_number, address, city, employer_name, employment_type, job_title, net_income, gender, marital_status")
        .in("id", orderedIds);
      if (error) throw error;

      // Preserve the membership ordering (newest borrower first).
      const map = new Map((data as Borrower[]).map((b) => [b.id, b]));
      return orderedIds.map((id) => map.get(id)).filter(Boolean) as Borrower[];
    },
    enabled: Boolean(productCode),
  });

  const selectedBorrower = useMemo(
    () => (borrowers || []).find((b) => b.id === borrowerId) || null,
    [borrowers, borrowerId]
  );

  // In edit mode we hydrate fields directly from the existing loan and must NOT
  // let the borrower-autofill effect clobber edited values. We track whether
  // hydration has already happened.
  const editHydratedRef = useRef(false);

  useEffect(() => {
    if (isEditMode) return; // edit mode hydrates from the loan, not from borrower defaults
    if (selectedBorrower) {
      if (selectedBorrower.phone) setContactNumber(selectedBorrower.phone);
      if (selectedBorrower.nrc_number) setIdNumber(selectedBorrower.nrc_number);
      if (selectedBorrower.address) setResidentialAddress(selectedBorrower.address);
      if (selectedBorrower.city) setCity(selectedBorrower.city);
      if (selectedBorrower.employer_name) setEmployerName(selectedBorrower.employer_name);
      if (selectedBorrower.job_title) setJobTitle(selectedBorrower.job_title);
      if (selectedBorrower.net_income) setMonthlyIncome(String(selectedBorrower.net_income));
      if (selectedBorrower.employment_type) setEmploymentType(selectedBorrower.employment_type as any);
      if (selectedBorrower.gender) setGender(selectedBorrower.gender);
      if (selectedBorrower.marital_status) setMaritalStatus(selectedBorrower.marital_status);

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
  }, [selectedBorrower, isEditMode]);

  // ===== EDIT MODE: load loan + borrowers and hydrate every field once. =====
  const { data: editLoanData } = useQuery({
    queryKey: ["edit-loan-shell", editLoanId],
    enabled: isEditMode,
    queryFn: async () => {
      const { data: loan, error } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("id", editLoanId!)
        .maybeSingle();
      if (error) throw error;
      const { data: lbs } = await supabase
        .from("loan_borrowers")
        .select("*")
        .eq("loan_application_id", editLoanId!);
      return { loan, borrowers: lbs ?? [] };
    },
  });

  useEffect(() => {
    if (!isEditMode || editHydratedRef.current) return;
    const loan = editLoanData?.loan as any;
    if (!loan) return;
    editHydratedRef.current = true;
    setBorrowerId(loan.user_id ?? "");
    setLoanAmount(String(loan.loan_amount ?? ""));
    setTermValue(String(loan.loan_term_months ?? defaultTermValue));
    setLoanPurpose(loan.loan_purpose ?? "");
    setEmploymentType((loan.employment_type as any) || "employed");
    setMonthlyIncome(loan.monthly_income != null ? String(loan.monthly_income) : "");
    setEmployerName(loan.employer_name ?? "");
    setJobTitle(loan.job_title ?? "");
    setCity(loan.city ?? "");
    setAdminNotes(loan.admin_notes ?? "");
    if (loan.repayment_start_date) setRepaymentStartDate(loan.repayment_start_date);
    setContactNumber(loan.phone ?? "");
    setIdNumber(loan.nrc_number ?? "");
    setResidentialAddress(loan.address ?? "");
    const psd = (loan.product_specific_data as any) || {};
    if (psd.business_months != null) setBusinessMonths(String(psd.business_months));
    if (psd.civil_servant_confirmed) setIsCivilServantConfirmed(true);
    if (psd.local_authority_compliance) setHasLocalAuthorityCompliance(true);
    if (psd.business_address) setBusinessAddress(psd.business_address);
    if (psd.id_type) setIdType(psd.id_type);
    if (psd.gender) setGender(psd.gender);
    if (psd.marital_status) setMaritalStatus(psd.marital_status);

    // Seed editable interest from the saved loan (falling back to product defaults).
    setInterestRate(String(loan.interest_rate ?? product?.interest_rate ?? ""));
    setInterestPeriod((psd.interest_period as string) || (product?.interest_period as string) || "monthly");
    interestInitedRef.current = true;


    if (productCode === "COLLATERAL") {
      const rows = editLoanData!.borrowers as any[];
      const primary = rows.find((r) => r.role === "PRIMARY_BORROWER");
      const co = rows.filter((r) => r.role === "CO_BORROWER");
      const owners = rows.filter((r) => r.role === "ABSOLUTE_OWNER");
      const toEntry = (r: any): CollateralBorrowerEntry => ({
        uid: r.id,
        customer_id: r.customer_id,
        full_name: r.full_name ?? "",
        nrc_number: r.nrc_number ?? "",
        phone: r.phone ?? "",
        address: r.address ?? "",
        role: r.role,
        is_signatory: r.is_signatory ?? true,
      });
      if (primary) setPrimaryBorrowerEntry(toEntry(primary));
      else
        setPrimaryBorrowerEntry({
          ...makeBlankBorrower("PRIMARY_BORROWER"),
          customer_id: loan.user_id,
          full_name: loan.full_name ?? "",
          nrc_number: loan.nrc_number ?? "",
          phone: loan.phone ?? "",
          address: loan.address ?? "",
        });
      setCoBorrowerEntries(co.map(toEntry));
      setAbsoluteOwnerEntries(owners.map(toEntry));
    }
  }, [isEditMode, editLoanData, productCode, defaultTermValue]);


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

  // Surface product location eligibility (mirrors the DB enforce_loan_product_location()
  // trigger) so admins get a clear message instead of a silent rejected insert.
  const locationError = useMemo(() => {
    const locs = ((product as any)?.eligible_locations as string[] | null) ?? null;
    if (!locs || locs.length === 0) return null; // nationwide product
    const normalized = locs.map((l) => l.trim().toLowerCase()).filter(Boolean);
    if (normalized.length === 0) return null;
    const cityValue = (city || selectedBorrower?.city || "").trim().toLowerCase();
    if (!cityValue) return `City is required for this product. Available only in: ${locs.join(", ")}.`;
    if (!normalized.includes(cityValue)) {
      return `This product is only available in: ${locs.join(", ")}. Borrower city "${city || selectedBorrower?.city}" is not eligible.`;
    }
    return null;
  }, [product, city, selectedBorrower?.city]);

  const collateralBorrowersValidation = useMemo(
    () =>
      productCode === "COLLATERAL"
        ? validateCollateralBorrowers(primaryBorrowerEntry, coBorrowerEntries, absoluteOwnerEntries)
        : { isValid: true, errors: [] as string[], warnings: [] as string[], signatoryCount: 0 },
    [productCode, primaryBorrowerEntry, coBorrowerEntries, absoluteOwnerEntries],
  );

  // Combined list of blocking issues shown to the admin and used to gate submit.
  const blockingErrors = useMemo(
    () => (locationError ? [...validationErrors, locationError] : validationErrors),
    [validationErrors, locationError],
  );



  const isMarketeer = productCode === "MARKETEER";
  const isPaydaySoft = productCode === "PAYDAY_SOFT";
  const isSalaryAdvanceFamily = productCode === "SALARY_ADVANCE" || productCode === "SALARY_ADVANCE_STAFF";
  const usesDailySchedule = termUnit === "days" && !isPaydaySoft;
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
        installmentLabel: `Daily installment (${marketeerResult.durationDays} days, Mon–Sat)`,
        installment: marketeerResult.dailyInstallment,
        dailyRate: `${(marketeerResult.tier.interestPercent / marketeerResult.durationDays).toFixed(3)}%`,
      };
    }

    const calc = calculateLoan(
      principal,
      Number(termValue),
      {
        product_code: productCode,
        interest_rate: Number(interestRate || product.interest_rate || 0),
        interest_period: ((interestPeriod || product.interest_period || "monthly")) as any,
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
      installmentLabel: isPaydaySoft ? "Single payment (due on day 30)" : termUnit === "days" ? "Daily installment" : termUnit === "weeks" ? "Weekly installment" : "Monthly installment",
      installment: calc.dailyPayment || calc.weeklyPayment || calc.monthlyPayment,
      dailyRate: null,
    };
  }, [product, loanAmount, termValue, productCode, termUnit, isMarketeer, isPaydaySoft, marketeerResult]);

  const handleFileSelect = (docLabel: string, file: File | null) => {
    setDocFiles((prev) => ({ ...prev, [docLabel]: file }));
  };

  const uploadDocuments = async (loanId: string, borrowerId: string): Promise<Record<string, string>> => {
    const uploaded: Record<string, string> = {};
    const failures: string[] = [];
    const adminUid = (await supabase.auth.getUser()).data.user?.id ?? null;

    for (const [label, file] of Object.entries(docFiles)) {
      if (!file) continue;
      const ext = file.name.split(".").pop() || "jpg";
      const sanitizedLabel = label.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
      const path = `loan-docs/${borrowerId}/${loanId}/${sanitizedLabel}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) {
        console.error(`[uploadDocuments] Storage upload failed for "${label}":`, uploadError);
        failures.push(`${label}: ${uploadError.message}`);
        continue;
      }

      // Per-loan record — REQUIRED. If this fails, the doc is invisible to admins.
      const { error: appErr } = await supabase.from("application_documents").insert({
        application_id: loanId,
        borrower_id: borrowerId,
        doc_type: sanitizedLabel,
        doc_label: label,
        file_url: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        uploaded_by: adminUid ?? "admin",
        status: "uploaded",
      });
      if (appErr) {
        console.error(`[uploadDocuments] application_documents insert failed for "${label}":`, appErr, {
          application_id: loanId, borrower_id: borrowerId, path,
        });
        failures.push(`${label}: could not save record (${appErr.message})`);
        // Storage upload still succeeded, but record is missing — leave in storage so we can retry.
        continue;
      }
      uploaded[label] = path;

      // Best-effort vault persistence (cross-loan reuse). Non-blocking.
      const { error: vaultErr } = await supabase.from("borrower_document_vault").insert({
        borrower_id: borrowerId,
        doc_type: sanitizedLabel,
        doc_label: label,
        file_url: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      });
      if (vaultErr) console.warn(`[uploadDocuments] vault insert (non-blocking) for "${label}":`, vaultErr);
    }

    // Link any vault docs that weren't re-uploaded (reused from previous loans)
    for (const [label, vDoc] of Object.entries(vaultDocs)) {
      if (uploaded[label]) continue;
      const sanitizedLabel = label.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
      const { error: linkErr } = await supabase.from("application_documents").insert({
        application_id: loanId,
        borrower_id: borrowerId,
        doc_type: sanitizedLabel,
        doc_label: label,
        file_url: vDoc.file_url,
        file_name: vDoc.file_name || `${sanitizedLabel}.bin`,
        mime_type: "application/octet-stream",
        file_size: 0,
        uploaded_by: adminUid ?? "admin",
        status: "uploaded",
      });
      if (linkErr) {
        console.error(`[uploadDocuments] Vault-link insert failed for "${label}":`, linkErr);
        failures.push(`${label} (reused): ${linkErr.message}`);
        continue;
      }
      uploaded[label] = vDoc.file_url;
    }

    if (failures.length > 0) {
      // Surface failures so the admin actually knows docs didn't persist.
      throw new Error(
        `Some documents could not be saved and are NOT attached to the loan:\n• ${failures.join("\n• ")}`
      );
    }

    return uploaded;
  };

  const allDocsProvided = rules.checklist.every((item) => docFiles[item] || vaultDocs[item]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBorrower) throw new Error("Select a borrower first.");
      if (!user?.id) throw new Error("User session not found.");
      // Build a specific list of missing fields so the user knows exactly what to fix
      // (the previous generic "Fill in all required loan fields" was a UX dead-end).
      const missing: string[] = [];
      if (!loanAmount) missing.push("Loan Amount");
      if (!termValue) missing.push(`Tenure (${termUnit})`);
      if (!loanPurpose) missing.push("Loan Purpose");
      if (!monthlyIncome) missing.push(isMarketeer ? "Monthly Business Income" : "Monthly Income");
      if (missing.length > 0) {
        throw new Error(
          missing.length === 1
            ? `Missing required field: ${missing[0]}.`
            : `Missing required fields: ${missing.join(", ")}.`,
        );
      }
      if (usesDailySchedule && !repaymentStartDate) {
        throw new Error("Repayment start date is required.");
      }
      if (usesDailySchedule && repaymentStartDate < minRepaymentStartDate) {
        throw new Error("Repayment start date must be tomorrow or later.");
      }
      if (blockingErrors.length > 0) throw new Error(blockingErrors[0]);
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

      // Persist enriched borrower data back to profile (gender, marital, employment, etc.)
      await supabase.from("profiles").update({
        gender: gender || null,
        marital_status: maritalStatus || null,
        phone: contactNumber || selectedBorrower.phone,
        nrc_number: idNumber || selectedBorrower.nrc_number,
        address: residentialAddress || selectedBorrower.address,
        city: city || selectedBorrower.city,
        employer_name: employerName || selectedBorrower.employer_name,
        job_title: jobTitle || selectedBorrower.job_title,
        employment_type: employmentType,
        net_income: Number(monthlyIncome) || selectedBorrower.net_income,
      }).eq("id", selectedBorrower.id);

      return inserted?.id ?? null;
    },
    onSuccess: async () => {
      setLastError(null);
      setPendingLoanId(null);
      await deleteDraft();
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      queryClient.invalidateQueries({ queryKey: ["product-loan-borrowers", productCode] });
      toast({ title: `${title} application created`, description: "Loan moved to pending review." });
      navigate(successRedirectPath);
    },
    onError: (error: Error) => {
      setLastError(error.message || "Loan creation failed.");
      toast({ title: "Unable to create loan", description: error.message, variant: "destructive" });
    },
  });

  // ===== EDIT MODE: update mutation that mirrors the create payload. =====
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!isEditMode || !editLoanId) throw new Error("Not in edit mode");
      if (!user?.id) throw new Error("User session not found.");
      if (!selectedBorrower) throw new Error("Select a borrower first.");
      const missing: string[] = [];
      if (!loanAmount) missing.push("Loan Amount");
      if (!termValue) missing.push(`Tenure (${termUnit})`);
      if (!loanPurpose) missing.push("Loan Purpose");
      if (!monthlyIncome) missing.push(isMarketeer ? "Monthly Business Income" : "Monthly Income");
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(", ")}`);
      if (blockingErrors.length > 0) throw new Error(blockingErrors[0]);
      if (productCode === "COLLATERAL" && !collateralBorrowersValidation.isValid) {
        throw new Error(collateralBorrowersValidation.errors[0] || "Borrowers section incomplete.");
      }

      const activeProduct = product?.id ? product : await resolveProduct(productCode);
      let totalRepayment = 0;
      let installmentAmount = 0;
      if (isMarketeer && marketeerResult) {
        totalRepayment = marketeerResult.totalRepayment;
        installmentAmount = marketeerResult.dailyInstallment;
      } else if (activeProduct) {
        const calc = calculateLoan(
          Number(loanAmount),
          Number(termValue),
          {
            product_code: productCode,
            interest_rate: Number(activeProduct.interest_rate || 0),
            interest_period: (activeProduct.interest_period || "monthly") as any,
            interest_type: ((activeProduct.interest_type as string) || "flat") as any,
            processing_fee_percent: Number(activeProduct.processing_fee_percent || 0),
            enforcement_fee_percent: Number(activeProduct.enforcement_fee_percent || 0),
            insurance_percent: Number(activeProduct.insurance_percent || 0),
            vat_percent: Number(activeProduct.vat_percent || 0),
            platform_fee_percent: Number(activeProduct.platform_fee_percent || 0),
          },
          termUnit,
        );
        totalRepayment = calc.totalRepayment;
        installmentAmount = calc.monthlyPayment;
      }

      const existingPsd = ((editLoanData?.loan as any)?.product_specific_data as any) || {};
      const update: Record<string, unknown> = {
        loan_amount: Number(loanAmount),
        loan_term_months: Number(termValue),
        loan_purpose: loanPurpose,
        full_name: selectedBorrower.full_name || selectedBorrower.email,
        email: selectedBorrower.email,
        phone: contactNumber || selectedBorrower.phone || "",
        nrc_number: idNumber || selectedBorrower.nrc_number || "",
        address: residentialAddress || selectedBorrower.address || null,
        city: city || selectedBorrower.city || null,
        employer_name: employerName || null,
        job_title: jobTitle || null,
        employment_type: employmentType,
        monthly_income: Number(monthlyIncome),
        admin_notes: adminNotes || null,
        repayment_start_date: usesDailySchedule ? repaymentStartDate : null,
        monthly_payment: installmentAmount,
        total_repayment: totalRepayment,
        product_specific_data: {
          ...existingPsd,
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
        },
      };
      const { error: upErr } = await supabase.from("loan_applications").update(update).eq("id", editLoanId);
      if (upErr) throw upErr;

      if (productCode === "COLLATERAL") {
        await supabase.from("loan_borrowers").delete().eq("loan_application_id", editLoanId);
        const rows = [
          {
            loan_application_id: editLoanId,
            customer_id: primaryBorrowerEntry.customer_id || selectedBorrower.id,
            full_name: primaryBorrowerEntry.full_name,
            nrc_number: primaryBorrowerEntry.nrc_number,
            phone: primaryBorrowerEntry.phone || null,
            address: primaryBorrowerEntry.address || null,
            role: "PRIMARY_BORROWER" as const,
            is_signatory: primaryBorrowerEntry.is_signatory,
            created_by: user.id,
          },
          ...coBorrowerEntries.map((b) => ({
            loan_application_id: editLoanId,
            customer_id: b.customer_id || null,
            full_name: b.full_name,
            nrc_number: b.nrc_number,
            phone: b.phone || null,
            address: b.address || null,
            role: "CO_BORROWER" as const,
            is_signatory: b.is_signatory,
            created_by: user.id,
          })),
          ...absoluteOwnerEntries.map((b) => ({
            loan_application_id: editLoanId,
            customer_id: b.customer_id || null,
            full_name: b.full_name,
            nrc_number: b.nrc_number,
            phone: b.phone || null,
            address: b.address || null,
            role: "ABSOLUTE_OWNER" as const,
            is_signatory: b.is_signatory,
            created_by: user.id,
          })),
        ];
        const { error: insErr } = await supabase.from("loan_borrowers").insert(rows);
        if (insErr) throw insErr;
      }

      // Upload any newly attached docs (additive — never delete existing).
      if (Object.values(docFiles).some(Boolean)) {
        setDocUploading(true);
        try {
          await uploadDocuments(editLoanId, selectedBorrower.id);
        } finally {
          setDocUploading(false);
        }
      }
      return editLoanId;
    },
    onSuccess: () => {
      toast({ title: "Loan updated", description: "Changes saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      queryClient.invalidateQueries({ queryKey: ["edit-loan-shell", editLoanId] });
      queryClient.invalidateQueries({ queryKey: ["application-documents", editLoanId] });
      navigate(successRedirectPath);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
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
      <div className="max-w-6xl mx-auto">
        {/* Sticky compact header with Save Draft */}
        <div className="sticky top-0 z-10 -mx-2 px-2 py-2 mb-2 bg-gradient-to-r from-background via-background to-background/80 backdrop-blur border-b border-border/40">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground truncate">{isEditMode ? `Edit ${title.replace(/^Create\s+/i, "")}` : title}</h1>
                <BetaBadge />
                <Badge variant="outline" className="text-[10px]">{productCode}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex items-center gap-2">
              {!isEditMode && draftSavedAt && (
                <span className="text-[11px] text-muted-foreground hidden md:inline">
                  Draft · {draftSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {!isEditMode && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => navigate("/admin/loan-drafts")}
                    title="See all of your saved drafts"
                  >
                    <FolderOpen className="h-3.5 w-3.5 mr-1" /> All drafts
                  </Button>
                  <Button size="sm" variant="outline" onClick={saveDraft} disabled={savingDraft || !borrowerId}>
                    {savingDraft ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    Save Draft
                  </Button>
                </>
              )}
            </div>
          </div>
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
                    <Popover open={borrowerPickerOpen} onOpenChange={setBorrowerPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="h-9 w-full justify-between font-normal"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                            {selectedBorrower
                              ? `${selectedBorrower.full_name || selectedBorrower.email}${selectedBorrower.nrc_number ? ` — ${selectedBorrower.nrc_number}` : ""}`
                              : "Search and select borrower..."}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
                        <Command
                          filter={(value, search) =>
                            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                          }
                        >
                          <CommandInput placeholder="Search by name, NRC, phone, or email…" />
                          <CommandList>
                            <CommandEmpty>No matching borrower in this house.</CommandEmpty>
                            <CommandGroup>
                              {(borrowers || []).map((b) => {
                                const valueKey = `${b.full_name || ""}|${b.nrc_number || ""}|${b.phone || ""}|${b.email || ""}`.toLowerCase();
                                return (
                                  <CommandItem
                                    key={b.id}
                                    value={valueKey}
                                    onSelect={() => {
                                      setBorrowerId(b.id);
                                      setBorrowerPickerOpen(false);
                                    }}
                                    className="flex flex-col items-start gap-0.5 py-2"
                                  >
                                    <div className="flex w-full items-center gap-2">
                                      <Check className={cn("h-4 w-4", borrowerId === b.id ? "opacity-100 text-primary" : "opacity-0")} />
                                      <span className="font-medium text-sm">{b.full_name || b.email || "Unnamed"}</span>
                                    </div>
                                    <div className="ml-6 text-[11px] text-muted-foreground">
                                      {b.nrc_number || "no NRC"} · {b.phone || "no phone"}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {selectedBorrower && (
                    <div className="md:col-span-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                      <div className="flex gap-x-4 gap-y-1 flex-wrap">
                        <span><span className="text-muted-foreground">Name:</span> <strong>{selectedBorrower.full_name}</strong></span>
                        <span><span className="text-muted-foreground">Phone:</span> {selectedBorrower.phone || "—"}</span>
                        <span><span className="text-muted-foreground">NRC:</span> {selectedBorrower.nrc_number || "—"}</span>
                        <span><span className="text-muted-foreground">Gender:</span> {selectedBorrower.gender || "—"}</span>
                        <span><span className="text-muted-foreground">Marital:</span> {selectedBorrower.marital_status || "—"}</span>
                        <span><span className="text-muted-foreground">Employer:</span> {selectedBorrower.employer_name || "—"}</span>
                        <span className="ml-auto inline-flex items-center gap-1">
                          <FileText className="h-3 w-3 text-primary" />
                          <span className="text-primary font-medium">{Object.keys(vaultDocs).length}</span>
                          <span className="text-muted-foreground">vault docs linked</span>
                        </span>
                      </div>
                      {Object.keys(vaultDocs).length > 0 && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Existing KYC docs from this borrower will be auto-attached. See the Documents tab to review or replace.
                        </p>
                      )}
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
                      {isMarketeer && <span className="text-muted-foreground ml-1">(Fixed: 26 days)</span>}
                      {isPaydaySoft && <span className="text-muted-foreground ml-1">(Fixed: 30 days)</span>}
                      {productCode === "COLLATERAL" && <span className="text-muted-foreground ml-1">(Fixed: 6 months)</span>}
                    </Label>
                    <Input
                      className="h-9"
                      type="number"
                      value={termValue}
                      onChange={(e) => setTermValue(e.target.value)}
                      disabled={isMarketeer || isPaydaySoft || productCode === "COLLATERAL"}
                    />
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
                    {productCode === "COLLATERAL" && (
                      <p className="text-[11px] text-muted-foreground text-center mt-2 border-t border-primary/20 pt-2">
                        <span className="font-medium text-foreground">30% flat interest charged once on the principal,</span> repaid over a fixed
                        <span className="font-medium"> 6-month</span> term ({(30 / 6).toFixed(2)}% / month effective).
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
                borrowerDirectory={borrowers || []}
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
            {blockingErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {blockingErrors.map((e) => (
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
                  onClick={() => (isEditMode ? updateMutation.mutate() : createMutation.mutate())}
                    disabled={(isEditMode ? updateMutation.isPending : createMutation.isPending) || docUploading || productLoading || blockingErrors.length > 0 || (productCode === "COLLATERAL" && !collateralBorrowersValidation.isValid)}
                >
                  {(isEditMode ? updateMutation.isPending : createMutation.isPending) || docUploading
                    ? (isEditMode ? "Saving..." : "Creating...")
                    : (isEditMode ? "Save Changes" : "Create Loan Application")}
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
                    disabled={createMutation.isPending || docUploading || rollbackPending || productLoading || blockingErrors.length > 0 || (productCode === "COLLATERAL" && !collateralBorrowersValidation.isValid)}
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
