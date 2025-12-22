import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, Wallet, User, Check, Percent, Calendar, BadgeDollarSign } from "lucide-react";
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
  requirements: string[] | null;
}

const getProductIcon = (name: string) => {
  if (name.toLowerCase().includes('business')) return Briefcase;
  if (name.toLowerCase().includes('salary')) return Wallet;
  return User;
};

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
        .order("interest_rate", { ascending: true });
      
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
            Choose Your <span className="text-gradient">Loan Product</span>
          </h2>
          <p className="text-muted-foreground">
            Select a loan type that suits your needs, then calculate your repayment.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Loan Products Cards */}
          {products.length > 0 && (
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {products.map((product) => {
                const IconComponent = getProductIcon(product.name);
                const isSelected = selectedProduct?.id === product.id;
                
                return (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={cn(
                      "p-6 rounded-2xl border text-left transition-all duration-300 group relative overflow-hidden",
                      isSelected
                        ? "bg-primary/10 border-primary shadow-lg ring-2 ring-primary/20"
                        : "glass border-border hover:border-primary/50 hover:shadow-md"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full gradient-primary flex items-center justify-center">
                        <Check size={14} className="text-primary-foreground" />
                      </div>
                    )}
                    
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
                      isSelected ? "gradient-primary" : "bg-secondary"
                    )}>
                      <IconComponent size={24} className={isSelected ? "text-primary-foreground" : "text-primary"} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-foreground mb-2">{product.name}</h3>
                    
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Percent size={14} className="text-primary" />
                        <span className="text-foreground font-semibold">{product.interest_rate}%</span>
                        <span className="text-muted-foreground">interest rate</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <BadgeDollarSign size={14} className="text-primary" />
                        <span className="text-muted-foreground">
                          K{product.min_amount.toLocaleString()} - K{product.max_amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar size={14} className="text-primary" />
                        <span className="text-muted-foreground">
                          {product.min_term_months === product.max_term_months 
                            ? `${product.max_term_months} month${product.max_term_months > 1 ? 's' : ''}` 
                            : `${product.min_term_months} - ${product.max_term_months} months`}
                        </span>
                      </div>
                    </div>
                    
                    {product.requirements && product.requirements.length > 0 && (
                      <div className="pt-4 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Requirements:</p>
                        <div className="flex flex-wrap gap-1">
                          {product.requirements.slice(0, 3).map((req, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                              {req}
                            </span>
                          ))}
                          {product.requirements.length > 3 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                              +{product.requirements.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Calculator */}
          <div className="glass rounded-3xl p-8 md:p-12">
            {selectedProduct && (
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  Calculating for: {selectedProduct.name}
                </span>
              </div>
            )}
            
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
                    <span className="text-primary font-bold text-xl">{loanTerm} month{loanTerm > 1 ? 's' : ''}</span>
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

                {/* Selected Product Requirements */}
                {selectedProduct?.requirements && selectedProduct.requirements.length > 0 && (
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                    <p className="text-sm font-medium text-foreground mb-3">Documents Required:</p>
                    <ul className="space-y-2">
                      {selectedProduct.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check size={14} className="text-primary flex-shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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

                <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Interest Rate</span>
                    <span className="text-foreground font-medium">{selectedProduct?.interest_rate || 15}%</span>
                  </div>
                  {processingFee > 0 && (
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Processing Fee ({selectedProduct?.processing_fee_percent}%)</span>
                      <span className="text-foreground font-medium">K{processingFee.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <Button variant="hero" size="lg" className="w-full" asChild>
                  <Link to={`/apply${selectedProduct ? `?product=${selectedProduct.id}` : ''}`}>
                    Apply for {selectedProduct?.name || 'Loan'}
                    <ArrowRight size={20} />
                  </Link>
                </Button>

                <p className="text-muted-foreground text-xs text-center">
                  *Flat rate. Terms and conditions apply.
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
