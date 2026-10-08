import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { Slider } from "@phinduloans/shared/components/ui/slider";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Separator } from "@phinduloans/shared/components/ui/separator";
import {
  CreditCard,
  Zap,
  CheckCircle,
  FileText,
  AlertCircle,
  Upload,
} from "lucide-react";
import { fetchActiveLoanProducts } from "@phinduloans/shared/services/repositories/loanProductsRepository";
import { isBorrowerPortalProduct } from "@phinduloans/shared/utils/borrowerPortalIntegration";
import { calculateLoan, formatCurrency, getInterestPeriodLabel } from "@phinduloans/shared/utils/loanCalculations";

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
  product_code?: string | null;
  description: string | null;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate: number;
  interest_period: string | null;
  interest_type: string | null;
  term_unit?: string | null;
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
      const rows = await fetchActiveLoanProducts({ sort: "min_amount", ascending: true });
      return (rows as LoanProduct[]).filter((p) => isBorrowerPortalProduct(p as unknown as { channels?: string[]; is_active?: boolean }));
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
        product_name: selectedProduct.name,
        product_code: selectedProduct.product_code ?? undefined,
        interest_rate: selectedProduct.interest_rate,
        interest_period: selectedProduct.interest_period as any,
        interest_type: selectedProduct.interest_type as any,
        term_unit: (selectedProduct.term_unit ?? "months") as any,
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
      <div className={`${kycVerified ? 'gradient-primary' : 'bg-muted/50'} p-6`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-xl font-bold ${kycVerified ? 'text-primary-foreground' : 'text-foreground'}`}>
                {kycVerified ? 'Loan Calculator' : 'Apply for a Loan'}
              </h3>
              {kycVerified ? (
                <Badge className="bg-white/20 text-white border-white/30">
                  <Zap size={12} className="mr-1" /> Fast Track
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/10">
                  <AlertCircle size={12} className="mr-1" /> KYC Pending
                </Badge>
              )}
            </div>
            <p className={`text-sm ${kycVerified ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {kycVerified
                ? "Estimate your repayments and apply when ready"
                : "Your identity documents must be verified before you can apply"}
            </p>
            {hasActiveLoan && (
              <p className="text-xs mt-1 text-primary-foreground/90">
                Existing active loan detected. Your new application will still go through policy review.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {kycVerified ? (
              <Button
                variant="secondary"
                onClick={handleApply}
                className="bg-white/20 border-white/30 text-white hover:bg-white/30"
              >
                <FileText size={18} className="mr-2" /> {hasActiveLoan ? "Apply Again" : "Apply Now"}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/dashboard?tab=profile&kyc=documents")}>
                <Upload size={18} className="mr-2" /> Upload Documents
              </Button>
            )}
          </div>
        </div>
      </div>

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
                <span className="text-xl font-bold text-foreground">
                  {loanTerm} {(selectedProduct.term_unit || "months").replace(/s?$/, loanTerm > 1 ? "s" : "")}
                </span>
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
                      ? loanCalc.dailyPayment ?? loanCalc.monthlyPayment
                      : loanCalc.paymentFrequency === "weekly"
                      ? loanCalc.weeklyPayment ?? loanCalc.monthlyPayment
                      : loanCalc.monthlyPayment,
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
            </div>
          )}

          {kycVerified && (
            <Button variant="hero" className="w-full" onClick={handleApply}>
              <Zap size={16} className="mr-2" /> Apply for This Loan
            </Button>
          )}
      </CardContent>
    </Card>
  );
};

export default QuickApply;
