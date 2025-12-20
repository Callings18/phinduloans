import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const LoanCalculator = () => {
  const [loanAmount, setLoanAmount] = useState(5000);
  const [loanTerm, setLoanTerm] = useState(6);
  const interestRate = 0.15; // 15% monthly interest rate

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

        <div className="max-w-4xl mx-auto">
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
                    min={500}
                    max={50000}
                    step={500}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                    <span>K500</span>
                    <span>K50,000</span>
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
                    min={1}
                    max={24}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                    <span>1 month</span>
                    <span>24 months</span>
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

                <Button variant="hero" size="lg" className="w-full" asChild>
                  <Link to="/apply">
                    Apply for K{loanAmount.toLocaleString()}
                    <ArrowRight size={20} />
                  </Link>
                </Button>

                <p className="text-muted-foreground text-xs text-center">
                  *Representative example: 15% flat rate. Terms and conditions apply.
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
