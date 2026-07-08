import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { Slider } from "@phinduloans/shared/components/ui/slider";
import { Checkbox } from "@phinduloans/shared/components/ui/checkbox";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { Alert, AlertDescription } from "@phinduloans/shared/components/ui/alert";
import { Progress } from "@phinduloans/shared/components/ui/progress";
import { Separator } from "@phinduloans/shared/components/ui/separator";
import {
  Shield, Clock, FileText, ArrowRight, ArrowLeft,
  CheckCircle, Loader2, Upload, AlertCircle, CreditCard, Briefcase, Building2, Landmark, X, ImageIcon
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { calculateLoan, formatCurrency, getInterestPeriodLabel } from "@phinduloans/shared/utils/loanCalculations";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { LOAN_APPLICATION_IDENTITY_DOC_TYPES, borrowerIdentityKycSatisfiedFromVault } from "@phinduloans/shared/constants/borrowerKycDocs";
import { mapSupabaseError } from "@phinduloans/shared/utils/mapSupabaseError";
import { MobileStickyFormFooter } from "@/components/common/ResponsiveDataViews";
import CollateralBorrowersSection, {
  type CollateralBorrowerEntry,
  makeBlankBorrower,
  validateCollateralBorrowers,
} from "@/components/loans/CollateralBorrowersSection";
import { useProductLoanRules } from "@phinduloans/shared/hooks/useProductLoanRules";
import type { LoanProductCode } from "@phinduloans/shared/config/loanProductModules";
import { asLoanProductCode, isBorrowerPortalProduct } from "@phinduloans/shared/utils/borrowerPortalIntegration";

interface LoanProduct {
  id: string;
  name: string;
  description: string | null;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate: number;
  interest_period: string | null;
  interest_type: string | null;
  processing_fee_percent: number | null;
  enforcement_fee_percent: number | null;
  insurance_percent: number | null;
  vat_percent: number | null;
  platform_fee_percent: number | null;
  collateral_required: boolean | null;
  required_documents: any;
  term_unit: string | null;
  late_payment_penalty_percent: number | null;
  penalty_frequency: string | null;
  grace_period_days: number | null;
  product_code?: string | null;
  channels?: string[] | null;
  pricing_tiers?: unknown;
  eligible_locations?: string[] | null;
  repayment_anchor_rule?: string | null;
  home_verification_required?: boolean | null;
  physical_collateral_collection?: boolean | null;
}

interface RequiredDoc {
  document_type: string;
  document_name: string;
  is_mandatory: boolean;
  display_order: number;
}

const getTermBounds = (product: LoanProduct) => {
  // Collateral policy moved to variable tenor (1-12 months) regardless of older catalog rows.
  if ((product.product_code || "").toUpperCase() === "COLLATERAL") {
    return { min: 1, max: 12 };
  }
  return { min: product.min_term_months, max: product.max_term_months };
};

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  nrc_number: string | null;
  address: string | null;
  city: string | null;
  employer_name: string | null;
  job_title: string | null;
  net_income: number | null;
  employment_type: string | null;
}

interface LoanApplicationFormProps {
  initialProductId?: string;
  initialAmount?: number;
  initialTerm?: number;
  onClose: () => void;
}

const STEPS = ["Product", "Details", "Documents", "Review"];

const PRODUCT_ICONS: Record<string, React.ElementType> = {
  "Business Loan": Building2,
  "Collateral Based Loan": Landmark,
  "Salary Advance Loan": Briefcase,
};

const LoanApplicationForm = ({ initialProductId, initialAmount, initialTerm, onClose }: LoanApplicationFormProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [loanAmount, setLoanAmount] = useState(5000);
  const [loanTerm, setLoanTerm] = useState(1);
  const [loanPurpose, setLoanPurpose] = useState("");
  const [isCivilServantConfirmed, setIsCivilServantConfirmed] = useState(false);
  const [hasLocalAuthorityCompliance, setHasLocalAuthorityCompliance] = useState(false);
  const [businessMonths, setBusinessMonths] = useState(6);

  // Collateral
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralValue, setCollateralValue] = useState("");
  const [collateralImages, setCollateralImages] = useState<File[]>([]);

  // Collateral: multi-borrower structure (Co-Borrowers + Absolute Owners)
  const [primaryBorrower, setPrimaryBorrower] = useState<CollateralBorrowerEntry>(() =>
    makeBlankBorrower("PRIMARY_BORROWER"),
  );
  const [coBorrowers, setCoBorrowers] = useState<CollateralBorrowerEntry[]>([]);
  const [absoluteOwners, setAbsoluteOwners] = useState<CollateralBorrowerEntry[]>([]);

  // Business
  const [businessName, setBusinessName] = useState("");
  const [businessTpin, setBusinessTpin] = useState("");
  const [businessRegNumber, setBusinessRegNumber] = useState("");
  const [businessType, setBusinessType] = useState("");

  // Salary advance
  const [employerName, setEmployerName] = useState("");
  const [employerContact, setEmployerContact] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");

  // Documents
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({});

  // Consent
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [crbConsent, setCrbConsent] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["user-profile-apply", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, nrc_number, address, city, employer_name, job_title, net_income, employment_type")
        .eq("id", user.id)
        .single();
      if (error) return null;
      return data as Profile;
    },
    enabled: !!user,
  });

  const { data: kycStatus } = useQuery({
    queryKey: ["kyc-status-apply", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("borrower_document_vault")
        .select("doc_type, is_verified")
        .eq("borrower_id", user.id);
      const isVerified = borrowerIdentityKycSatisfiedFromVault(data ?? []);
      return { total: data?.length || 0, verified: data?.filter((d) => d.is_verified).length || 0, isVerified };
    },
    enabled: !!user,
  });

  const { data: kycProfile } = useQuery({
    queryKey: ["kyc-profile-apply", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("borrower_kyc_info")
        .select("nok_full_name, nok_phone, nok_relationship")
        .eq("borrower_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: referenceCount = 0 } = useQuery({
    queryKey: ["reference-count-apply", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("borrower_references")
        .select("id", { count: "exact", head: true })
        .eq("borrower_id", user.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: payoutInfo } = useQuery({
    queryKey: ["payout-info-apply", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("borrower_kyc_info")
        .select("bank_name, bank_account_number, airtel_money_number, mtn_mobile_money_number, zamtel_kwacha_number")
        .eq("borrower_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const hasPayoutDestination = !!(
    payoutInfo?.airtel_money_number ||
    payoutInfo?.mtn_mobile_money_number ||
    payoutInfo?.zamtel_kwacha_number ||
    (payoutInfo?.bank_name && payoutInfo?.bank_account_number)
  );

  const { data: hasOpenLoan } = useQuery({
    queryKey: ["open-loan-check", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("loan_applications")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["active", "disbursed", "pending", "under_review", "approved", "contract_signing", "awaiting_disbursement"])
        .limit(1);
      return (data?.length || 0) > 0;
    },
    enabled: !!user,
  });

  const { data: loanProducts } = useQuery({
    queryKey: ["loan-products-apply"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data as LoanProduct[]).filter(isBorrowerPortalProduct);
    },
  });

  const selectedProductCode = asLoanProductCode(selectedProduct?.product_code);
  const productRules = useProductLoanRules((selectedProductCode ?? "COLLATERAL") as LoanProductCode);
  const productChecklist = selectedProductCode ? productRules.checklist : [];

  const productChecklistsByCode = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const product of loanProducts ?? []) {
      const code = asLoanProductCode(product.product_code);
      if (code) map.set(product.id, useProductLoanRules(code).checklist);
    }
    return map;
  }, [loanProducts]);

  // Pre-fill from props
  useEffect(() => {
    if (!loanProducts?.length) return;
    if (initialProductId) {
      const p = loanProducts.find(lp => lp.id === initialProductId);
      if (p) {
        const termBounds = getTermBounds(p);
        setSelectedProduct(p);
        if (initialAmount) setLoanAmount(Math.max(p.min_amount, Math.min(initialAmount, p.max_amount)));
        if (initialTerm) setLoanTerm(Math.max(termBounds.min, Math.min(initialTerm, termBounds.max)));
        setStep(1);
      }
    }
  }, [loanProducts, initialProductId, initialAmount, initialTerm]);

  useEffect(() => {
    if (profile) {
      if (profile.employer_name) setEmployerName(profile.employer_name);
      if (profile.net_income) setMonthlySalary(String(profile.net_income));
      // Sync the locked primary borrower from profile (used by collateral multi-borrower section)
      setPrimaryBorrower((prev) => ({
        ...prev,
        customer_id: profile.id,
        full_name: profile.full_name || "",
        nrc_number: profile.nrc_number || "",
        phone: profile.phone || "",
        address: profile.address || "",
        is_signatory: true,
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (selectedProduct) {
      const termBounds = getTermBounds(selectedProduct);
      setLoanAmount(prev => Math.max(selectedProduct.min_amount, Math.min(prev, selectedProduct.max_amount)));
      setLoanTerm(prev => Math.max(termBounds.min, Math.min(prev, termBounds.max)));
    }
  }, [selectedProduct]);

  const loanCalc = useMemo(() => {
    if (!selectedProduct) return null;
    return calculateLoan(loanAmount, loanTerm, {
      product_name: selectedProduct.name,
      product_code: selectedProduct.product_code,
      pricing_tiers: selectedProduct.pricing_tiers,
      interest_rate: selectedProduct.interest_rate,
      interest_period: selectedProduct.interest_period as any,
      interest_type: selectedProduct.interest_type as any,
      processing_fee_percent: selectedProduct.processing_fee_percent,
      enforcement_fee_percent: (selectedProduct as any).enforcement_fee_percent ?? 0,
      insurance_percent: selectedProduct.insurance_percent,
      vat_percent: selectedProduct.vat_percent,
      platform_fee_percent: selectedProduct.platform_fee_percent,
      term_unit: selectedProduct.term_unit as any,
    });
  }, [selectedProduct, loanAmount, loanTerm]);

  const requiredDocs: RequiredDoc[] = useMemo(() => {
    if (!selectedProduct?.required_documents) return [];
    const docs = selectedProduct.required_documents as any[];
    return docs.map((d: any, i: number) => ({
      document_type: d.document_type || d.document_name?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || `doc_${i}`,
      document_name: d.document_name || `Document ${i + 1}`,
      is_mandatory: d.is_mandatory !== false,
      display_order: d.display_order || i + 1,
    })).sort((a: RequiredDoc, b: RequiredDoc) => a.display_order - b.display_order);
  }, [selectedProduct]);

  const identityDocTypes = [...LOAN_APPLICATION_IDENTITY_DOC_TYPES];

  const isProfileComplete = !!(profile?.full_name && profile?.phone && profile?.nrc_number);
  const productName = selectedProduct?.name || "";
  const productCode = selectedProduct?.product_code || null;
  const isCollateralLoan = !!selectedProduct?.collateral_required;
  const isBusinessLoan = productName.toLowerCase().includes("business");
  const isSalaryAdvance = productName.toLowerCase().includes("salary");
  const normalizedCity = (profile?.city || "").trim().toLowerCase();
  const eligibleLocations = (selectedProduct?.eligible_locations || []).map((l) => l.trim().toLowerCase());
  const hasLocationRestriction = eligibleLocations.length > 0;
  const locationAllowed = !hasLocationRestriction || (normalizedCity && eligibleLocations.includes(normalizedCity));
  const isPaydaySoft = productCode === "PAYDAY_SOFT";
  const isMarketeer = productCode === "MARKETEER";
  const termUnitLabel = selectedProduct?.term_unit || "months";
  const selectedTermBounds = selectedProduct ? getTermBounds(selectedProduct) : { min: 1, max: 12 };

  const collateralBorrowersValidation = useMemo(
    () => validateCollateralBorrowers(primaryBorrower, coBorrowers, absoluteOwners),
    [primaryBorrower, coBorrowers, absoluteOwners],
  );

  const canProceedStep1 = !!selectedProduct;
  const canProceedStep2 = !!loanPurpose &&
    locationAllowed &&
    (!isPaydaySoft || loanTerm === 30) &&
    (!isMarketeer || (loanTerm === 26 && hasLocalAuthorityCompliance && businessMonths >= 6)) &&
    (selectedProductCode !== "SALARY_ADVANCE" && selectedProductCode !== "SALARY_ADVANCE_STAFF" || isCivilServantConfirmed) && (
    (!isCollateralLoan || (collateralDescription && collateralValue && collateralBorrowersValidation.isValid)) &&
    (!isBusinessLoan || (businessName && businessTpin)) &&
    (!isSalaryAdvance || (employerName && monthlySalary))
  );

  const hasNokComplete = !!(kycProfile?.nok_full_name && kycProfile?.nok_phone && kycProfile?.nok_relationship);
  const hasMinReferences = referenceCount >= 2;

  const mandatoryDocs = requiredDocs.filter(d => d.is_mandatory);
  const uploadedMandatoryCount = mandatoryDocs.filter(d => {
    const docKey = d.document_type;
    if (kycStatus?.isVerified && identityDocTypes.some(idt => docKey.toLowerCase().includes(idt.replace(/_/g, '')))) {
      return true;
    }
    return !!documentFiles[docKey];
  }).length;
  const canProceedStep3 = uploadedMandatoryCount >= mandatoryDocs.length;
  const canSubmit = termsAccepted && crbConsent && hasPayoutDestination && hasNokComplete && hasMinReferences && !hasOpenLoan;

  const handleFileChange = (docType: string, file: File | null) => {
    setDocumentFiles(prev => ({ ...prev, [docType]: file }));
  };

  const addCollateralImage = (file: File) => {
    if (collateralImages.length >= 3) return;
    setCollateralImages(prev => [...prev, file]);
  };

  const removeCollateralImage = (index: number) => {
    setCollateralImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user || !profile || !selectedProduct || !loanCalc) return;
    setIsSubmitting(true);

    try {
      if (selectedProductCode) {
        const employmentTypeMap: Record<string, "employed" | "self_employed" | "contract" | "other"> = {
          permanent: "employed", employed: "employed", contract: "contract",
          self_employed: "self_employed", "self-employed": "self_employed",
        };
        const ruleErrors = productRules.validate({
          employmentType: employmentTypeMap[profile.employment_type || ""] || "employed",
          city: profile.city || "",
          loanAmount,
          termValue: loanTerm,
          businessMonths,
          isCivilServantConfirmed,
          hasLocalAuthorityCompliance,
          productMinAmount: selectedProduct.min_amount,
          productMaxAmount: selectedProduct.max_amount,
        });
        if (ruleErrors.length > 0) {
          throw new Error(ruleErrors[0]);
        }
      }

      if (!locationAllowed) {
        throw new Error(`This loan product is restricted to: ${selectedProduct.eligible_locations?.join(", ")}`);
      }
      if (hasOpenLoan) {
        throw new Error("You already have an active or pending loan application. Please complete that process before applying again.");
      }

      const submitWarnings: string[] = [];
      if (isPaydaySoft && loanTerm !== 30) {
        throw new Error("Payday Soft term must be exactly 30 days.");
      }
      if (isMarketeer && loanTerm !== 26) {
        throw new Error("Marketeer term must be exactly 26 collection days.");
      }

      const productSpecificData: Record<string, any> = {};
      if (isBusinessLoan) {
        productSpecificData.business_name = businessName;
        productSpecificData.business_tpin = businessTpin;
        productSpecificData.business_registration_number = businessRegNumber;
        productSpecificData.business_type = businessType;
      }
      if (isSalaryAdvance) {
        productSpecificData.employer_name = employerName;
        productSpecificData.employer_contact = employerContact;
        productSpecificData.monthly_salary = Number(monthlySalary) || 0;
        productSpecificData.civil_servant_confirmed = isCivilServantConfirmed;
      }
      if (isMarketeer) {
        productSpecificData.local_authority_compliance = hasLocalAuthorityCompliance;
        productSpecificData.business_months = businessMonths;
      }

      const employmentTypeMap: Record<string, "employed" | "self_employed" | "contract" | "other"> = {
        permanent: "employed", employed: "employed", contract: "contract",
        self_employed: "self_employed", "self-employed": "self_employed",
      };

      const { data: newApp, error: insertError } = await supabase.from("loan_applications").insert({
        user_id: user.id,
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        nrc_number: profile.nrc_number || "",
        address: profile.address || "",
        city: profile.city || "",
        employment_type: employmentTypeMap[profile.employment_type || ""] || "employed",
        employer_name: employerName || profile.employer_name || "",
        job_title: profile.job_title || "",
        monthly_income: Number(monthlySalary) || profile.net_income || 0,
        loan_amount: loanAmount,
        loan_purpose: loanPurpose,
        loan_term_months: loanTerm,
        term_unit: selectedProduct.term_unit || (isPaydaySoft || isMarketeer ? "days" : "months"),
        interest_rate: selectedProduct.interest_rate,
        monthly_payment: loanCalc.monthlyPayment,
        total_repayment: loanCalc.totalRepayment,
        loan_product_id: selectedProduct.id,
        status: "pending",
        source: "dashboard",
        crb_consent: crbConsent,
        crb_consent_timestamp: crbConsent ? new Date().toISOString() : null,
        ...(isCollateralLoan ? {
          collateral_description: collateralDescription,
          collateral_value: Number(collateralValue) || 0,
        } : {}),
        product_specific_data: Object.keys(productSpecificData).length > 0 ? productSpecificData : {},
      }).select("id").single();

      if (insertError) throw insertError;
      const applicationId = newApp.id;

      // Persist multi-borrower structure for COLLATERAL loans only
      if (isCollateralLoan) {
        const borrowerRows = [
          {
            loan_application_id: applicationId,
            customer_id: primaryBorrower.customer_id || user.id,
            full_name: primaryBorrower.full_name,
            nrc_number: primaryBorrower.nrc_number,
            phone: primaryBorrower.phone || null,
            address: primaryBorrower.address || null,
            role: "PRIMARY_BORROWER" as const,
            is_signatory: primaryBorrower.is_signatory,
            created_by: user.id,
          },
          ...coBorrowers.map((b) => ({
            loan_application_id: applicationId,
            customer_id: b.customer_id || null,
            full_name: b.full_name,
            nrc_number: b.nrc_number,
            phone: b.phone || null,
            address: b.address || null,
            role: "CO_BORROWER" as const,
            is_signatory: b.is_signatory,
            created_by: user.id,
          })),
          ...absoluteOwners.map((b) => ({
            loan_application_id: applicationId,
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
        const { error: borrowersErr } = await supabase.from("loan_borrowers").insert(borrowerRows);
        if (borrowersErr) {
          console.error("Failed to insert loan_borrowers:", borrowersErr);
          submitWarnings.push("Co-borrower details could not be saved. Our team will follow up.");
        }
      }


      // Auto-enroll borrower in the loan product's House roster (best-effort)
      try {
        if (productCode) {
          await (supabase.from as any)("product_house_borrowers").upsert(
            { product_code: productCode, borrower_id: user.id, added_by: user.id },
            { onConflict: "product_code,borrower_id" },
          );
        }
      } catch (houseErr) {
        console.warn("House roster enrollment skipped:", houseErr);
        submitWarnings.push("House roster enrollment was skipped; your application was still submitted.");
      }

      // Upload documents
      const docEntries = Object.entries(documentFiles).filter(([, file]) => file !== null);
      for (const [docType, file] of docEntries) {
        if (!file) continue;
        const filePath = `${user.id}/${applicationId}/${docType}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: uploadErr } = await supabase.storage
          .from("loan-documents")
          .upload(filePath, file, { cacheControl: "3600", upsert: false });

        if (uploadErr) {
          console.error(`Upload failed for ${docType}:`, uploadErr);
          submitWarnings.push(`Could not upload ${docType.replace(/_/g, " ")}. Re-upload from My Loans.`);
          continue;
        }

        const docMeta = requiredDocs.find(d => d.document_type === docType);
        await supabase.from("application_documents").insert({
          application_id: applicationId,
          borrower_id: user.id,
          doc_type: docType,
          doc_label: docMeta?.document_name || docType,
          file_name: file.name,
          file_url: filePath,
          file_size: file.size,
          mime_type: file.type,
          is_required: docMeta?.is_mandatory ?? true,
          loan_product_id: selectedProduct.id,
          status: "uploaded",
        });

        const columnMap: Record<string, string> = {
          payslip_1: "payslip_url", payslip_2: "payslip_2_url", payslip_3: "payslip_3_url",
          bank_statement_1: "bank_statement_url",
          nrc_front: "nrc_front_url", nrc_back: "nrc_back_url",
          selfie_holding_nrc: "selfie_url",
        };
        if (columnMap[docType]) {
          await supabase.from("loan_applications").update({ [columnMap[docType]]: filePath }).eq("id", applicationId);
        }
      }

      // Link verified vault identity docs when borrower skipped re-upload in the form
      if (kycStatus?.isVerified) {
        const uploadedTypes = new Set(docEntries.map(([t]) => t));
        const vaultToAppDocType: Record<string, string> = {
          nrc_front: "nrc_front",
          nrc_back: "nrc_back",
          selfie: "selfie_holding_nrc",
          selfie_holding_nrc: "selfie_holding_nrc",
        };
        const legacyColumnMap: Record<string, string> = {
          nrc_front: "nrc_front_url",
          nrc_back: "nrc_back_url",
          selfie_holding_nrc: "selfie_url",
          selfie: "selfie_url",
        };
        const { data: vaultDocs } = await supabase
          .from("borrower_document_vault")
          .select("doc_type, doc_label, file_url, file_name, mime_type, file_size, is_verified")
          .eq("borrower_id", user.id)
          .in("doc_type", ["nrc_front", "nrc_back", "selfie", "selfie_holding_nrc"]);
        for (const vaultDoc of vaultDocs ?? []) {
          const appDocType = vaultToAppDocType[vaultDoc.doc_type] ?? vaultDoc.doc_type;
          if (uploadedTypes.has(appDocType)) continue;
          const docMeta = requiredDocs.find((d) => d.document_type === appDocType);
          await supabase.from("application_documents").insert({
            application_id: applicationId,
            borrower_id: user.id,
            doc_type: appDocType,
            doc_label: docMeta?.document_name || vaultDoc.doc_label,
            file_name: vaultDoc.file_name,
            file_url: vaultDoc.file_url,
            file_size: vaultDoc.file_size,
            mime_type: vaultDoc.mime_type,
            is_required: docMeta?.is_mandatory ?? true,
            loan_product_id: selectedProduct.id,
            status: vaultDoc.is_verified ? "verified" : "uploaded",
          });
          const legacyCol = legacyColumnMap[vaultDoc.doc_type];
          if (legacyCol) {
            await supabase.from("loan_applications").update({ [legacyCol]: vaultDoc.file_url }).eq("id", applicationId);
          }
        }
      }

      // Upload collateral images
      for (let i = 0; i < collateralImages.length; i++) {
        const file = collateralImages[i];
        const filePath = `${user.id}/${applicationId}/collateral_${i + 1}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: uploadErr } = await supabase.storage
          .from("loan-documents")
          .upload(filePath, file, { cacheControl: "3600", upsert: false });

        if (uploadErr) {
          submitWarnings.push(`Collateral image ${i + 1} could not be uploaded.`);
        } else {
          const colField = i === 0 ? "collateral_image_url" : i === 1 ? "collateral_image_2_url" : "collateral_image_3_url";
          await supabase.from("loan_applications").update({ [colField]: filePath }).eq("id", applicationId);

          await supabase.from("application_documents").insert({
            application_id: applicationId,
            borrower_id: user.id,
            doc_type: `collateral_image_${i + 1}`,
            doc_label: `Collateral Image ${i + 1}`,
            file_name: file.name,
            file_url: filePath,
            file_size: file.size,
            mime_type: file.type,
            is_required: true,
            loan_product_id: selectedProduct.id,
            status: "uploaded",
          });
        }
      }

      toast({ title: "Application Submitted!", description: "Your loan application has been submitted for review." });
      if (submitWarnings.length > 0) {
        toast({
          title: "Application submitted with warnings",
          description: submitWarnings.join(" "),
          variant: "destructive",
        });
      }
      onClose();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Submission Failed",
        description: mapSupabaseError(error, error?.message || "Something went wrong."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header with close */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Loan Application</h2>
          <p className="text-muted-foreground text-sm">Complete the steps below to submit your application</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>

      {/* Blockers */}
      {!isProfileComplete && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your profile is incomplete. Please update your{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/dashboard?tab=profile&kyc=documents")}>profile</Button>
            {" "}with your full name, phone, and NRC number before applying.
          </AlertDescription>
        </Alert>
      )}

      {hasOpenLoan && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You already have an active or pending loan application. Please complete that process before applying again.
          </AlertDescription>
        </Alert>
      )}

      {!hasNokComplete && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Add next of kin details in your{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/dashboard?tab=profile&kyc=workspace")}>profile</Button>
            {" "}before submitting.
          </AlertDescription>
        </Alert>
      )}

      {!hasMinReferences && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Add at least 2 personal references in your{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/dashboard?tab=profile&kyc=workspace")}>profile</Button>
            {" "}before submitting ({referenceCount}/2).
          </AlertDescription>
        </Alert>
      )}

      {!kycStatus?.isVerified && (
        <Alert className="border-yellow-500/30 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            Your KYC documents are not yet verified. You can still apply, but approval requires verified identity documents.{" "}
            <Button variant="link" className="p-0 h-auto text-yellow-400" onClick={() => navigate("/dashboard?tab=profile&kyc=documents")}>Upload Documents</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Step Progress */}
      <div>
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
            </div>
          ))}
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
      </div>

      {/* ─── Step 0: Select Product ─── */}
      {step === 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Choose a Loan Product</h3>
          <div className="grid gap-4">
            {loanProducts?.map((product) => {
              const Icon = PRODUCT_ICONS[product.name] || CreditCard;
              const isSelected = selectedProduct?.id === product.id;
              return (
                <Card
                  key={product.id}
                  className={`cursor-pointer transition-all border-2 ${
                    isSelected ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"
                  }`}
                  onClick={() => setSelectedProduct(product)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary/20" : "bg-muted"
                      }`}>
                        <Icon className={`w-6 h-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">{product.name}</h4>
                          {product.collateral_required && <Badge variant="outline" className="text-xs">Collateral</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{product.description}</p>
                        {productChecklistsByCode.has(product.id) && (
                          <ul className="text-xs text-muted-foreground mb-3 space-y-1 list-disc list-inside">
                            {(productChecklistsByCode.get(product.id) ?? []).slice(0, 4).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                            {(productChecklistsByCode.get(product.id)?.length ?? 0) > 4 && (
                              <li>+ {(productChecklistsByCode.get(product.id)!.length - 4)} more requirements</li>
                            )}
                          </ul>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>K{product.min_amount.toLocaleString()} – K{product.max_amount.toLocaleString()}</span>
                          <span>
                            {(product.product_code || "") === "COLLATERAL"
                              ? `${product.interest_rate}% total over ${product.min_term_months}–${product.max_term_months} months`
                              : `${product.interest_rate}% ${getInterestPeriodLabel(product.interest_period as any)}`}
                          </span>
                          <span>{product.min_term_months}–{product.max_term_months} {(product.term_unit || 'months')}</span>
                          <span className="capitalize">{(product.interest_type || 'flat').replace(/_/g, ' ')}</span>
                          {(product as any).enforcement_fee_percent > 0 && <span>Enforcement: {(product as any).enforcement_fee_percent}%</span>}
                          {product.processing_fee_percent && product.processing_fee_percent > 0 && <span>Processing: {product.processing_fee_percent}%</span>}
                        </div>
                      </div>
                      {isSelected && <CheckCircle className="text-primary shrink-0" size={20} />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <MobileStickyFormFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setStep(1)} disabled={!canProceedStep1 || !isProfileComplete}>
              Continue <ArrowRight size={16} className="ml-2" />
            </Button>
          </MobileStickyFormFooter>
        </div>
      )}

      {/* ─── Step 1: Loan Details ─── */}
      {step === 1 && selectedProduct && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-foreground">Loan Details</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Loan Amount</Label>
              <span className="text-2xl font-bold text-primary">{formatCurrency(loanAmount)}</span>
            </div>
            <Slider value={[loanAmount]} onValueChange={([v]) => setLoanAmount(v)} min={selectedProduct.min_amount} max={selectedProduct.max_amount} step={500} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>K{selectedProduct.min_amount.toLocaleString()}</span>
              <span>K{selectedProduct.max_amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Loan Term</Label>
              <span className="text-xl font-bold text-foreground">
                {loanTerm} {termUnitLabel}
                {loanTerm > 1 && termUnitLabel !== "days" ? "s" : ""}
              </span>
            </div>
            {isCollateralLoan ? (
              <>
                <Select value={String(loanTerm)} onValueChange={(v) => setLoanTerm(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      { length: selectedTermBounds.max - selectedTermBounds.min + 1 },
                      (_, i) => selectedTermBounds.min + i,
                    ).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? "month" : "months"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Collateral loans carry a <strong>fixed {selectedProduct.interest_rate}% total interest</strong> regardless of term.
                  Pick {selectedTermBounds.min}–{selectedTermBounds.max} months — your monthly installment changes,
                  the total cost stays the same.
                </p>
              </>
            ) : (
              <Slider value={[loanTerm]} onValueChange={([v]) => setLoanTerm(v)} min={selectedTermBounds.min} max={selectedTermBounds.max} step={1} />
            )}
          </div>

          <div className="space-y-2">
            <Label>Loan Purpose *</Label>
            <Select value={loanPurpose} onValueChange={setLoanPurpose}>
              <SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="emergency">Emergency/Medical</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="home">Home Improvement</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="salary_advance">Salary Advance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {productChecklist.length > 0 && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Requirements for {selectedProduct.name}</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {productChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {(selectedProductCode === "SALARY_ADVANCE" || selectedProductCode === "SALARY_ADVANCE_STAFF") && (
            <div className="flex items-start gap-2 rounded-lg border border-border p-3">
              <Checkbox
                id="civil-servant-confirm"
                checked={isCivilServantConfirmed}
                onCheckedChange={(v) => setIsCivilServantConfirmed(v === true)}
              />
              <Label htmlFor="civil-servant-confirm" className="text-sm leading-snug cursor-pointer">
                I confirm I am an eligible civil servant / employed borrower for this salary advance product.
              </Label>
            </div>
          )}

          {selectedProductCode === "MARKETEER" && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="local-authority-compliance"
                  checked={hasLocalAuthorityCompliance}
                  onCheckedChange={(v) => setHasLocalAuthorityCompliance(v === true)}
                />
                <Label htmlFor="local-authority-compliance" className="text-sm leading-snug cursor-pointer">
                  I confirm my business has local authority compliance.
                </Label>
              </div>
              <div className="space-y-2">
                <Label>Months in business</Label>
                <Input
                  type="number"
                  min={0}
                  value={businessMonths}
                  onChange={(e) => setBusinessMonths(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {/* Collateral fields */}
          {isCollateralLoan && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark size={16} className="text-primary" /> Collateral Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Collateral Description *</Label>
                  <Textarea placeholder="Describe the collateral (e.g., 2020 Toyota Corolla, House at Plot 42...)" value={collateralDescription} onChange={(e) => setCollateralDescription(e.target.value)} />
                </div>
                <div>
                  <Label>Estimated Value (ZMW) *</Label>
                  <Input type="number" placeholder="e.g. 50000" value={collateralValue} onChange={(e) => setCollateralValue(e.target.value)} />
                </div>
                <div>
                  <Label>Collateral Images (up to 3)</Label>
                  <div className="mt-2 space-y-3">
                    {/* Image previews */}
                    {collateralImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        {collateralImages.map((file, i) => (
                          <div key={i} className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-square">
                            <img src={URL.createObjectURL(file)} alt={`Collateral ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeCollateralImage(i)}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={14} />
                            </button>
                            <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 px-1.5 py-0.5 rounded text-foreground">{file.name.slice(0, 15)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Add image button */}
                    {collateralImages.length < 3 && (
                      <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                        <ImageIcon size={20} className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {collateralImages.length === 0 ? "Add collateral images" : `Add another (${3 - collateralImages.length} remaining)`}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) addCollateralImage(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Collateral: Co-Borrowers + Absolute Owners (collateral loans only) */}
          {isCollateralLoan && (
            <CollateralBorrowersSection
              primary={primaryBorrower}
              coBorrowers={coBorrowers}
              absoluteOwners={absoluteOwners}
              onPrimaryChange={setPrimaryBorrower}
              onCoBorrowersChange={setCoBorrowers}
              onAbsoluteOwnersChange={setAbsoluteOwners}
              primaryLocked
            />
          )}

          {isBusinessLoan && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 size={16} className="text-primary" /> Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Business Name *</Label><Input placeholder="e.g. ABC Trading Ltd" value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
                <div><Label>TPIN *</Label><Input placeholder="e.g. 1234567890" value={businessTpin} onChange={(e) => setBusinessTpin(e.target.value)} /></div>
                <div><Label>Registration Number</Label><Input placeholder="Company reg number" value={businessRegNumber} onChange={(e) => setBusinessRegNumber(e.target.value)} /></div>
                <div>
                  <Label>Business Type</Label>
                  <Select value={businessType} onValueChange={setBusinessType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                      <SelectItem value="limited_company">Limited Company</SelectItem>
                      <SelectItem value="cooperative">Cooperative</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Salary Advance fields */}
          {isSalaryAdvance && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase size={16} className="text-primary" /> Employment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Employer Name *</Label><Input placeholder="e.g. Zambia Breweries" value={employerName} onChange={(e) => setEmployerName(e.target.value)} /></div>
                <div><Label>Employer Contact</Label><Input placeholder="HR phone/email" value={employerContact} onChange={(e) => setEmployerContact(e.target.value)} /></div>
                <div><Label>Monthly Salary (ZMW) *</Label><Input type="number" placeholder="e.g. 5000" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} /></div>
              </CardContent>
            </Card>
          )}

          {/* Loan Summary */}
          {loanCalc && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <CreditCard size={16} className="text-primary" /> Loan Summary
                </h4>
                {selectedProduct.product_code === "COLLATERAL" && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {selectedProduct.interest_rate}% total interest split flat across {loanTerm} {loanTerm === 1 ? "month" : "months"}
                    {" "}({(selectedProduct.interest_rate / loanTerm).toFixed(2)}% per month equivalent).
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {loanCalc.paymentFrequency === "daily"
                      ? "Daily Installment:"
                      : loanCalc.paymentFrequency === "weekly"
                      ? "Weekly Payment:"
                      : "Monthly Payment:"}
                  </span>
                  <span className="font-medium text-right">
                    {formatCurrency(
                      loanCalc.paymentFrequency === "daily"
                        ? (loanCalc.dailyPayment ?? loanCalc.monthlyPayment)
                        : loanCalc.paymentFrequency === "weekly"
                        ? (loanCalc.weeklyPayment ?? loanCalc.monthlyPayment)
                        : loanCalc.monthlyPayment
                    )}
                  </span>
                  <span className="text-muted-foreground">Total Interest:</span>
                  <span className="font-medium text-right">{formatCurrency(loanCalc.totalInterest)}</span>
                  {loanCalc.feesDeductedUpfront > 0 && (
                    <>
                      <span className="text-muted-foreground">Fees (deducted):</span>
                      <span className="font-medium text-right text-destructive">-{formatCurrency(loanCalc.feesDeductedUpfront)}</span>
                      <span className="text-muted-foreground">You Receive:</span>
                      <span className="font-bold text-right text-primary">{formatCurrency(loanCalc.disbursementAmount)}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Total Repayment:</span>
                  <span className="font-bold text-right text-primary">{formatCurrency(loanCalc.totalRepayment)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {hasLocationRestriction && !locationAllowed && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This product is only available in: {selectedProduct?.eligible_locations?.join(", ")}. Update your profile city before continuing.
              </AlertDescription>
            </Alert>
          )}

          <MobileStickyFormFooter>
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
            <Button onClick={() => setStep(2)} disabled={!canProceedStep2}>
              Continue <ArrowRight size={16} className="ml-2" />
            </Button>
          </MobileStickyFormFooter>
        </div>
      )}

      {/* ─── Step 2: Documents ─── */}
      {step === 2 && selectedProduct && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-foreground">Upload Documents</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload the required documents for your {selectedProduct.name} application.
              {kycStatus?.isVerified && " Identity documents already verified in your profile will be linked automatically."}
            </p>
          </div>

          <div className="space-y-3">
            {requiredDocs.map((doc) => {
              const docKey = doc.document_type;
              const isIdentityDoc = identityDocTypes.some(idt => docKey.toLowerCase().includes(idt.replace(/_/g, '')));
              const isAutoLinked = kycStatus?.isVerified && isIdentityDoc;
              const file = documentFiles[docKey];

              return (
                <Card key={docKey} className={`border-border/50 ${isAutoLinked ? "opacity-70" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${file || isAutoLinked ? "bg-primary/20" : "bg-muted"}`}>
                          {file || isAutoLinked ? <CheckCircle size={16} className="text-primary" /> : <Upload size={16} className="text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {doc.document_name}
                            {doc.is_mandatory && <span className="text-destructive ml-1">*</span>}
                          </p>
                          {isAutoLinked && <p className="text-xs text-primary">✓ Linked from verified KYC</p>}
                          {file && <p className="text-xs text-muted-foreground truncate">{file.name}</p>}
                        </div>
                      </div>
                      {!isAutoLinked && (
                        <div className="shrink-0">
                          <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="w-auto text-xs" onChange={(e) => handleFileChange(docKey, e.target.files?.[0] || null)} />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-sm text-muted-foreground">
            {uploadedMandatoryCount}/{mandatoryDocs.length} required documents uploaded
          </div>

          <MobileStickyFormFooter>
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!canProceedStep3}>
              Continue <ArrowRight size={16} className="ml-2" />
            </Button>
          </MobileStickyFormFooter>
        </div>
      )}

      {/* ─── Step 3: Review & Submit ─── */}
      {step === 3 && selectedProduct && loanCalc && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-foreground">Review & Submit</h3>

          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Name:</span> <span className="font-medium ml-1">{profile?.full_name}</span></div>
              <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-1">{profile?.phone}</span></div>
              <div><span className="text-muted-foreground">NRC:</span> <span className="font-medium ml-1">{profile?.nrc_number}</span></div>
              
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-base">Loan Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Product:</span> <span className="font-medium ml-1">{selectedProduct.name}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium ml-1">{formatCurrency(loanAmount)}</span></div>
              <div><span className="text-muted-foreground">Term:</span> <span className="font-medium ml-1">{loanTerm} {termUnitLabel}</span></div>
              <div><span className="text-muted-foreground">Purpose:</span> <span className="font-medium ml-1 capitalize">{loanPurpose.replace(/_/g, " ")}</span></div>
              <div>
                <span className="text-muted-foreground">
                  {loanCalc.paymentFrequency === "daily"
                    ? "Daily Installment:"
                    : loanCalc.paymentFrequency === "weekly"
                    ? "Weekly Payment:"
                    : "Monthly Payment:"}
                </span>
                <span className="font-bold ml-1 text-primary">
                  {formatCurrency(
                    loanCalc.paymentFrequency === "daily"
                      ? (loanCalc.dailyPayment ?? loanCalc.monthlyPayment)
                      : loanCalc.paymentFrequency === "weekly"
                      ? (loanCalc.weeklyPayment ?? loanCalc.monthlyPayment)
                      : loanCalc.monthlyPayment
                  )}
                </span>
              </div>
              <div><span className="text-muted-foreground">Total Repayment:</span> <span className="font-bold ml-1 text-primary">{formatCurrency(loanCalc.totalRepayment)}</span></div>
              {selectedProduct.product_code === "COLLATERAL" && (
                <>
                  <div><span className="text-muted-foreground">Interest model:</span> <span className="font-medium ml-1">{selectedProduct.interest_rate}% total across selected term</span></div>
                  <div><span className="text-muted-foreground">Equivalent rate:</span> <span className="font-medium ml-1">{(selectedProduct.interest_rate / Math.max(loanTerm, 1)).toFixed(2)}% per month (display only)</span></div>
                </>
              )}
              {loanCalc.feesDeductedUpfront > 0 && (
                <div><span className="text-muted-foreground">You Receive:</span> <span className="font-bold ml-1 text-primary">{formatCurrency(loanCalc.disbursementAmount)}</span></div>
              )}
              {isCollateralLoan && (
                <div className="col-span-1 sm:col-span-2 mt-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">Collateral Loan Pricing</div>
                  <div>{selectedProduct.interest_rate}% total interest across {loanTerm} {loanTerm === 1 ? "month" : "months"}.</div>
                  <div>Equivalent monthly rate: {(selectedProduct.interest_rate / Math.max(loanTerm, 1)).toFixed(2)}% (flat display).</div>
                </div>
              )}
            </CardContent>
          </Card>

          {(isCollateralLoan || isBusinessLoan || isSalaryAdvance) && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {isCollateralLoan ? "Collateral" : isBusinessLoan ? "Business" : "Employment"} Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {isCollateralLoan && (
                  <>
                    <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span className="font-medium ml-1">{collateralDescription}</span></div>
                    <div><span className="text-muted-foreground">Estimated Value:</span> <span className="font-medium ml-1">K{Number(collateralValue).toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Images:</span> <span className="font-medium ml-1">{collateralImages.length} uploaded</span></div>
                  </>
                )}
                {isBusinessLoan && (
                  <>
                    <div><span className="text-muted-foreground">Business:</span> <span className="font-medium ml-1">{businessName}</span></div>
                    <div><span className="text-muted-foreground">TPIN:</span> <span className="font-medium ml-1">{businessTpin}</span></div>
                  </>
                )}
                {isSalaryAdvance && (
                  <>
                    <div><span className="text-muted-foreground">Employer:</span> <span className="font-medium ml-1">{employerName}</span></div>
                    <div><span className="text-muted-foreground">Salary:</span> <span className="font-medium ml-1">K{Number(monthlySalary).toLocaleString()}</span></div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-base">Documents</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {requiredDocs.map(d => {
                  const docKey = d.document_type;
                  const isIdentityDoc = identityDocTypes.some(idt => docKey.toLowerCase().includes(idt.replace(/_/g, '')));
                  const uploaded = !!documentFiles[docKey] || (kycStatus?.isVerified && isIdentityDoc);
                  return (
                    <Badge key={docKey} variant={uploaded ? "default" : "outline"} className="text-xs">
                      {uploaded && <CheckCircle size={10} className="mr-1" />}
                      {d.document_name}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {!hasPayoutDestination && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>
                  You must add a <strong>payout destination</strong> (mobile money or bank account) before submitting. This is where your loan will be deposited.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { onClose(); navigate("/dashboard?tab=profile&kyc=documents"); }}
                >
                  Add payout details
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox id="terms-review" checked={termsAccepted} onCheckedChange={(c) => setTermsAccepted(c === true)} />
              <Label htmlFor="terms-review" className="text-sm text-muted-foreground cursor-pointer">
                I accept the terms and conditions of the loan agreement and understand the repayment obligations.
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="crb-review" checked={crbConsent} onCheckedChange={(c) => setCrbConsent(c === true)} />
              <Label htmlFor="crb-review" className="text-sm text-muted-foreground cursor-pointer">
                I consent to credit reference bureau (CRB) checks and authorize Phindu Finance to verify my credit history.
              </Label>
            </div>
          </div>

          <MobileStickyFormFooter>
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
            <Button
              variant="hero"
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmit || !isProfileComplete || !!hasOpenLoan}
              className="min-w-[min(180px,45vw)]"
            >
              {isSubmitting ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> Submitting...</>
              ) : (
                <><CheckCircle size={16} className="mr-2" /> Submit Application</>
              )}
            </Button>
          </MobileStickyFormFooter>
        </div>
      )}
    </div>
  );
};

export default LoanApplicationForm;
