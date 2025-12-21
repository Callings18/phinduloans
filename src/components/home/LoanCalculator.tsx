import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Link } from "react-router-dom";
import { ArrowRight, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
}

const LoanCalculator = () => {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [loanAmount, setLoanAmount] = useState(5000);
  const [loanTerm, setLoanTerm] = useState(6);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("loan_products")
        .select("*")
        .eq("is_active", true)
        .order("min_amount", { ascending: true });
      
      if (data && data.length > 0) {
        setProducts(data);
        setSelectedProduct(data[0]);
        setLoanAmount(data[0].min_amount);
        setLoanTerm(data[0].min_term_months);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      // Clamp values to product limits
      if (loanAmount < selectedProduct.min_amount) setLoanAmount(selectedProduct.min_amount);
      if (loanAmount > selectedProduct.max_amount) setLoanAmount(selectedProduct.max_amount);
      if (loanTerm < selectedProduct.min_term_months) setLoanTerm(selectedProduct.min_term_months);
      if (loanTerm > selectedProduct.max_term_months) setLoanTerm(selectedProduct.max_term_months);
    }
  }, [selectedProduct]);

  const interestRate = selectedProduct ? selectedProduct.interest_rate / 100 : 0.15;
  const processingFee = selectedProduct?.processing_fee_percent ? (loanAmount * selectedProduct.processing_fee_percent / 100) : 0;
  const monthlyPayment = (loanAmount * (1 + interestRate * loanTerm)) / loanTerm;
  const totalPayment = monthlyPayment * loanTerm;
  const totalInterest = totalPayment - loanAmount;

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
            See exactly what you'll pay before you apply. Transparent pricing with no hidden fees.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Product Selector */}
          {products.length > 0 && (
            <div className="mb-8">
              <p className="text-center text-sm text-muted-foreground mb-4">Select a loan type</p>
              <div className="flex flex-wrap justify-center gap-3">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={cn(
                      "px-6 py-3 rounded-xl border transition-all duration-200 flex items-center gap-2",
                      selectedProduct?.id === product.id
                        ? "gradient-primary text-primary-foreground border-transparent shadow-button"
                        : "bg-secondary/50 border-border text-foreground hover:border-primary/50"
                    )}
                  >
                    <Package size={18} />
                    {product.name}
                  </button>
                ))}
              </div>
              {selectedProduct?.description && (
                <p className="text-center text-sm text-muted-foreground mt-3">
                  {selectedProduct.description}
                </p>
              )}
            </div>
          )}

          <div className="glass rounded-3xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Inputs */}
              <div className="space-y-10">
                <div>
                  <div className="flex justify-between mb-4">
                    <label className="text-foreground font-medium">Loan Amount</label>
                    <span className="text-primary font-bold text-xl">K{loanAmount.toLocaleString()}</span>
                  </div>
                  <Slider
                    value={[loanAmount]}
                    onValueChange={(value) => setLoanAmount(value[0])}
                    min={selectedProduct?.min_amount || 500}
                    max={selectedProduct?.max_amount || 50000}
                    step={100}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                    <span>K{(selectedProduct?.min_amount || 500).toLocaleString()}</span>
                    <span>K{(selectedProduct?.max_amount || 50000).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-4">
                    <label className="text-foreground font-medium">Loan Term</label>
                    <span className="text-primary font-bold text-xl">{loanTerm} months</span>
                  </div>
                  <Slider
                    value={[loanTerm]}
                    onValueChange={(value) => setLoanTerm(value[0])}
                    min={selectedProduct?.min_term_months || 1}
                    max={selectedProduct?.max_term_months || 24}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                    <span>{selectedProduct?.min_term_months || 1} month</span>
                    <span>{selectedProduct?.max_term_months || 24} months</span>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
                  <p className="text-muted-foreground text-sm mb-1">Monthly Payment</p>
                  <p className="text-4xl font-bold text-gradient">
                    K{monthlyPayment.toFixed(2)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                    <p className="text-muted-foreground text-xs mb-1">Total Interest</p>
                    <p className="text-xl font-semibold text-foreground">
                      K{totalInterest.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                    <p className="text-muted-foreground text-xs mb-1">Total Repayment</p>
                    <p className="text-xl font-semibold text-foreground">
                      K{totalPayment.toFixed(2)}
                    </p>
                  </div>
                </div>

                {processingFee > 0 && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">
                      Processing fee: K{processingFee.toFixed(2)} ({selectedProduct?.processing_fee_percent}%)
                    </p>
                  </div>
                )}

                <Button variant="hero" size="lg" className="w-full" asChild>
                  <Link to={`/apply${selectedProduct ? `?product=${selectedProduct.id}` : ''}`}>
                    Apply for K{loanAmount.toLocaleString()}
                    <ArrowRight size={20} />
                  </Link>
                </Button>

                <p className="text-muted-foreground text-xs text-center">
                  *{selectedProduct?.interest_rate || 15}% flat rate. Terms and conditions apply.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoanCalculator;