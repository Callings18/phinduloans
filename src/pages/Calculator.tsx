import * as React from "react";
import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Info, Package, Loader2, Scale } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { calculateLoan, generateRepaymentSchedule, LoanProduct as LoanProductCalc, getInterestPeriodLabel } from "@/utils/loanCalculations";
import LoanComparison from "@/components/common/LoanComparison";

const Calculator = () => {
  const [loanAmount, setLoanAmount] = useState(5000);
  const [loanTerm, setLoanTerm] = useState(6);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['active-loan-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_products')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 30000, // Refetch every 30 seconds to catch updates
  });

  const selectedProduct = products?.find(p => p.id === selectedProductId) || products?.[0];

  useEffect(() => {
    const channel = supabase
      .channel("loan-products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_products" }, () => {
        queryClient.invalidateQueries({ queryKey: ["active-loan-products"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Build product config for calculations (only upfront fees, no potential charges)
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
      grace_period_days: selectedProduct.grace_period_days,
    }
    : { interest_rate: 15, interest_period: 'monthly', interest_type: 'flat' };

  // Use the unified calculation utility
  const calculation = calculateLoan(loanAmount, loanTerm, productForCalc);
  const monthlyPayment = calculation.monthlyPayment;
  const totalPayment = calculation.totalRepayment;
  const totalInterest = calculation.totalInterest;

  const generateSchedule = () => {
    const schedule = generateRepaymentSchedule(loanAmount, loanTerm, productForCalc, new Date());
    return schedule.map((item) => ({
      month: item.installmentNumber,
      payment: item.totalPayment,
      balance: item.remainingBalance,
      principal: item.principal,
      interest: item.interest,
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Loan <span className="text-gradient">Calculator</span>
            </h1>
            <p className="text-muted-foreground">
              Calculate your monthly payments and see a detailed repayment schedule before you apply.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Calculator */}
              <div className="glass rounded-3xl p-8">
                <h2 className="text-xl font-semibold text-foreground mb-8">Loan Setup</h2>

                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                ) : (
                  <div className="space-y-10">
                    <div className="space-y-3">
                      <label className="text-foreground font-medium">Select Loan Type</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {products?.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => {
                              setSelectedProductId(product.id);
                              setLoanAmount(product.min_amount);
                              setLoanTerm(product.min_term_months);
                            }}
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
                            <p className="text-xs text-primary">{product.interest_rate}% interest</p>
                            {/* Location availability */}
                            <div className="flex items-center gap-1 mt-1">
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded",
                                !product.eligible_locations || product.eligible_locations.length === 0
                                  ? "bg-success/10 text-success"
                                  : "bg-warning/10 text-warning"
                              )}>
                                {!product.eligible_locations || product.eligible_locations.length === 0
                                  ? "Nationwide"
                                  : product.eligible_locations.slice(0, 2).join(", ") + (product.eligible_locations.length > 2 ? "..." : "")}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-4">
                        <label className="text-foreground font-medium">Loan Amount</label>
                        <span className="text-primary font-bold text-2xl">K{loanAmount.toLocaleString()}</span>
                      </div>
                      <Slider
                        value={[loanAmount]}
                        onValueChange={(value) => setLoanAmount(value[0])}
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
                        <label className="text-foreground font-medium">Loan Term</label>
                        <span className="text-primary font-bold text-2xl">{loanTerm} months</span>
                      </div>
                      <Slider
                        value={[loanTerm]}
                        onValueChange={(value) => setLoanTerm(value[0])}
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
                )}

                {/* Results */}
                <div className="mt-10 space-y-4">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
                    <p className="text-muted-foreground text-sm mb-1">Monthly Payment</p>
                    <p className="text-4xl font-bold text-gradient">
                      K{monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Upfront Fees Breakdown */}
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                    <p className="text-sm font-semibold text-foreground mb-3">Upfront Fees (Deducted)</p>
                    <div className="space-y-2 text-sm">
                      {calculation.processingFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Processing Fee ({selectedProduct?.processing_fee_percent || 0}%)
                          </span>
                          <span className="font-semibold text-primary">
                            K{calculation.processingFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {calculation.enforcementFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Enforcement/Legal Fee ({selectedProduct?.enforcement_fee_percent || 0}%)
                          </span>
                          <span className="font-semibold text-primary">
                            K{calculation.enforcementFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {calculation.platformFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Platform Fee ({selectedProduct?.platform_fee_percent || 0}%)
                          </span>
                          <span className="font-semibold text-primary">
                            K{calculation.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {calculation.insuranceFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Insurance ({selectedProduct?.insurance_percent || 0}%)
                          </span>
                          <span className="font-semibold text-primary">
                            K{calculation.insuranceFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {calculation.vatAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">VAT ({selectedProduct?.vat_percent || 0}%)</span>
                          <span className="font-semibold text-primary">
                            K{calculation.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {/* Total Upfront Deductions */}
                      <div className="flex justify-between pt-2 border-t border-border/50">
                        <span className="text-muted-foreground font-medium">Total Deductions</span>
                        <span className="font-semibold text-primary">
                          K{calculation.feesDeductedUpfront.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Amount You Receive */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount You Receive</span>
                        <span className="font-bold text-success">
                          K{calculation.disbursementAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Loan Summary */}
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                    <p className="text-sm font-semibold text-foreground mb-3">Loan Summary</p>
                    <div className="space-y-2 text-sm">
                      {/* Monthly Repayment */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly Repayment</span>
                        <span className="font-semibold text-primary">
                          K{monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Total Repayment */}
                      <div className="flex justify-between pt-2 border-t border-border/50">
                        <span className="font-medium">Total Repayment</span>
                        <span className="font-bold text-primary">
                          K{totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-success/10 border border-success/30">
                      <p className="text-muted-foreground text-xs mb-1">Monthly Payment</p>
                      <p className="text-lg font-semibold text-success">
                        K{monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-info/10 border border-info/30">
                      <p className="text-muted-foreground text-xs mb-1">Interest Rate</p>
                      <p className="text-lg font-semibold text-info">
                        {selectedProduct?.interest_rate || 15}% {selectedProduct?.interest_type || 'flat'}
                      </p>
                    </div>
                  </div>

                  <Button variant="hero" size="lg" className="w-full" asChild>
                    <Link to={selectedProduct ? `/apply?product=${selectedProduct.id}` : "/apply"}>
                      Apply for K{loanAmount.toLocaleString()}
                      <ArrowRight size={20} />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Repayment Schedule */}
              <div className="glass rounded-3xl p-8">
                <h2 className="text-xl font-semibold text-foreground mb-6">
                  Amortization Schedule
                </h2>

                <div className="overflow-auto max-h-[500px] scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-muted-foreground text-xs font-medium">#</th>
                        <th className="text-right py-3 px-2 text-muted-foreground text-xs font-medium">Principal</th>
                        <th className="text-right py-3 px-2 text-muted-foreground text-xs font-medium">Interest</th>
                        <th className="text-right py-3 px-2 text-muted-foreground text-xs font-medium">Payment</th>
                        <th className="text-right py-3 px-2 text-muted-foreground text-xs font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generateSchedule().map((row) => (
                        <tr key={row.month} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="py-3 px-2 text-foreground font-medium">{row.month}</td>
                          <td className="py-3 px-2 text-right text-success">
                            K{row.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-2 text-right text-warning">
                            K{row.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-2 text-right text-foreground font-semibold">
                            K{row.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-2 text-right text-muted-foreground">
                            K{row.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/30">
                      <p className="text-muted-foreground mb-1">Total Principal</p>
                      <p className="font-semibold text-success">K{loanAmount.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                      <p className="text-muted-foreground mb-1">Total Interest</p>
                      <p className="font-semibold text-warning">K{totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <p className="text-muted-foreground mb-1">Total Cost</p>
                      <p className="font-semibold text-primary">K{totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
                    <Info className="text-primary mt-0.5 flex-shrink-0" size={20} />
                    <div className="text-xs text-muted-foreground">
                      <p className="mb-2">
                        This is a representative example for <strong>{selectedProduct?.name || 'Standard Loan'}</strong>. Actual rates may vary based on your credit profile and employment status.
                      </p>
                      <p>
                        Interest: {selectedProduct?.interest_rate || 15}% {selectedProduct?.interest_type || 'flat'} {getInterestPeriodLabel(selectedProduct?.interest_period as any)}
                        {selectedProduct?.grace_period_days > 0 && ` • Grace period: ${selectedProduct.grace_period_days} days`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Loan Comparison Section */}
            <div className="mt-12">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
                  <Scale className="text-primary" size={24} />
                  Compare Products
                </h2>
                <p className="text-muted-foreground">
                  Not sure which loan is right for you? Compare products side-by-side.
                </p>
              </div>
              <LoanComparison />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Calculator;
