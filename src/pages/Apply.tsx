import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  LogIn, UserPlus, Shield, Clock, FileText, ArrowRight, ArrowLeft,
  CheckCircle, Loader2, Upload, AlertCircle, CreditCard, Briefcase, Building2, Landmark
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoan, formatCurrency, getInterestPeriodLabel } from "@/utils/loanCalculations";
import { useToast } from "@/hooks/use-toast";

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
}

interface RequiredDoc {
  document_type: string;
  document_name: string;
  is_mandatory: boolean;
  display_order: number;
}

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

const STEPS = ["Product", "Details", "Documents", "Review"];

const PRODUCT_ICONS: Record<string, React.ElementType> = {
  "Business Loan": Building2,
  "Collateral Based Loan": Landmark,
  "Salary Advance Loan": Briefcase,
};

const Apply = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Step state
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Product
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);

  // Step 2: Loan details
  const [loanAmount, setLoanAmount] = useState(5000);
  const [loanTerm, setLoanTerm] = useState(1);
  const [loanPurpose, setLoanPurpose] = useState("");
  // Collateral fields
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralValue, setCollateralValue] = useState("");
  // Business fields
  const [businessName, setBusinessName] = useState("");
  const [businessTpin, setBusinessTpin] = useState("");
  const [businessRegNumber, setBusinessRegNumber] = useState("");
  const [businessType, setBusinessType] = useState("");
  // Salary advance fields
  const [employerName, setEmployerName] = useState("");
  const [employerContact, setEmployerContact] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");

  // Step 3: Documents
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({});
  const [collateralImages, setCollateralImages] = useState<File[]>([]);

  // Step 4: Consent
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [crbConsent, setCrbConsent] = useState(false);

  // Fetch profile
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

  // Check KYC verification
  const { data: kycStatus } = useQuery({
    queryKey: ["kyc-status-apply", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("borrower_document_vault")
        .select("id, is_verified")
        .eq("borrower_id", user.id);
      const total = data?.length || 0;
      const verified = data?.filter(d => d.is_verified)?.length || 0;
      return { total, verified, isVerified: verified >= 3 };
    },
    enabled: !!user,
  });

  // Check active loans
  const { data: hasActiveLoan } = useQuery({
    queryKey: ["active-loan-check", user?.id],
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

  // Fetch loan products
  const { data: loanProducts } = useQuery({
    queryKey: ["loan-products-apply"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as LoanProduct[];
    },
  });

  // Pre-fill from query params
  useEffect(() => {
    if (!loanProducts?.length) return;
    const productId = searchParams.get("product");
    const amount = searchParams.get("amount");
    const term = searchParams.get("term");
    if (productId) {
      const p = loanProducts.find(lp => lp.id === productId);
      if (p) {
        setSelectedProduct(p);
        if (amount) setLoanAmount(Math.max(p.min_amount, Math.min(Number(amount), p.max_amount)));
        if (term) setLoanTerm(Math.max(p.min_term_months, Math.min(Number(term), p.max_term_months)));
        setStep(1);
      }
    }
  }, [loanProducts, searchParams]);

  // Pre-fill employer info from profile
  useEffect(() => {
    if (profile) {
      if (profile.employer_name) setEmployerName(profile.employer_name);
      if (profile.net_income) setMonthlySalary(String(profile.net_income));
    }
  }, [profile]);

  // Clamp amount/term when product changes
  useEffect(() => {
    if (selectedProduct) {
      setLoanAmount(prev => Math.max(selectedProduct.min_amount, Math.min(prev, selectedProduct.max_amount)));
      setLoanTerm(prev => Math.max(selectedProduct.min_term_months, Math.min(prev, selectedProduct.max_term_months)));
    }
  }, [selectedProduct]);

  const loanCalc = useMemo(() => {
    if (!selectedProduct) return null;
    return calculateLoan(loanAmount, loanTerm, {
      interest_rate: selectedProduct.interest_rate,
      interest_period: selectedProduct.interest_period as any,
      interest_type: selectedProduct.interest_type as any,
      processing_fee_percent: selectedProduct.processing_fee_percent,
      enforcement_fee_percent: (selectedProduct as any).enforcement_fee_percent ?? 0,
      insurance_percent: selectedProduct.insurance_percent,
      vat_percent: selectedProduct.vat_percent,
      platform_fee_percent: selectedProduct.platform_fee_percent,
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

  // Filter out identity docs that may already be in vault
  const identityDocTypes = ["nrc_front", "nrc_back", "selfie_holding_nrc"];

  const isProfileComplete = !!(profile?.full_name && profile?.phone && profile?.nrc_number);
  const productName = selectedProduct?.name || "";
  const isCollateralLoan = !!selectedProduct?.collateral_required;
  const isBusinessLoan = productName.toLowerCase().includes("business");
  const isSalaryAdvance = productName.toLowerCase().includes("salary");

  const canProceedStep1 = !!selectedProduct;
  const canProceedStep2 = !!loanPurpose && (
    (!isCollateralLoan || (collateralDescription && collateralValue)) &&
    (!isBusinessLoan || (businessName && businessTpin)) &&
    (!isSalaryAdvance || (employerName && monthlySalary))
  );

  // Check mandatory docs uploaded (skip identity docs if KYC verified)
  const mandatoryDocs = requiredDocs.filter(d => d.is_mandatory);
  const uploadedMandatoryCount = mandatoryDocs.filter(d => {
    const docKey = d.document_type;
    if (kycStatus?.isVerified && identityDocTypes.some(idt => docKey.toLowerCase().includes(idt.replace(/_/g, '')))) {
      return true; // Skip identity docs if KYC verified
    }
    return !!documentFiles[docKey];
  }).length;
  const canProceedStep3 = uploadedMandatoryCount >= mandatoryDocs.length;
  const canSubmit = termsAccepted && crbConsent;

  const handleFileChange = (docType: string, file: File | null) => {
    setDocumentFiles(prev => ({ ...prev, [docType]: file }));
  };

  const handleSubmit = async () => {
    if (!user || !profile || !selectedProduct || !loanCalc) return;
    setIsSubmitting(true);

    try {
      // Build product_specific_data
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
      }

      const employmentTypeMap: Record<string, "employed" | "self_employed" | "contract" | "other"> = {
        permanent: "employed", employed: "employed", contract: "contract",
        self_employed: "self_employed", "self-employed": "self_employed",
      };

      // Insert loan application
      const { data: newApp, error: insertError } = await supabase.from("loan_applications").insert({
        user_id: user.id,
        full_name: profile.full_name || "",
        email: profile.email || "",
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
        interest_rate: selectedProduct.interest_rate,
        monthly_payment: loanCalc.monthlyPayment,
        total_repayment: loanCalc.totalRepayment,
        loan_product_id: selectedProduct.id,
        status: "pending",
        source: "website",
        crb_consent: crbConsent,
        crb_consent_timestamp: crbConsent ? new Date().toISOString() : null,
        // Collateral fields
        ...(isCollateralLoan ? {
          collateral_description: collateralDescription,
          collateral_value: Number(collateralValue) || 0,
        } : {}),
        // Product-specific JSONB
        product_specific_data: Object.keys(productSpecificData).length > 0 ? productSpecificData : {},
      }).select("id").single();

      if (insertError) throw insertError;
      const applicationId = newApp.id;

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
          status: "pending",
        });

        // Map specific doc types to loan_applications columns
        const columnMap: Record<string, string> = {
          payslip_1: "payslip_url",
          payslip_2: "payslip_2_url",
          payslip_3: "payslip_3_url",
          bank_statement_1: "bank_statement_url",
          nrc_front: "nrc_front_url",
          nrc_back: "nrc_back_url",
          selfie_holding_nrc: "selfie_url",
        };
        if (columnMap[docType]) {
          await supabase.from("loan_applications")
            .update({ [columnMap[docType]]: filePath })
            .eq("id", applicationId);
        }
      }

      // Upload collateral images if any
      for (let i = 0; i < collateralImages.length; i++) {
        const file = collateralImages[i];
        const filePath = `${user.id}/${applicationId}/collateral_${i + 1}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: uploadErr } = await supabase.storage
          .from("loan-documents")
          .upload(filePath, file, { cacheControl: "3600", upsert: false });

        if (!uploadErr) {
          const colField = i === 0 ? "collateral_image_url" : i === 1 ? "collateral_image_2_url" : "collateral_image_3_url";
          await supabase.from("loan_applications")
            .update({ [colField]: filePath })
            .eq("id", applicationId);

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
            status: "pending",
          });
        }
      }

      toast({ title: "Application Submitted!", description: "Your loan application has been submitted for review. Track it from your dashboard." });
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({ title: "Submission Failed", description: error.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Not authenticated ─────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-28 pb-20">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Apply for a Loan</h1>
              <p className="text-muted-foreground text-lg">
                To get started with your loan application, please log in or create an account first.
              </p>
            </div>
            <div className="grid gap-4 mb-10">
              {[
                { icon: UserPlus, title: "1. Create Account", desc: "Sign up with your email and verify your identity" },
                { icon: FileText, title: "2. Complete KYC", desc: "Fill in your personal, financial, and employment details" },
                { icon: Shield, title: "3. Submit Application", desc: "Choose a loan product and apply directly" },
                { icon: Clock, title: "4. Get Approved", desc: "Track your application status in real-time" },
              ].map((s, i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <s.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{s.title}</p>
                      <p className="text-sm text-muted-foreground">{s.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="hero" asChild className="gap-2">
                <Link to="/auth?mode=signup"><UserPlus size={18} /> Create Account</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="gap-2">
                <Link to="/auth"><LogIn size={18} /> Log In</Link>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ─── Authenticated: Multi-step form ─────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Loan Application</h1>
            <p className="text-muted-foreground">Complete the steps below to submit your application</p>
          </div>

          {/* Blockers */}
          {!isProfileComplete && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your profile is incomplete. Please update your{" "}
                <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/profile")}>profile</Button>
                {" "}with your full name, phone, and NRC number before applying.
              </AlertDescription>
            </Alert>
          )}

          {hasActiveLoan && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You already have an active or pending loan application. Please complete or wait for it to be processed before applying again.
              </AlertDescription>
            </Alert>
          )}

          {!kycStatus?.isVerified && (
            <Alert className="mb-6 border-yellow-500/30 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-200">
                Your KYC documents are not yet verified. You can still apply, but approval requires verified identity documents.{" "}
                <Button variant="link" className="p-0 h-auto text-yellow-400" onClick={() => navigate("/profile")}>Upload Documents</Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Step Progress */}
          <div className="mb-8">
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
              <h2 className="text-xl font-semibold text-foreground">Choose a Loan Product</h2>
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
                              <h3 className="font-semibold text-foreground">{product.name}</h3>
                              {product.collateral_required && <Badge variant="outline" className="text-xs">Collateral</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{product.description}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>K{product.min_amount.toLocaleString()} – K{product.max_amount.toLocaleString()}</span>
                              <span>{product.interest_rate}% {getInterestPeriodLabel(product.interest_period as any)}</span>
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
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(1)} disabled={!canProceedStep1 || !isProfileComplete || !!hasActiveLoan}>
                  Continue <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── Step 1: Loan Details ─── */}
          {step === 1 && selectedProduct && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground">Loan Details</h2>

              {/* Amount */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Loan Amount</Label>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(loanAmount)}</span>
                </div>
                <Slider
                  value={[loanAmount]}
                  onValueChange={([v]) => setLoanAmount(v)}
                  min={selectedProduct.min_amount}
                  max={selectedProduct.max_amount}
                  step={500}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>K{selectedProduct.min_amount.toLocaleString()}</span>
                  <span>K{selectedProduct.max_amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Term */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Loan Term</Label>
                  <span className="text-xl font-bold text-foreground">{loanTerm} month{loanTerm > 1 ? "s" : ""}</span>
                </div>
                <Slider
                  value={[loanTerm]}
                  onValueChange={([v]) => setLoanTerm(v)}
                  min={selectedProduct.min_term_months}
                  max={selectedProduct.max_term_months}
                  step={1}
                />
              </div>

              {/* Purpose */}
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
                      <Textarea
                        placeholder="Describe the collateral (e.g., 2020 Toyota Corolla, House at Plot 42...)"
                        value={collateralDescription}
                        onChange={(e) => setCollateralDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Estimated Value (ZMW) *</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 50000"
                        value={collateralValue}
                        onChange={(e) => setCollateralValue(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Collateral Images (up to 3)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []).slice(0, 3);
                          setCollateralImages(files);
                        }}
                        className="mt-1"
                      />
                      {collateralImages.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{collateralImages.length} image(s) selected</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Business fields */}
              {isBusinessLoan && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 size={16} className="text-primary" /> Business Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Business Name *</Label>
                      <Input placeholder="e.g. ABC Trading Ltd" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                    </div>
                    <div>
                      <Label>TPIN *</Label>
                      <Input placeholder="e.g. 1234567890" value={businessTpin} onChange={(e) => setBusinessTpin(e.target.value)} />
                    </div>
                    <div>
                      <Label>Registration Number</Label>
                      <Input placeholder="Company reg number" value={businessRegNumber} onChange={(e) => setBusinessRegNumber(e.target.value)} />
                    </div>
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
                    <div>
                      <Label>Employer Name *</Label>
                      <Input placeholder="e.g. Zambia Breweries" value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
                    </div>
                    <div>
                      <Label>Employer Contact</Label>
                      <Input placeholder="HR phone/email" value={employerContact} onChange={(e) => setEmployerContact(e.target.value)} />
                    </div>
                    <div>
                      <Label>Monthly Salary (ZMW) *</Label>
                      <Input type="number" placeholder="e.g. 5000" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Loan Calculator Preview */}
              {loanCalc && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <h4 className="font-semibold flex items-center gap-2 mb-3">
                      <CreditCard size={16} className="text-primary" /> Loan Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Monthly Payment:</span>
                      <span className="font-medium text-right">{formatCurrency(loanCalc.monthlyPayment)}</span>
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

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(0)}>
                  <ArrowLeft size={16} className="mr-2" /> Back
                </Button>
                <Button onClick={() => setStep(2)} disabled={!canProceedStep2}>
                  Continue <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Documents ─── */}
          {step === 2 && selectedProduct && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Upload Documents</h2>
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
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              file || isAutoLinked ? "bg-primary/20" : "bg-muted"
                            }`}>
                              {file || isAutoLinked ? (
                                <CheckCircle size={16} className="text-primary" />
                              ) : (
                                <Upload size={16} className="text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {doc.document_name}
                                {doc.is_mandatory && <span className="text-destructive ml-1">*</span>}
                              </p>
                              {isAutoLinked && (
                                <p className="text-xs text-primary">✓ Linked from verified KYC</p>
                              )}
                              {file && (
                                <p className="text-xs text-muted-foreground truncate">{file.name}</p>
                              )}
                            </div>
                          </div>
                          {!isAutoLinked && (
                            <div className="shrink-0">
                              <Input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                className="w-auto text-xs"
                                onChange={(e) => handleFileChange(docKey, e.target.files?.[0] || null)}
                              />
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

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} className="mr-2" /> Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep3}>
                  Continue <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── Step 3: Review & Submit ─── */}
          {step === 3 && selectedProduct && loanCalc && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground">Review & Submit</h2>

              {/* Personal Info */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium ml-1">{profile?.full_name}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-1">{profile?.phone}</span></div>
                  <div><span className="text-muted-foreground">NRC:</span> <span className="font-medium ml-1">{profile?.nrc_number}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium ml-1">{profile?.email}</span></div>
                </CardContent>
              </Card>

              {/* Loan Details */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Loan Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Product:</span> <span className="font-medium ml-1">{selectedProduct.name}</span></div>
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium ml-1">{formatCurrency(loanAmount)}</span></div>
                  <div><span className="text-muted-foreground">Term:</span> <span className="font-medium ml-1">{loanTerm} months</span></div>
                  <div><span className="text-muted-foreground">Purpose:</span> <span className="font-medium ml-1 capitalize">{loanPurpose.replace(/_/g, " ")}</span></div>
                  <div><span className="text-muted-foreground">Monthly Payment:</span> <span className="font-bold ml-1 text-primary">{formatCurrency(loanCalc.monthlyPayment)}</span></div>
                  <div><span className="text-muted-foreground">Total Repayment:</span> <span className="font-bold ml-1 text-primary">{formatCurrency(loanCalc.totalRepayment)}</span></div>
                  {loanCalc.feesDeductedUpfront > 0 && (
                    <div><span className="text-muted-foreground">You Receive:</span> <span className="font-bold ml-1 text-primary">{formatCurrency(loanCalc.disbursementAmount)}</span></div>
                  )}
                </CardContent>
              </Card>

              {/* Product-Specific Summary */}
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
                        {businessRegNumber && <div><span className="text-muted-foreground">Reg #:</span> <span className="font-medium ml-1">{businessRegNumber}</span></div>}
                        {businessType && <div><span className="text-muted-foreground">Type:</span> <span className="font-medium ml-1 capitalize">{businessType.replace(/_/g, " ")}</span></div>}
                      </>
                    )}
                    {isSalaryAdvance && (
                      <>
                        <div><span className="text-muted-foreground">Employer:</span> <span className="font-medium ml-1">{employerName}</span></div>
                        {employerContact && <div><span className="text-muted-foreground">Contact:</span> <span className="font-medium ml-1">{employerContact}</span></div>}
                        <div><span className="text-muted-foreground">Salary:</span> <span className="font-medium ml-1">K{Number(monthlySalary).toLocaleString()}</span></div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Documents Summary */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Documents</CardTitle>
                </CardHeader>
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

              {/* Consents */}
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

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} className="mr-2" /> Back
                </Button>
                <Button
                  variant="hero"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !canSubmit || !isProfileComplete || !!hasActiveLoan}
                  className="min-w-[180px]"
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><CheckCircle size={16} className="mr-2" /> Submit Application</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Apply;
