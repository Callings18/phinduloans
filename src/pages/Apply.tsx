import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { ArrowLeft, ArrowRight, Upload, CheckCircle, User, Briefcase, CreditCard, FileText, Sparkles, Package, Loader2, Link2, Save, Trash2, Clock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoan, getInterestPeriodLabel, type LoanProduct as CalcLoanProduct } from "@/utils/loanCalculations";
import { z } from "zod";
import { cn } from "@/lib/utils";
import GuidedTour from "@/components/common/GuidedTour";
import DocumentUploader from "@/components/common/DocumentUploader";
import { useApplicationDraft, ApplicationDraft } from "@/hooks/useApplicationDraft";
import { Step } from "react-joyride";
import { HelpCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  insurance_percent: number | null;
  vat_percent: number | null;
  platform_fee_percent: number | null;
  requirements: string[] | null;
  collateral_required: boolean | null;
}

const steps = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Employment", icon: Briefcase },
  { id: 3, title: "Loan Details", icon: CreditCard },
  { id: 4, title: "Documents", icon: FileText },
];

const personalInfoSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(10, "Valid phone number required"),
  nrc: z.string().min(6, "Valid NRC number required"),
  dob: z.string().min(1, "Date of birth required"),
  address: z.string().min(5, "Address required"),
});

const employmentSchema = z.object({
  employerName: z.string().min(2, "Employer name required"),
  jobTitle: z.string().min(2, "Job title required"),
  employmentType: z.string().min(1, "Employment type required"),
  monthlyIncome: z.string().min(1, "Monthly income required"),
  employmentDuration: z.string().min(1, "Employment duration required"),
});

const loanSchema = z.object({
  loanAmount: z.number().min(500, "Minimum loan amount is K500"),
  loanPurpose: z.string().min(1, "Loan purpose required"),
  loanTerm: z.number().min(1, "Loan term required"),
});

// Basic documents schema will be checked dynamically
const documentsSchema = z.object({
  // We'll validate this manually based on required docs from DB
});

const Apply = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [runTour, setRunTour] = useState(false);
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [dynamicDocs, setDynamicDocs] = useState<Record<string, File>>({});

  // Draft system
  const { draft, hasDraft, lastSaved, isSaving, saveDraft, clearDraft } = useApplicationDraft();
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftChecked, setDraftChecked] = useState(false);

  // Standard required documents for all loan products
  const productDocs = [
    { document_type: 'nrc_front', document_name: 'NRC Front', is_mandatory: true, display_order: 1 },
    { document_type: 'nrc_back', document_name: 'NRC Back', is_mandatory: true, display_order: 2 },
    { document_type: 'selfie', document_name: 'Selfie Photo', is_mandatory: true, display_order: 3 },
    { document_type: 'payslip', document_name: 'Latest Payslip', is_mandatory: true, display_order: 4 },
    { document_type: 'bank_statement', document_name: 'Bank Statement (3 months)', is_mandatory: false, display_order: 5 },
    { document_type: 'employer_letter', document_name: 'Employment Letter', is_mandatory: false, display_order: 6 },
  ];
  const docsLoading = false;

  // Fetch user profile for autofill
  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch previous application for document reuse
  const { data: previousApplication } = useQuery({
    queryKey: ["previous-application", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  const tourSteps: Step[] = [
    {
      target: ".tour-apply-header",
      content: "Let's get you started! The application is divided into 4 quick steps. We'll guide you through each one.",
      placement: "bottom",
    },
    {
      target: ".tour-apply-steps",
      content: "Track your progress here. You'll need to complete Personal Info, Employment, Loan Details, and Document uploads.",
      placement: "bottom",
    },
    {
      target: ".tour-apply-form",
      content: "Fill in your details accurately. This helps our credit team process your application faster!",
      placement: "top",
    },
    {
      target: ".tour-apply-ai",
      content: "Need help mid-application? PHINDU AI is always here in the corner to answer your questions!",
      placement: "left",
    }
  ];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nrc: "",
    dob: "",
    gender: "",
    address: "",
    city: "",
    employerName: "",
    employerAddress: "",
    jobTitle: "",
    employmentType: "",
    monthlyIncome: "",
    payDay: "",
    employmentDuration: "",
    loanAmount: 5000,
    loanPurpose: "",
    loanTerm: 6,
    repaymentMethod: "",
    collateralDescription: "",
    collateralValue: "",
    nrcFront: null as File | null,
    nrcBack: null as File | null,
    payslip: null as File | null,
    payslip2: null as File | null,
    payslip3: null as File | null,
    bankStatement: null as File | null,
    employerLetter: null as File | null,
    collateralImage: null as File | null,
    selfie: null as File | null,
    termsAccepted: false,
    dataConsent: false,
    reusedDocs: {} as Record<string, string>, // Map of docType -> file_url to reuse
  });

  // Check for existing draft on mount
  useEffect(() => {
    if (!draftChecked && hasDraft && draft) {
      setShowDraftDialog(true);
      setDraftChecked(true);
    }
  }, [hasDraft, draft, draftChecked]);

  // Auto-save draft when form data changes
  useEffect(() => {
    if (draftChecked) {
      const draftData: Partial<ApplicationDraft> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        nrc: formData.nrc,
        dob: formData.dob,
        gender: formData.gender,
        address: formData.address,
        city: formData.city,
        employerName: formData.employerName,
        employerAddress: formData.employerAddress,
        jobTitle: formData.jobTitle,
        employmentType: formData.employmentType,
        monthlyIncome: formData.monthlyIncome,
        payDay: formData.payDay,
        employmentDuration: formData.employmentDuration,
        loanAmount: formData.loanAmount,
        loanPurpose: formData.loanPurpose,
        loanTerm: formData.loanTerm,
        repaymentMethod: formData.repaymentMethod,
        collateralDescription: formData.collateralDescription,
        collateralValue: formData.collateralValue,
        selectedProductId: selectedProduct?.id,
        currentStep,
        uploadedDocNames: Object.fromEntries(
          Object.entries(dynamicDocs).map(([key, file]) => [key, file.name])
        ),
        reusedDocs: formData.reusedDocs,
      };
      saveDraft(draftData);
    }
  }, [formData, currentStep, selectedProduct, dynamicDocs, draftChecked, saveDraft]);

  // Restore draft function
  const handleRestoreDraft = useCallback(() => {
    if (draft) {
      setFormData(prev => ({
        ...prev,
        firstName: draft.firstName || '',
        lastName: draft.lastName || '',
        email: draft.email || prev.email,
        phone: draft.phone || '',
        nrc: draft.nrc || '',
        dob: draft.dob || '',
        gender: draft.gender || '',
        address: draft.address || '',
        city: draft.city || '',
        employerName: draft.employerName || '',
        employerAddress: draft.employerAddress || '',
        jobTitle: draft.jobTitle || '',
        employmentType: draft.employmentType || '',
        monthlyIncome: draft.monthlyIncome || '',
        payDay: draft.payDay || '',
        employmentDuration: draft.employmentDuration || '',
        loanAmount: draft.loanAmount || 5000,
        loanPurpose: draft.loanPurpose || '',
        loanTerm: draft.loanTerm || 6,
        repaymentMethod: draft.repaymentMethod || '',
        collateralDescription: draft.collateralDescription || '',
        collateralValue: draft.collateralValue || '',
        reusedDocs: draft.reusedDocs || {},
        // Ensure other required fields are initialized
        nrcFront: null,
        nrcBack: null,
        payslip: null,
        payslip2: null,
        payslip3: null,
        bankStatement: null,
        employerLetter: null,
        collateralImage: null,
        selfie: null,
        termsAccepted: false,
        dataConsent: false,
      }));
      setCurrentStep(draft.currentStep || 1);

      // Find and set the product if saved
      if (draft.selectedProductId && loanProducts.length > 0) {
        const product = loanProducts.find(p => p.id === draft.selectedProductId);
        if (product) setSelectedProduct(product);
      }

      toast({
        title: "Draft Restored",
        description: "Your previous application progress has been restored.",
      });
    }
    setShowDraftDialog(false);
  }, [draft, loanProducts, toast]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setShowDraftDialog(false);
    toast({
      title: "Draft Discarded",
      description: "Starting a fresh application.",
    });
  }, [clearDraft, toast]);

  // Fetch loan products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("loan_products")
        .select("*")
        .eq("is_active", true)
        .order("min_amount", { ascending: true });

      if (data && data.length > 0) {
        setLoanProducts(data);
        const productId = searchParams.get("product");
        const found = data.find((p) => p.id === productId);
        const product = found || data[0];
        setSelectedProduct(product);
        setFormData(prev => ({
          ...prev,
          loanAmount: product.min_amount,
          loanTerm: product.min_term_months,
        }));
      }
    };
    fetchProducts();
  }, [searchParams]);

  // Autofill profile data if logged in and no draft
  useEffect(() => {
    if (user && profile && !hasDraft && !draftChecked) {
      setFormData(prev => ({
        ...prev,
        firstName: profile.full_name?.split(' ')[0] || prev.firstName,
        lastName: profile.full_name?.split(' ').slice(1).join(' ') || prev.lastName,
        email: profile.email || user.email || prev.email,
        phone: profile.phone || prev.phone,
        nrc: profile.nrc_number || prev.nrc,
        address: profile.address || prev.address,
        city: profile.city || prev.city,
      }));
    } else if (user?.email && !profile) {
      // Fallback for just email
      setFormData(prev => ({ ...prev, email: user.email || "" }));
    }
  }, [user, profile, hasDraft, draftChecked]);

  // Update sliders when product changes
  useEffect(() => {
    if (selectedProduct) {
      setFormData(prev => ({
        ...prev,
        loanAmount: Math.max(selectedProduct.min_amount, Math.min(prev.loanAmount, selectedProduct.max_amount)),
        loanTerm: Math.max(selectedProduct.min_term_months, Math.min(prev.loanTerm, selectedProduct.max_term_months)),
      }));
    }
  }, [selectedProduct]);

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleFileUpload = (field: string, file: File | null) => {
    updateFormData(field, file);
  };

  const handleDynamicFileUpload = (docType: string, file: File | null) => {
    if (file) {
      setDynamicDocs(prev => ({ ...prev, [docType]: file }));
    } else {
      setDynamicDocs(prev => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
    }

    if (errors[docType]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    try {
      if (step === 1) {
        personalInfoSchema.parse({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          nrc: formData.nrc,
          dob: formData.dob,
          address: formData.address,
        });
      } else if (step === 2) {
        employmentSchema.parse({
          employerName: formData.employerName,
          jobTitle: formData.jobTitle,
          employmentType: formData.employmentType,
          monthlyIncome: formData.monthlyIncome,
          employmentDuration: formData.employmentDuration,
        });
      } else if (step === 3) {
        loanSchema.parse({
          loanAmount: formData.loanAmount,
          loanPurpose: formData.loanPurpose,
          loanTerm: formData.loanTerm,
        });
      } else if (step === 4) {
        // Dynamic documents validation
        let hasErrors = false;
        const newDocErrors: Record<string, string> = {};

        productDocs?.forEach((doc: any) => {
          // Check if mandatory AND not uploaded AND not being reused
          if (doc.is_mandatory && !dynamicDocs[doc.document_type] && !formData.reusedDocs[doc.document_type]) {
            newDocErrors[doc.document_type] = `${doc.document_name} is required`;
            hasErrors = true;
          }
        });

        if (hasErrors) {
          setErrors(newDocErrors);
          return false;
        }
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Calculate loan using unified calculation utility
  const loanCalc = selectedProduct
    ? calculateLoan(formData.loanAmount, formData.loanTerm, {
      interest_rate: selectedProduct.interest_rate,
      interest_period: selectedProduct.interest_period as any,
      interest_type: selectedProduct.interest_type as any,
      processing_fee_percent: selectedProduct.processing_fee_percent,
      insurance_percent: selectedProduct.insurance_percent,
      vat_percent: selectedProduct.vat_percent,
      platform_fee_percent: selectedProduct.platform_fee_percent,
    })
    : null;

  const totalInterest = loanCalc?.totalInterest ?? 0;
  const totalRepayment = loanCalc?.totalRepayment ?? formData.loanAmount;
  const monthlyPayment = loanCalc?.monthlyPayment ?? 0;
  const interestPeriodLabel = selectedProduct
    ? getInterestPeriodLabel(selectedProduct.interest_period as any)
    : 'per month';

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login or create an account to submit your application.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    if (!formData.termsAccepted || !formData.dataConsent) {
      toast({
        title: "Consent Required",
        description: "Please accept the terms and data consent to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload Documents with better error handling
      const uploadedDocs: any[] = [];
      const docEntries = Object.entries(dynamicDocs);

      for (const [docType, file] of docEntries) {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${docType}_${Date.now()}.${fileExt}`;
          const { data, error: uploadErr } = await supabase.storage
            .from('loan-documents')
            .upload(fileName, file);

          if (uploadErr) {
            console.error(`Failed to upload ${docType}:`, uploadErr);
            // Continue with other uploads, don't fail entirely
            toast({
              title: "Document Upload Warning",
              description: `${docType} upload failed: ${uploadErr.message}. Application will continue.`,
              variant: "default",
            });
          } else {
            // Store the file path instead of public URL
            uploadedDocs.push({
              document_type: docType,
              file_url: fileName,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type
            });
          }
        } catch (err: any) {
          console.error(`Upload error for ${docType}:`, err);
        }
      }

      // 2. Map employment type
      const employmentTypeMap: Record<string, "employed" | "self_employed" | "contract" | "other"> = {
        "permanent": "employed",
        "contract": "contract",
        "self-employed": "self_employed",
      };

      // 3. Insert Application - store file paths for secure access
      const { data: appData, error: appError } = await supabase.from('loan_applications').insert({
        user_id: user.id,
        full_name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        nrc_number: formData.nrc,
        date_of_birth: formData.dob || null,
        address: formData.address,
        city: formData.city || null,
        employment_type: employmentTypeMap[formData.employmentType] || "other",
        employer_name: formData.employerName,
        job_title: formData.jobTitle,
        monthly_income: parseFloat(formData.monthlyIncome) || 0,
        employment_duration: formData.employmentDuration,
        loan_amount: formData.loanAmount,
        loan_purpose: formData.loanPurpose,
        loan_term_months: formData.loanTerm,
        interest_rate: (selectedProduct?.interest_rate || 15),
        monthly_payment: monthlyPayment,
        total_repayment: totalRepayment,
        loan_product_id: selectedProduct?.id || null,
        // Use reused URL if available, otherwise new upload URL
        nrc_front_url: formData.reusedDocs['nrc_front'] || uploadedDocs.find(d => d.document_type === 'nrc_front')?.file_url || null,
        nrc_back_url: formData.reusedDocs['nrc_back'] || uploadedDocs.find(d => d.document_type === 'nrc_back')?.file_url || null,
        payslip_url: formData.reusedDocs['payslip'] || uploadedDocs.find(d => d.document_type === 'payslip')?.file_url || null,
        selfie_url: formData.reusedDocs['selfie'] || uploadedDocs.find(d => d.document_type === 'selfie')?.file_url || null,
        collateral_description: formData.collateralDescription || null,
        collateral_value: formData.collateralValue ? parseFloat(formData.collateralValue) : null,
        status: 'pending',
        source: 'website',
        crb_consent: formData.dataConsent,
        crb_consent_timestamp: formData.dataConsent ? new Date().toISOString() : null,
      }).select().single();

      if (appError) throw appError;

      // 4. Update profile
      await supabase.from('profiles').upsert({
        id: user.id,
        email: formData.email,
        full_name: `${formData.firstName} ${formData.lastName}`,
        phone: formData.phone,
        nrc_number: formData.nrc,
        address: formData.address,
        city: formData.city || null,
      });

      // Clear draft on successful submission
      clearDraft();

      toast({
        title: "Application Submitted!",
        description: "We'll review your application and get back to you within 24 hours.",
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <GuidedTour
        steps={tourSteps}
        tourKey="loan-application"
        externalRun={runTour}
        onFinish={() => setRunTour(false)}
      />

      {/* Draft Recovery Dialog */}
      <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Resume Previous Application?
            </DialogTitle>
            <DialogDescription>
              We found an unfinished application from{' '}
              {draft?.lastSaved && formatDistanceToNow(new Date(draft.lastSaved), { addSuffix: true })}.
              Would you like to continue where you left off?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Name:</span>{' '}
              <span className="font-medium">{draft?.firstName} {draft?.lastName}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Amount:</span>{' '}
              <span className="font-medium">K{draft?.loanAmount?.toLocaleString()}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Progress:</span>{' '}
              <span className="font-medium">Step {draft?.currentStep} of 4</span>
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleDiscardDraft}>
              <Trash2 size={16} className="mr-2" />
              Start Fresh
            </Button>
            <Button variant="hero" onClick={handleRestoreDraft}>
              <RefreshCw size={16} className="mr-2" />
              Resume Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12 tour-apply-header">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-6">
              <Sparkles className="text-primary-foreground" size={28} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Apply for a <span className="text-gradient">Loan</span>
            </h1>
            <p className="text-muted-foreground mr-2 inline">
              Complete the form below to apply for your loan. It only takes a few minutes.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-primary p-0 h-auto"
              onClick={() => setRunTour(true)}
            >
              <HelpCircle size={14} className="mr-1" />
              Tour
            </Button>
            {!user && !isLoading && (
              <p className="text-primary text-sm mt-2">
                Already have an account? <a href="/auth" className="underline font-medium">Login</a> to auto-fill your details
              </p>
            )}
          </div>

          {/* Auto-save indicator */}
          {draftChecked && (
            <div className="max-w-2xl mx-auto mb-6">
              <Alert className="glass border-border/50">
                <AlertDescription className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {isSaving ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-primary" />
                        <span className="text-muted-foreground">Saving...</span>
                      </>
                    ) : lastSaved ? (
                      <>
                        <Save size={14} className="text-success" />
                        <span className="text-muted-foreground">
                          Auto-saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock size={14} className="text-muted-foreground" />
                        <span className="text-muted-foreground">Your progress will be saved automatically</span>
                      </>
                    )}
                  </div>
                  {hasDraft && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearDraft();
                        toast({
                          title: "Draft Cleared",
                          description: "Your saved progress has been cleared.",
                        });
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={12} className="mr-1" />
                      Clear Draft
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Progress Steps */}
          <div className="max-w-3xl mx-auto mb-12 tour-apply-steps">
            <div className="flex justify-between items-center">
              {steps.map((step, index) => (
                <div key={step.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center w-full">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${currentStep >= step.id
                        ? "gradient-primary shadow-glow scale-110"
                        : "bg-secondary border border-border"
                        }`}
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="text-primary-foreground" size={26} />
                      ) : (
                        <step.icon
                          className={currentStep >= step.id ? "text-primary-foreground" : "text-muted-foreground"}
                          size={26}
                        />
                      )}
                    </div>
                    <span
                      className={`mt-3 text-sm font-medium hidden md:block transition-colors duration-300 ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                        }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-3 rounded-full transition-all duration-500 ${currentStep > step.id ? "gradient-primary" : "bg-border"
                        }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="max-w-2xl mx-auto tour-apply-form">
            <div className="glass rounded-3xl p-8 md:p-12 shadow-card">
              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Personal Information</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        placeholder="Enter first name"
                        value={formData.firstName}
                        onChange={(e) => updateFormData("firstName", e.target.value)}
                        className={errors.firstName ? "border-destructive" : ""}
                      />
                      {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        placeholder="Enter last name"
                        value={formData.lastName}
                        onChange={(e) => updateFormData("lastName", e.target.value)}
                        className={errors.lastName ? "border-destructive" : ""}
                      />
                      {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => updateFormData("email", e.target.value)}
                        className={errors.email ? "border-destructive" : ""}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        placeholder="+260 967 713 001"
                        value={formData.phone}
                        onChange={(e) => updateFormData("phone", e.target.value)}
                        className={errors.phone ? "border-destructive" : ""}
                      />
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="nrc">NRC Number *</Label>
                      <Input
                        id="nrc"
                        placeholder="XXXXXX/XX/X"
                        value={formData.nrc}
                        onChange={(e) => updateFormData("nrc", e.target.value)}
                        className={errors.nrc ? "border-destructive" : ""}
                      />
                      {errors.nrc && <p className="text-sm text-destructive">{errors.nrc}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dob">Date of Birth *</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={formData.dob}
                        onChange={(e) => updateFormData("dob", e.target.value)}
                        className={errors.dob ? "border-destructive" : ""}
                      />
                      {errors.dob && <p className="text-sm text-destructive">{errors.dob}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select value={formData.gender} onValueChange={(v) => updateFormData("gender", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        placeholder="Enter your city"
                        value={formData.city}
                        onChange={(e) => updateFormData("city", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Residential Address *</Label>
                    <Input
                      id="address"
                      placeholder="Enter your full address"
                      value={formData.address}
                      onChange={(e) => updateFormData("address", e.target.value)}
                      className={errors.address ? "border-destructive" : ""}
                    />
                    {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                  </div>
                </div>
              )}

              {/* Step 2: Employment */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Employment Details</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="employerName">Employer Name *</Label>
                      <Input
                        id="employerName"
                        placeholder="Company name"
                        value={formData.employerName}
                        onChange={(e) => updateFormData("employerName", e.target.value)}
                        className={errors.employerName ? "border-destructive" : ""}
                      />
                      {errors.employerName && <p className="text-sm text-destructive">{errors.employerName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle">Job Title *</Label>
                      <Input
                        id="jobTitle"
                        placeholder="Your position"
                        value={formData.jobTitle}
                        onChange={(e) => updateFormData("jobTitle", e.target.value)}
                        className={errors.jobTitle ? "border-destructive" : ""}
                      />
                      {errors.jobTitle && <p className="text-sm text-destructive">{errors.jobTitle}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employerAddress">Employer Address</Label>
                    <Input
                      id="employerAddress"
                      placeholder="Company address"
                      value={formData.employerAddress}
                      onChange={(e) => updateFormData("employerAddress", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Employment Type *</Label>
                      <Select value={formData.employmentType} onValueChange={(v) => updateFormData("employmentType", v)}>
                        <SelectTrigger className={errors.employmentType ? "border-destructive" : ""}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="permanent">Permanent</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="self-employed">Self-Employed</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.employmentType && <p className="text-sm text-destructive">{errors.employmentType}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Employment Duration *</Label>
                      <Select value={formData.employmentDuration} onValueChange={(v) => updateFormData("employmentDuration", v)}>
                        <SelectTrigger className={errors.employmentDuration ? "border-destructive" : ""}>
                          <SelectValue placeholder="How long?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0-6">Less than 6 months</SelectItem>
                          <SelectItem value="6-12">6-12 months</SelectItem>
                          <SelectItem value="1-2">1-2 years</SelectItem>
                          <SelectItem value="2+">More than 2 years</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.employmentDuration && <p className="text-sm text-destructive">{errors.employmentDuration}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="monthlyIncome">Monthly Income (ZMW) *</Label>
                      <Input
                        id="monthlyIncome"
                        type="number"
                        placeholder="e.g. 5000"
                        value={formData.monthlyIncome}
                        onChange={(e) => updateFormData("monthlyIncome", e.target.value)}
                        className={errors.monthlyIncome ? "border-destructive" : ""}
                      />
                      {errors.monthlyIncome && <p className="text-sm text-destructive">{errors.monthlyIncome}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payDay">Pay Day</Label>
                      <Input
                        id="payDay"
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Day of month (1-31)"
                        value={formData.payDay}
                        onChange={(e) => updateFormData("payDay", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Loan Details */}
              {currentStep === 3 && (
                <div className="space-y-8 animate-fade-in">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Loan Details</h2>

                  {/* Loan Product Selector */}
                  {loanProducts.length > 0 && (
                    <div className="space-y-3">
                      <Label>Loan Type *</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {loanProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => setSelectedProduct(product)}
                            className={cn(
                              "p-4 rounded-xl border text-left transition-all",
                              selectedProduct?.id === product.id
                                ? "border-primary bg-primary/10 shadow-glow"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Package size={16} className="text-primary" />
                              <span className="font-medium text-foreground">{product.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{product.description}</p>
                            <p className="text-xs text-primary mt-1">{product.interest_rate}% interest</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-4">
                        <Label>Loan Amount</Label>
                        <span className="text-primary font-bold text-2xl">K{formData.loanAmount.toLocaleString()}</span>
                      </div>
                      <Slider
                        value={[formData.loanAmount]}
                        onValueChange={(value) => updateFormData("loanAmount", value[0])}
                        min={selectedProduct?.min_amount || 500}
                        max={selectedProduct?.max_amount || 50000}
                        step={100}
                      />
                      <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                        <span>K{(selectedProduct?.min_amount || 500).toLocaleString()}</span>
                        <span>K{(selectedProduct?.max_amount || 50000).toLocaleString()}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-4">
                        <Label>Loan Term</Label>
                        <span className="text-primary font-bold text-2xl">{formData.loanTerm} months</span>
                      </div>
                      <Slider
                        value={[formData.loanTerm]}
                        onValueChange={(value) => updateFormData("loanTerm", value[0])}
                        min={selectedProduct?.min_term_months || 1}
                        max={selectedProduct?.max_term_months || 24}
                        step={1}
                      />
                      <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                        <span>{selectedProduct?.min_term_months || 1} month</span>
                        <span>{selectedProduct?.max_term_months || 24} months</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Purpose of Loan *</Label>
                    <Select value={formData.loanPurpose} onValueChange={(v) => updateFormData("loanPurpose", v)}>
                      <SelectTrigger className={errors.loanPurpose ? "border-destructive" : ""}>
                        <SelectValue placeholder="Why do you need this loan?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="home">Home Improvement</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.loanPurpose && <p className="text-sm text-destructive">{errors.loanPurpose}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Repayment Method</Label>
                    <Select value={formData.repaymentMethod} onValueChange={(v) => updateFormData("repaymentMethod", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="How will you repay?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile-money">Mobile Money</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="salary-deduction">Salary Deduction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Summary */}
                  <div className="p-6 rounded-2xl gradient-card border border-border/50">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Loan Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Loan Amount</span>
                        <span className="text-foreground font-medium">K{formData.loanAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Interest Rate</span>
                        <span className="text-foreground font-medium">{selectedProduct?.interest_rate || 15}% {interestPeriodLabel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Loan Term</span>
                        <span className="text-foreground font-medium">{formData.loanTerm} months</span>
                      </div>
                      {loanCalc && loanCalc.feesDeductedUpfront > 0 && (
                        <>
                          <div className="h-px bg-border my-3" />
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Service Fees (deducted)</span>
                            <span className="text-destructive">-K{loanCalc.feesDeductedUpfront.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-foreground font-medium">You Will Receive</span>
                            <span className="text-primary font-bold text-lg">K{loanCalc.disbursementAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      )}
                      <div className="h-px bg-border my-3" />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly Repayment</span>
                        <span className="text-primary font-bold text-lg">K{monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Repayment</span>
                        <span className="text-foreground font-semibold">K{totalRepayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Documents */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Upload Documents</h2>

                  {/* Dynamic Documents from Product Config */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">Required Documents</h3>
                    {productDocs && productDocs.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {productDocs.map((doc: any) => (
                          <div key={doc.id} className="space-y-2">
                            <Label className={errors[doc.document_type] ? "text-destructive" : ""}>
                              {doc.document_name} {doc.is_mandatory && "*"}
                            </Label>

                            {/* Document Reuse Option */}
                            {previousApplication &&
                              ['nrc_front', 'nrc_back', 'payslip', 'selfie'].includes(doc.document_type) &&
                              previousApplication[`${doc.document_type}_url`] && (
                                <div className="mb-2 flex items-center space-x-2 bg-secondary/50 p-2 rounded-lg">
                                  <Checkbox
                                    id={`reuse-${doc.id}`}
                                    checked={!!formData.reusedDocs[doc.document_type]}
                                    onCheckedChange={(checked) => {
                                      const url = previousApplication[`${doc.document_type}_url`];
                                      setFormData(prev => {
                                        const next = { ...prev };
                                        if (checked) {
                                          next.reusedDocs = { ...next.reusedDocs, [doc.document_type]: url };
                                          // Clear manual upload if switching to reuse
                                          setDynamicDocs(docs => {
                                            const d = { ...docs };
                                            delete d[doc.document_type];
                                            return d;
                                          });
                                        } else {
                                          const r = { ...next.reusedDocs };
                                          delete r[doc.document_type];
                                          next.reusedDocs = r;
                                        }
                                        return next;
                                      });
                                      // Clear error
                                      if (errors[doc.document_type]) {
                                        setErrors(e => {
                                          const next = { ...e };
                                          delete next[doc.document_type];
                                          return next;
                                        });
                                      }
                                    }}
                                  />
                                  <label htmlFor={`reuse-${doc.id}`} className="text-sm cursor-pointer flex-1">
                                    <span className="font-medium">Reuse from previous application</span>
                                    <span className="block text-xs text-muted-foreground">
                                      Verified on {new Date(previousApplication.created_at).toLocaleDateString()}
                                    </span>
                                  </label>
                                  <CheckCircle size={16} className="text-success" />
                                </div>
                              )}

                            {!formData.reusedDocs[doc.document_type] && (
                              <label
                                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${dynamicDocs[doc.document_type]
                                  ? "border-primary bg-primary/10 shadow-glow"
                                  : errors[doc.document_type]
                                    ? "border-destructive bg-destructive/5"
                                    : "border-border hover:border-primary/50 hover:bg-secondary/50"
                                  }`}
                              >
                                <input
                                  type="file"
                                  accept={doc.allowed_file_types?.map((t: string) => `.${t}`).join(',') || "image/*,.pdf"}
                                  className="hidden"
                                  onChange={(e) => handleDynamicFileUpload(doc.document_type, e.target.files?.[0] || null)}
                                />
                                {dynamicDocs[doc.document_type] ? (
                                  <CheckCircle className="text-primary mb-2" size={32} />
                                ) : (
                                  <Upload className={errors[doc.document_type] ? "text-destructive mb-2" : "text-muted-foreground mb-2"} size={32} />
                                )}
                                <span className={`text-sm ${errors[doc.document_type] ? "text-destructive" : "text-muted-foreground"}`}>
                                  {errors[doc.document_type] || doc.description || `Upload ${doc.document_name}`}
                                </span>
                                {dynamicDocs[doc.document_type] && (
                                  <span className="text-[10px] text-primary mt-1 truncate max-w-full italic">
                                    {dynamicDocs[doc.document_type].name}
                                  </span>
                                )}
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed rounded-xl border-border">
                        <p className="text-muted-foreground">No documents required for this product.</p>
                      </div>
                    )}
                  </div>

                  {/* Collateral Details - still manual if needed */}
                  {selectedProduct?.collateral_required && (
                    <div className="pt-6 border-t border-border">
                      <h3 className="text-sm font-medium text-muted-foreground mb-4">Collateral Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Collateral Description</Label>
                          <Input
                            placeholder="Describe the collateral"
                            value={formData.collateralDescription}
                            onChange={(e) => updateFormData("collateralDescription", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Estimated Value (K)</Label>
                          <Input
                            type="number"
                            placeholder="Value in Kwacha"
                            value={formData.collateralValue}
                            onChange={(e) => updateFormData("collateralValue", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-6 border-t border-border">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="terms"
                        checked={formData.termsAccepted}
                        onCheckedChange={(checked) => updateFormData("termsAccepted", checked)}
                      />
                      <label htmlFor="terms" className="text-sm text-muted-foreground">
                        I agree to the{" "}
                        <a href="#" className="text-primary hover:underline">Terms and Conditions</a>{" "}
                        and{" "}
                        <a href="#" className="text-primary hover:underline">Loan Agreement</a>
                      </label>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="consent"
                        checked={formData.dataConsent}
                        onCheckedChange={(checked) => updateFormData("dataConsent", checked)}
                      />
                      <label htmlFor="consent" className="text-sm text-muted-foreground">
                        I consent to the processing of my personal data for loan assessment purposes
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-10 pt-6 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="gap-2"
                >
                  <ArrowLeft size={18} />
                  Previous
                </Button>

                {currentStep < 4 ? (
                  <Button variant="hero" onClick={nextStep} className="gap-2">
                    Next Step
                    <ArrowRight size={18} />
                  </Button>
                ) : (
                  <Button
                    variant="hero"
                    onClick={handleSubmit}
                    disabled={!formData.termsAccepted || !formData.dataConsent || isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Application
                        <ArrowRight size={18} />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Apply;
