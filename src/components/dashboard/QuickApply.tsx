import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Zap,
  CheckCircle,
  Loader2,
  FileText,
  AlertCircle,
  Upload,
  RefreshCw,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoan, getInterestPeriodLabel } from "@/utils/loanCalculations";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  nrc_number: string | null;
  address: string | null;
  city: string | null;
}

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
}

interface QuickApplyProps {
  userId: string;
  profile: Profile | null;
  onSuccess?: () => void;
}

const QuickApply = ({ userId, profile, onSuccess }: QuickApplyProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [loanAmount, setLoanAmount] = useState(5000);
  const [loanTerm, setLoanTerm] = useState(6);
  const [loanPurpose, setLoanPurpose] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const [needsDocuments, setNeedsDocuments] = useState(false);

  // Fetch loan products
  const { data: loanProducts } = useQuery({
    queryKey: ["loan-products-quick"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .eq("is_active", true)
        .order("min_amount", { ascending: true });
      if (error) throw error;
      return data as LoanProduct[];
    },
  });

  // Fetch previous application to check for existing documents
  const { data: previousApplication } = useQuery({
    queryKey: ["previous-application-quick", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("nrc_front_url, nrc_back_url, selfie_url, payslip_url, employer_name, job_title, monthly_income, employment_type, employment_duration")
        .eq("user_id", userId)
        .not("status", "eq", "rejected")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!userId,
  });

  // Check if user has required documents
  const hasRequiredDocs = previousApplication?.nrc_front_url && 
    previousApplication?.nrc_back_url && 
    previousApplication?.selfie_url && 
    previousApplication?.payslip_url;

  // Check if profile is complete
  const isProfileComplete = profile?.full_name && profile?.phone && profile?.nrc_number && profile?.address;

  useEffect(() => {
    if (loanProducts && loanProducts.length > 0 && !selectedProduct) {
      setSelectedProduct(loanProducts[0]);
      setLoanAmount(loanProducts[0].min_amount);
      setLoanTerm(loanProducts[0].min_term_months);
    }
  }, [loanProducts, selectedProduct]);

  useEffect(() => {
    if (selectedProduct) {
      setLoanAmount(Math.max(selectedProduct.min_amount, Math.min(loanAmount, selectedProduct.max_amount)));
      setLoanTerm(Math.max(selectedProduct.min_term_months, Math.min(loanTerm, selectedProduct.max_term_months)));
    }
  }, [selectedProduct]);

  const loanCalc = selectedProduct
    ? calculateLoan(loanAmount, loanTerm, {
        interest_rate: selectedProduct.interest_rate,
        interest_period: selectedProduct.interest_period as any,
        interest_type: selectedProduct.interest_type as any,
        processing_fee_percent: selectedProduct.processing_fee_percent,
        insurance_percent: selectedProduct.insurance_percent,
        vat_percent: selectedProduct.vat_percent,
        platform_fee_percent: selectedProduct.platform_fee_percent,
      })
    : null;

  const handleQuickApply = async () => {
    if (!isProfileComplete) {
      toast({
        title: "Complete Your Profile",
        description: "Please update your profile with all required information first.",
        variant: "destructive",
      });
      navigate("/profile");
      return;
    }

    if (!hasRequiredDocs) {
      // Redirect to full apply page to upload documents
      setNeedsDocuments(true);
      return;
    }

    if (!termsAccepted || !dataConsent) {
      toast({
        title: "Consent Required",
        description: "Please accept the terms and data consent to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!loanPurpose) {
      toast({
        title: "Purpose Required",
        description: "Please specify the loan purpose.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Map employment type
      const employmentTypeMap: Record<string, "employed" | "self_employed" | "contract" | "other"> = {
        "permanent": "employed",
        "employed": "employed",
        "contract": "contract",
        "self_employed": "self_employed",
        "self-employed": "self_employed",
      };

      const { error } = await supabase.from("loan_applications").insert({
        user_id: userId,
        full_name: profile?.full_name || "",
        email: profile?.email || "",
        phone: profile?.phone || "",
        nrc_number: profile?.nrc_number || "",
        address: profile?.address || "",
        city: profile?.city || "",
        employment_type: employmentTypeMap[previousApplication?.employment_type || ""] || "employed",
        employer_name: previousApplication?.employer_name || "",
        job_title: previousApplication?.job_title || "",
        monthly_income: previousApplication?.monthly_income || 0,
        employment_duration: previousApplication?.employment_duration || "",
        loan_amount: loanAmount,
        loan_purpose: loanPurpose,
        loan_term_months: loanTerm,
        interest_rate: selectedProduct?.interest_rate || 15,
        monthly_payment: loanCalc?.monthlyPayment || 0,
        total_repayment: loanCalc?.totalRepayment || loanAmount,
        loan_product_id: selectedProduct?.id || null,
        // Reuse documents from previous application
        nrc_front_url: previousApplication?.nrc_front_url,
        nrc_back_url: previousApplication?.nrc_back_url,
        selfie_url: previousApplication?.selfie_url,
        payslip_url: previousApplication?.payslip_url,
        status: "pending",
        source: "dashboard_quick_apply",
        crb_consent: dataConsent,
        crb_consent_timestamp: dataConsent ? new Date().toISOString() : null,
      });

      if (error) throw error;

      toast({
        title: "Application Submitted!",
        description: "Your quick loan application has been submitted for review.",
      });

      setIsOpen(false);
      onSuccess?.();
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

  const handleGoToFullApply = () => {
    setIsOpen(false);
    navigate("/apply");
  };

  return (
    <>
      <Card className="glass border-border/50 overflow-hidden">
        <div className="gradient-primary p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-primary-foreground">Quick Apply</h3>
                <Badge className="bg-white/20 text-white border-white/30">
                  <Zap size={12} className="mr-1" />
                  Fast Track
                </Badge>
              </div>
              <p className="text-primary-foreground/80 text-sm">
                {hasRequiredDocs 
                  ? "Apply instantly using your saved profile & documents" 
                  : "Your documents are on file - apply in seconds"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={() => setIsOpen(true)}
                className="bg-white/20 border-white/30 text-white hover:bg-white/30"
              >
                <Zap size={18} className="mr-2" />
                Quick Apply
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/apply")}
                className="border-white/30 text-white hover:bg-white/10"
              >
                <FileText size={18} className="mr-2" />
                Full Application
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Loan Application
            </DialogTitle>
            <DialogDescription>
              Apply instantly using your saved profile information
            </DialogDescription>
          </DialogHeader>

          {!isProfileComplete && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your profile is incomplete. Please update your profile first.
                <Button variant="link" className="p-0 h-auto ml-1" onClick={() => navigate("/profile")}>
                  Update Profile
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {needsDocuments && (
            <Alert>
              <Upload className="h-4 w-4" />
              <AlertDescription>
                You need to upload documents for your first application.
                <Button variant="link" className="p-0 h-auto ml-1" onClick={handleGoToFullApply}>
                  Go to Full Application
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {/* Profile Summary */}
            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Using saved profile:</span>
                {isProfileComplete ? (
                  <Badge variant="outline" className="text-success border-success/30 bg-success/10">
                    <CheckCircle size={12} className="mr-1" />
                    Complete
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
                    Incomplete
                  </Badge>
                )}
              </div>
              <p className="font-medium">{profile?.full_name || "Name not set"}</p>
              <p className="text-sm text-muted-foreground">{profile?.phone || "Phone not set"}</p>
              <p className="text-sm text-muted-foreground">{profile?.nrc_number || "NRC not set"}</p>
            </div>

            {/* Loan Product Selection */}
            <div className="space-y-2">
              <Label>Loan Product</Label>
              <Select 
                value={selectedProduct?.id} 
                onValueChange={(id) => setSelectedProduct(loanProducts?.find(p => p.id === id) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a loan product" />
                </SelectTrigger>
                <SelectContent>
                  {loanProducts?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.interest_rate}% {getInterestPeriodLabel(product.interest_period as any)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Loan Amount */}
            {selectedProduct && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Loan Amount</Label>
                  <span className="text-2xl font-bold text-primary">K{loanAmount.toLocaleString()}</span>
                </div>
                <Slider
                  value={[loanAmount]}
                  onValueChange={([val]) => setLoanAmount(val)}
                  min={selectedProduct.min_amount}
                  max={selectedProduct.max_amount}
                  step={500}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>K{selectedProduct.min_amount.toLocaleString()}</span>
                  <span>K{selectedProduct.max_amount.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Loan Term */}
            {selectedProduct && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Loan Term</Label>
                  <span className="text-xl font-bold text-foreground">{loanTerm} months</span>
                </div>
                <Slider
                  value={[loanTerm]}
                  onValueChange={([val]) => setLoanTerm(val)}
                  min={selectedProduct.min_term_months}
                  max={selectedProduct.max_term_months}
                  step={1}
                  className="w-full"
                />
              </div>
            )}

            {/* Loan Purpose */}
            <div className="space-y-2">
              <Label htmlFor="purpose">Loan Purpose *</Label>
              <Select value={loanPurpose} onValueChange={setLoanPurpose}>
                <SelectTrigger>
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emergency">Emergency/Medical</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="home">Home Improvement</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Loan Summary */}
            {loanCalc && (
              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <CreditCard size={16} className="text-primary" />
                  Loan Summary
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Monthly Payment:</span>
                  <span className="font-medium text-right">K{loanCalc.monthlyPayment.toLocaleString()}</span>
                  <span className="text-muted-foreground">Total Interest:</span>
                  <span className="font-medium text-right">K{loanCalc.totalInterest.toLocaleString()}</span>
                  <span className="text-muted-foreground">Total Repayment:</span>
                  <span className="font-bold text-right text-primary">K{loanCalc.totalRepayment.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Consents */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                  I accept the terms and conditions of the loan agreement
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={dataConsent}
                  onCheckedChange={(checked) => setDataConsent(checked === true)}
                />
                <Label htmlFor="consent" className="text-sm text-muted-foreground cursor-pointer">
                  I consent to credit reference bureau checks
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="hero" 
              onClick={handleQuickApply}
              disabled={isSubmitting || !isProfileComplete || needsDocuments}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Zap size={16} className="mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickApply;
