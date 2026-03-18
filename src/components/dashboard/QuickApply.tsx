import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Zap,
  CheckCircle,
  FileText,
  AlertCircle,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoan, formatCurrency, getInterestPeriodLabel } from "@/utils/loanCalculations";

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
  kycVerified?: boolean;
  hasActiveLoan?: boolean;
  onSuccess?: () => void;
  onApply?: (productId: string, amount: number, term: number) => void;
}

const QuickApply = ({ userId, profile, kycVerified = false, hasActiveLoan = false, onApply }: QuickApplyProps) => {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [loanAmount, setLoanAmount] = useState(5000);
  const [loanTerm, setLoanTerm] = useState(1);

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
    staleTime: 30000,
  });

  useEffect(() => {
    if (loanProducts?.length && !selectedProduct) {
      setSelectedProduct(loanProducts[0]);
      setLoanAmount(loanProducts[0].min_amount);
      setLoanTerm(loanProducts[0].min_term_months);
    }
  }, [loanProducts, selectedProduct]);

  useEffect(() => {
    if (selectedProduct) {
      setLoanAmount(prev => Math.max(selectedProduct.min_amount, Math.min(prev, selectedProduct.max_amount)));
      setLoanTerm(prev => Math.max(selectedProduct.min_term_months, Math.min(prev, selectedProduct.max_term_months)));
    }
  }, [selectedProduct]);

  const loanCalc = selectedProduct
    ? calculateLoan(loanAmount, loanTerm, {
        interest_rate: selectedProduct.interest_rate,
        interest_period: selectedProduct.interest_period as any,
        interest_type: selectedProduct.interest_type as any,
        processing_fee_percent: selectedProduct.processing_fee_percent,
        enforcement_fee_percent: (selectedProduct as any).enforcement_fee_percent ?? 0,
        insurance_percent: selectedProduct.insurance_percent,
        vat_percent: selectedProduct.vat_percent,
        platform_fee_percent: selectedProduct.platform_fee_percent,
      })
    : null;

  const handleApply = () => {
    if (selectedProduct && onApply) {
      onApply(selectedProduct.id, loanAmount, loanTerm);
    }
  };

  return (
    <Card className="glass border-border/50 overflow-hidden">
      <div className={`${kycVerified && !hasActiveLoan ? 'gradient-primary' : 'bg-muted/50'} p-6`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-xl font-bold ${kycVerified && !hasActiveLoan ? 'text-primary-foreground' : 'text-foreground'}`}>
                {hasActiveLoan ? 'Loan in Progress' : kycVerified ? 'Loan Calculator' : 'Apply for a Loan'}
              </h3>
              {hasActiveLoan ? (
                <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10">
                  <CreditCard size={12} className="mr-1" /> Active Loan
                </Badge>
              ) : kycVerified ? (
                <Badge className="bg-white/20 text-white border-white/30">
                  <Zap size={12} className="mr-1" /> Fast Track
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/10">
                  <AlertCircle size={12} className="mr-1" /> KYC Pending
                </Badge>
              )}
            </div>
            <p className={`text-sm ${kycVerified && !hasActiveLoan ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {hasActiveLoan
                ? "You have an active loan. Complete it before applying for a new one."
                : kycVerified
                ? "Estimate your repayments and apply when ready"
                : "Your identity documents must be verified before you can apply"}
            </p>
          </div>
          <div className="flex gap-2">
            {hasActiveLoan ? (
              <Button variant="outline" disabled>
                <CreditCard size={18} className="mr-2" /> Application Locked
              </Button>
            ) : kycVerified ? (
              <Button
                variant="secondary"
                onClick={handleApply}
                className="bg-white/20 border-white/30 text-white hover:bg-white/30"
              >
                <FileText size={18} className="mr-2" /> Apply Now
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/profile")}>
                <Upload size={18} className="mr-2" /> Upload Documents
              </Button>
            )}
          </div>
        </div>
      </div>

      {!hasActiveLoan && (
        <CardContent className="p-6 space-y-5">
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

          {selectedProduct && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Loan Amount</Label>
                <span className="text-2xl font-bold text-primary">{formatCurrency(loanAmount)}</span>
              </div>
              <Slider value={[loanAmount]} onValueChange={([val]) => setLoanAmount(val)} min={selectedProduct.min_amount} max={selectedProduct.max_amount} step={500} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>K{selectedProduct.min_amount.toLocaleString()}</span>
                <span>K{selectedProduct.max_amount.toLocaleString()}</span>
              </div>
            </div>
          )}

          {selectedProduct && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Loan Term</Label>
                <span className="text-xl font-bold text-foreground">{loanTerm} month{loanTerm > 1 ? "s" : ""}</span>
              </div>
              <Slider value={[loanTerm]} onValueChange={([val]) => setLoanTerm(val)} min={selectedProduct.min_term_months} max={selectedProduct.max_term_months} step={1} />
            </div>
          )}

          <Separator />

          {loanCalc && (
            <div className="bg-primary/5 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <CreditCard size={16} className="text-primary" /> Estimated Repayment
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
            </div>
          )}

          {kycVerified && (
            <Button variant="hero" className="w-full" onClick={handleApply} disabled={hasActiveLoan}>
              <Zap size={16} className="mr-2" /> Apply for This Loan
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default QuickApply;
