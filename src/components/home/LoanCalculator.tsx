import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { calculateLoan, LoanProduct as LoanProductCalc } from "@/utils/loanCalculations";
import { format, addMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";

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
  requirements: string[] | null;
  guarantee_required: boolean | null;
  guarantee_fee_percent: number | null;
  eligible_locations: string[] | null;
  grace_period_days: number | null;
}

const LoanCalculator = () => {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState<string>("5000");
  const [loanTerm, setLoanTerm] = useState<string>("3");
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["loan-products-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as LoanProduct[];
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 30000, // Refetch every 30 seconds to catch updates
  });

  // Real-time subscription to loan products changes
  useEffect(() => {
    const channel = supabase
      .channel("loan-products-public-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loan_products",
        },
        () => {
          // Invalidate and refetch when any loan product changes
          queryClient.invalidateQueries({ queryKey: ["loan-products-public"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Set default product when products load
  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      const defaultProduct = products[0];
      setSelectedProductId(defaultProduct.id);
      setLoanAmount(defaultProduct.min_amount.toString());
      setLoanTerm(defaultProduct.min_term_months.toString());
    }
  }, [products, selectedProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Clamp values when product changes
  useEffect(() => {
    if (selectedProduct) {
      const amount = parseInt(loanAmount) || 0;
      const term = parseInt(loanTerm) || 0;

      if (amount < selectedProduct.min_amount) {
        setLoanAmount(selectedProduct.min_amount.toString());
      } else if (amount > selectedProduct.max_amount) {
        setLoanAmount(selectedProduct.max_amount.toString());
      }

      if (term < selectedProduct.min_term_months) {
        setLoanTerm(selectedProduct.min_term_months.toString());
      } else if (term > selectedProduct.max_term_months) {
        setLoanTerm(selectedProduct.max_term_months.toString());
      }
    }
  }, [selectedProduct]);

  // Calculate loan details
  const amount = parseInt(loanAmount) || 0;
  const term = parseInt(loanTerm) || 1;

  const productForCalc: LoanProductCalc = selectedProduct
    ? {
        product_name: selectedProduct.name,
        interest_rate: selectedProduct.interest_rate,
        interest_period: selectedProduct.interest_period as any,
        interest_type: selectedProduct.interest_type as any,
        processing_fee_percent: selectedProduct.processing_fee_percent,
        enforcement_fee_percent: selectedProduct.enforcement_fee_percent,
        insurance_percent: selectedProduct.insurance_percent,
        vat_percent: selectedProduct.vat_percent,
        platform_fee_percent: selectedProduct.platform_fee_percent,
      }
    : { interest_rate: 15 };

  const calculation = calculateLoan(amount, term, productForCalc);

  // Check if product is available nationwide or restricted
  const isNationwide = !selectedProduct?.eligible_locations || selectedProduct.eligible_locations.length === 0;
  const locationLabel = isNationwide 
    ? "Nationwide" 
    : selectedProduct?.eligible_locations?.join(", ") || "Nationwide";

  // Calculate next payment date (1 month from today)
  const nextPaymentDate = addMonths(new Date(), 1);

  return (
    <section className="py-24 gradient-hero relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Calculate Your <span className="text-gradient">Loan</span>
          </h2>
          <p className="text-muted-foreground">
            Get an instant estimate for your loan. Select a product and see exactly what you'll receive.
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          <div className="bg-card rounded-3xl p-8 shadow-xl border border-border">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Loan Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-foreground font-medium">
                    How much would you like?
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    min={selectedProduct?.min_amount || 500}
                    max={selectedProduct?.max_amount || 50000}
                    className="text-lg h-12"
                    placeholder="Enter amount"
                  />
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">
                      Min: K{selectedProduct.min_amount.toLocaleString()} - Max: K{selectedProduct.max_amount.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Loan Term */}
                <div className="space-y-2">
                  <Label htmlFor="term" className="text-foreground font-medium">
                    For how many months?
                  </Label>
                  <Input
                    id="term"
                    type="number"
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(e.target.value)}
                    min={selectedProduct?.min_term_months || 1}
                    max={selectedProduct?.max_term_months || 24}
                    className="text-lg h-12"
                    placeholder="Enter months"
                  />
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">
                      {selectedProduct.min_term_months} - {selectedProduct.max_term_months} months
                    </p>
                  )}
                </div>

                {/* Loan Product Selection */}
                <div className="space-y-2">
                  <Label htmlFor="product" className="text-foreground font-medium">
                    What type of loan would you like?
                  </Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue placeholder="Select a loan product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Location availability */}
                  {selectedProduct && (
                    <div className="flex items-center gap-2 mt-2">
                      <MapPin size={14} className={isNationwide ? "text-success" : "text-warning"} />
                      <span className="text-xs text-muted-foreground">
                        Available: <span className={isNationwide ? "text-success font-medium" : "text-warning font-medium"}>
                          {locationLabel}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Upfront Fees Breakdown */}
                <div className="bg-secondary/50 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-foreground text-lg">Upfront Fees (Deducted)</h3>
                  
                  <div className="space-y-3">
                    {/* Processing Fee */}
                    {calculation.processingFee > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Processing Fee ({selectedProduct?.processing_fee_percent || 0}%)</span>
                        <span className="font-semibold text-primary">
                          K{calculation.processingFee.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* Enforcement/Legal Fee */}
                    {calculation.enforcementFee > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Legal/Enforcement Fee ({selectedProduct?.enforcement_fee_percent || 0}%)</span>
                        <span className="font-semibold text-primary">
                          K{calculation.enforcementFee.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* Insurance Premium */}
                    {calculation.insuranceFee > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Insurance Premium ({selectedProduct?.insurance_percent || 0}%)</span>
                        <span className="font-semibold text-primary">
                          K{calculation.insuranceFee.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* Platform Fee */}
                    {calculation.platformFee > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Platform Fee ({selectedProduct?.platform_fee_percent || 0}%)</span>
                        <span className="font-semibold text-primary">
                          K{calculation.platformFee.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* VAT on Fees */}
                    {calculation.vatAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">VAT on Fees ({selectedProduct?.vat_percent || 0}%)</span>
                        <span className="font-semibold text-primary">
                          K{calculation.vatAmount.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* Total Deductions */}
                    <div className="flex justify-between items-center pt-2 border-t border-border/50">
                      <span className="text-muted-foreground font-medium">Total Deductions</span>
                      <span className="font-semibold text-primary">
                        K{calculation.feesDeductedUpfront.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Amount You Receive */}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Amount You Receive</span>
                      <span className="font-bold text-success">
                        K{calculation.disbursementAmount.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Monthly Repayment */}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Monthly Repayment</span>
                      <span className="font-semibold text-primary">
                        K{calculation.monthlyPayment.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Next Payment Date */}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Next Payment Date</span>
                      <span className="font-semibold text-primary">
                        {format(nextPaymentDate, "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Apply Button */}
                <Button variant="hero" size="lg" className="w-full" asChild>
                  <Link to={`/auth?mode=signup&redirect=dashboard&apply=true${selectedProduct ? `&product=${selectedProduct.id}` : ''}`}>
                    Get Started
                    <ArrowRight size={20} />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoanCalculator;