import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Info, Package, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const Calculator = () => {
  const [loanAmount, setLoanAmount] = useState(5000);
  const [loanTerm, setLoanTerm] = useState(6);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['active-loan-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_products')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const selectedProduct = products?.find(p => p.id === selectedProductId) || products?.[0];
  const interestRate = (selectedProduct?.interest_rate || 15) / 100;

  // Monthly payment calculation (Flat rate typical for many Zambian micro-lenders)
  const monthlyPayment = (loanAmount * (1 + interestRate * (loanTerm / 12))) / loanTerm;
  const totalPayment = monthlyPayment * loanTerm;
  const totalInterest = totalPayment - loanAmount;

  const generateSchedule = () => {
    const schedule = [];
    let balance = totalPayment;

    for (let month = 1; month <= loanTerm; month++) {
      balance -= monthlyPayment;
      schedule.push({
        month,
        payment: monthlyPayment,
        balance: Math.max(0, balance),
      });
    }
    return schedule;
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
                  <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
                    <p className="text-muted-foreground text-sm mb-1">Monthly Payment</p>
                    <p className="text-4xl font-bold text-gradient">
                      K{monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                      <p className="text-muted-foreground text-xs mb-1">Total Interest</p>
                      <p className="text-xl font-semibold text-foreground">
                        K{totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                      <p className="text-muted-foreground text-xs mb-1">Total Repayment</p>
                      <p className="text-xl font-semibold text-foreground">
                        K{totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <h2 className="text-xl font-semibold text-foreground mb-6">Repayment Schedule</h2>

                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-muted-foreground text-sm font-medium">Month</th>
                        <th className="text-right py-3 px-2 text-muted-foreground text-sm font-medium">Payment</th>
                        <th className="text-right py-3 px-2 text-muted-foreground text-sm font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generateSchedule().map((row) => (
                        <tr key={row.month} className="border-b border-border/50">
                          <td className="py-3 px-2 text-foreground">{row.month}</td>
                          <td className="py-3 px-2 text-right text-foreground">K{row.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-3 px-2 text-right text-muted-foreground">K{row.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
                  <Info className="text-primary mt-0.5" size={20} />
                  <p className="text-muted-foreground text-sm">
                    This is a representative example for <strong>{selectedProduct?.name || 'Standard Loan'}</strong>. Actual rates may vary based on your credit profile and employment status.
                    Interest rate: {selectedProduct?.interest_rate || 15}% flat rate per annum (calculated monthly).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Calculator;
