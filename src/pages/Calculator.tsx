import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";

const Calculator = () => {
  const [loanAmount, setLoanAmount] = useState(10000);
  const [loanTerm, setLoanTerm] = useState(12);
  const interestRate = 0.15;

  const monthlyPayment = (loanAmount * (1 + interestRate * loanTerm)) / loanTerm;
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
                <h2 className="text-xl font-semibold text-foreground mb-8">Adjust Your Loan</h2>
                
                <div className="space-y-10">
                  <div>
                    <div className="flex justify-between mb-4">
                      <label className="text-foreground font-medium">Loan Amount</label>
                      <span className="text-primary font-bold text-2xl">K{loanAmount.toLocaleString()}</span>
                    </div>
                    <Slider
                      value={[loanAmount]}
                      onValueChange={(value) => setLoanAmount(value[0])}
                      min={500}
                      max={50000}
                      step={500}
                    />
                    <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                      <span>K500</span>
                      <span>K50,000</span>
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
                      min={1}
                      max={24}
                      step={1}
                    />
                    <div className="flex justify-between mt-2 text-muted-foreground text-sm">
                      <span>1 month</span>
                      <span>24 months</span>
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className="mt-10 space-y-4">
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
                          <td className="py-3 px-2 text-right text-foreground">K{row.payment.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right text-muted-foreground">K{row.balance.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
                  <Info className="text-primary mt-0.5" size={20} />
                  <p className="text-muted-foreground text-sm">
                    This is a representative example. Actual rates may vary based on your credit profile and employment status. 
                    Interest rate: 15% flat rate per month.
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
