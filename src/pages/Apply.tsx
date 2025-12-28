import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { ArrowLeft, ArrowRight, Upload, CheckCircle, User, Briefcase, CreditCard, FileText, Sparkles, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { cn } from "@/lib/utils";
import GuidedTour from "@/components/common/GuidedTour";
import { Step } from "react-joyride";
import { HelpCircle } from "lucide-react";

interface LoanProduct {
  id: string;
  name: string;
  description: string | null;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate: number;
  processing_fee_percent: number | null;
  requirements: string[] | null;
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

const documentsSchema = z.object({
  nrcFront: z.any().refine((file) => file !== null, "NRC Front is required"),
  nrcBack: z.any().refine((file) => file !== null, "NRC Back is required"),
  payslip: z.any().refine((file) => file !== null, "Latest payslip is required"),
  selfie: z.any().refine((file) => file !== null, "Selfie is required"),
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
    nrcFront: null as File | null,
    nrcBack: null as File | null,
    payslip: null as File | null,
    selfie: null as File | null,
    termsAccepted: false,
    dataConsent: false,
  });

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

  // Pre-fill email if user is logged in
  useEffect(() => {
    if (user?.email) {
      setFormData(prev => ({ ...prev, email: user.email || "" }));
    }
  }, [user]);

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
        documentsSchema.parse({
          nrcFront: formData.nrcFront,
          nrcBack: formData.nrcBack,
          payslip: formData.payslip,
          selfie: formData.selfie,
        });
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

  // Calculate interest based on interest period (default to monthly if not specified)
  // Interest rate from product is per month by default
  const interestRate = selectedProduct ? selectedProduct.interest_rate / 100 : 0.15;
  // For monthly rate: total interest = principal × rate × term
  const totalInterest = formData.loanAmount * interestRate * formData.loanTerm;
  const totalRepayment = formData.loanAmount + totalInterest;
  const monthlyPayment = totalRepayment / formData.loanTerm;

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
      // 1. Upload Documents
      const uploadFile = async (file: File, prefix: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${prefix}_${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage
          .from('loan_documents')
          .upload(fileName, file);

        if (error) throw error;

        // Get public URL or signed URL? 
        // For private documents, we should ideally use signed URLs on fetch, 
        // but for now let's store the path to get publicUrl if bucket is public,
        // or just store the path and fetch later.
        const { data: { publicUrl } } = supabase.storage.from('loan_documents').getPublicUrl(fileName);
        return publicUrl;
      };

      const [nrcFrontUrl, nrcBackUrl, payslipUrl, selfieUrl] = await Promise.all([
        uploadFile(formData.nrcFront!, 'nrc_front'),
        uploadFile(formData.nrcBack!, 'nrc_back'),
        uploadFile(formData.payslip!, 'payslip'),
        uploadFile(formData.selfie!, 'selfie'),
      ]);

      // 2. Map employment type to enum
      const employmentTypeMap: Record<string, "employed" | "self_employed" | "contract" | "other"> = {
        "permanent": "employed",
        "contract": "contract",
        "self-employed": "self_employed",
      };

      // 3. Insert Application with source tag
      const { error } = await supabase.from('loan_applications').insert({
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
        nrc_front_url: nrcFrontUrl,
        nrc_back_url: nrcBackUrl,
        payslip_url: payslipUrl,
        selfie_url: selfieUrl,
        status: 'pending',
        source: 'website',
      });

      if (error) throw error;

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
                        placeholder="+260 XXX XXX XXX"
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
                        <span className="text-foreground font-medium">{selectedProduct?.interest_rate || 15}% p.a.</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Loan Term</span>
                        <span className="text-foreground font-medium">{formData.loanTerm} months</span>
                      </div>
                      <div className="h-px bg-border my-3" />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly Payment</span>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { field: "nrcFront", label: "NRC (Front) *", description: "Clear photo of front" },
                      { field: "nrcBack", label: "NRC (Back) *", description: "Clear photo of back" },
                      { field: "payslip", label: "Latest Payslip *", description: "Most recent payslip" },
                      { field: "selfie", label: "Selfie *", description: "Clear photo of your face" },
                    ].map((doc) => (
                      <div key={doc.field} className="space-y-2">
                        <Label className={errors[doc.field] ? "text-destructive" : ""}>{doc.label}</Label>
                        <label
                          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${formData[doc.field as keyof typeof formData]
                            ? "border-primary bg-primary/10 shadow-glow"
                            : errors[doc.field]
                              ? "border-destructive bg-destructive/5"
                              : "border-border hover:border-primary/50 hover:bg-secondary/50"
                            }`}
                        >
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => handleFileUpload(doc.field, e.target.files?.[0] || null)}
                          />
                          {formData[doc.field as keyof typeof formData] ? (
                            <CheckCircle className="text-primary mb-2" size={32} />
                          ) : (
                            <Upload className={errors[doc.field] ? "text-destructive mb-2" : "text-muted-foreground mb-2"} size={32} />
                          )}
                          <span className={`text-sm ${errors[doc.field] ? "text-destructive" : "text-muted-foreground"}`}>
                            {errors[doc.field] || doc.description}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>

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
