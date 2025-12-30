import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePMIC } from "@/hooks/usePMIC";
import { 
  calculatePMICEligibility, 
  calculateMonthlyPayment,
  formatCurrencyZMW,
  PMICEligibilityResult 
} from "@/utils/pmicEligibilityCalculator";
import { 
  Calculator, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp,
  Wallet,
  CreditCard,
  PiggyBank,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PMICEligibilityCalculator = () => {
  const { config, enrollments, fetchConfig, fetchEnrollments } = usePMIC();
  
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>("");
  const [requestedAmount, setRequestedAmount] = useState<number>(0);
  const [requestedTerm, setRequestedTerm] = useState<number>(12);
  const [interestRate, setInterestRate] = useState<number>(15);
  const [activeLoansCount, setActiveLoansCount] = useState<number>(0);
  const [eligibility, setEligibility] = useState<PMICEligibilityResult | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchEnrollments();
  }, [fetchConfig, fetchEnrollments]);

  // Get active enrollments only
  const activeEnrollments = useMemo(() => 
    enrollments.filter(e => e.enrollment_status === 'active'),
    [enrollments]
  );

  // Selected enrollment
  const selectedEnrollment = useMemo(() => 
    activeEnrollments.find(e => e.id === selectedEnrollmentId),
    [activeEnrollments, selectedEnrollmentId]
  );

  // Fetch active loans count when enrollment changes
  useEffect(() => {
    const fetchActiveLoans = async () => {
      if (!selectedEnrollment) return;
      
      const { count } = await supabase
        .from('loan_applications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', selectedEnrollment.borrower_id)
        .in('status', ['active', 'disbursed']);
      
      setActiveLoansCount(count || 0);
    };
    
    fetchActiveLoans();
  }, [selectedEnrollment]);

  // Calculate eligibility when inputs change
  useEffect(() => {
    if (!selectedEnrollment || !config) {
      setEligibility(null);
      return;
    }

    const result = calculatePMICEligibility({
      grossSalary: selectedEnrollment.gross_salary || 0,
      netSalary: selectedEnrollment.net_salary || 0,
      existingDeductions: selectedEnrollment.existing_deductions || 0,
      maxDeductionPercent: config.max_deduction_percent,
      minNetPayPercent: config.min_net_pay_percent,
      maxLoanMultiplier: config.max_loan_multiplier,
      interestRate: interestRate,
      defaultTermMonths: requestedTerm || config.default_loan_term_months,
      maxConcurrentLoans: config.max_concurrent_loans,
      currentActiveLoans: activeLoansCount,
    });

    setEligibility(result);
    
    // Set default requested amount to recommended
    if (requestedAmount === 0 && result.recommendedLoanAmount > 0) {
      setRequestedAmount(result.recommendedLoanAmount);
    }
  }, [selectedEnrollment, config, interestRate, requestedTerm, activeLoansCount]);

  const monthlyPayment = useMemo(() => {
    if (requestedAmount <= 0 || requestedTerm <= 0) return 0;
    return calculateMonthlyPayment(requestedAmount, interestRate, requestedTerm);
  }, [requestedAmount, interestRate, requestedTerm]);

  const isRequestValid = useMemo(() => {
    if (!eligibility || !eligibility.isEligible) return false;
    if (requestedAmount > eligibility.maxLoanAmount) return false;
    if (monthlyPayment > eligibility.availableDeductionCapacity) return false;
    return true;
  }, [eligibility, requestedAmount, monthlyPayment]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Loan Eligibility Calculator</h3>
          <p className="text-sm text-muted-foreground">
            Calculate maximum loan based on PMIC enrollment and salary data
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Borrower Selection</CardTitle>
            <CardDescription>
              Select an enrolled borrower to calculate eligibility
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Enrolled Borrower</Label>
              <Select value={selectedEnrollmentId} onValueChange={setSelectedEnrollmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a borrower..." />
                </SelectTrigger>
                <SelectContent>
                  {activeEnrollments.map((enrollment) => (
                    <SelectItem key={enrollment.id} value={enrollment.id}>
                      <div className="flex items-center gap-2">
                        <span>{enrollment.borrower?.full_name || enrollment.employee_number}</span>
                        <span className="text-xs text-muted-foreground">
                          ({enrollment.employer?.employer_name || 'Unknown'})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEnrollment && (
              <>
                <Separator />
                
                {/* Salary Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground">Gross Salary</div>
                    <div className="text-lg font-semibold">
                      {formatCurrencyZMW(selectedEnrollment.gross_salary || 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground">Net Salary</div>
                    <div className="text-lg font-semibold">
                      {formatCurrencyZMW(selectedEnrollment.net_salary || 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground">Existing Deductions</div>
                    <div className="text-lg font-semibold text-amber-600">
                      {formatCurrencyZMW(selectedEnrollment.existing_deductions || 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground">Active Loans</div>
                    <div className="text-lg font-semibold">
                      {activeLoansCount} / {config?.max_concurrent_loans || 3}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Loan Parameters */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Interest Rate (% per month)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={interestRate}
                      onChange={(e) => setInterestRate(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Loan Term</Label>
                      <span className="text-sm font-medium">{requestedTerm} months</span>
                    </div>
                    <Slider
                      value={[requestedTerm]}
                      onValueChange={([value]) => setRequestedTerm(value)}
                      min={1}
                      max={36}
                      step={1}
                    />
                  </div>

                  {eligibility && eligibility.isEligible && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Requested Amount</Label>
                        <span className="text-sm font-medium">
                          {formatCurrencyZMW(requestedAmount)}
                        </span>
                      </div>
                      <Slider
                        value={[requestedAmount]}
                        onValueChange={([value]) => setRequestedAmount(value)}
                        min={500}
                        max={eligibility.maxLoanAmount}
                        step={100}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>K500</span>
                        <span>Max: {formatCurrencyZMW(eligibility.maxLoanAmount)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Eligibility Results
              {eligibility && (
                eligibility.isEligible ? (
                  <Badge className="bg-emerald-100 text-emerald-800">Eligible</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">Not Eligible</Badge>
                )
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedEnrollment ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a borrower to calculate eligibility</p>
              </div>
            ) : !eligibility ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Calculating...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Main Results */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <TrendingUp className="h-3 w-3" />
                      Max Loan Amount
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrencyZMW(eligibility.maxLoanAmount)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <PiggyBank className="h-3 w-3" />
                      Recommended
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {formatCurrencyZMW(eligibility.recommendedLoanAmount)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Wallet className="h-3 w-3" />
                      Available Capacity
                    </div>
                    <div className="text-xl font-semibold">
                      {formatCurrencyZMW(eligibility.availableDeductionCapacity)}/mo
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <CreditCard className="h-3 w-3" />
                      Net Pay After
                    </div>
                    <div className="text-xl font-semibold">
                      {formatCurrencyZMW(eligibility.minNetPayAfterDeduction)}
                    </div>
                  </div>
                </div>

                {/* Requested Loan Summary */}
                {eligibility.isEligible && requestedAmount > 0 && (
                  <>
                    <Separator />
                    <div className={`p-4 rounded-lg border ${isRequestValid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Requested Loan</span>
                        {isRequestValid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold">{formatCurrencyZMW(requestedAmount)}</div>
                          <div className="text-xs text-muted-foreground">Principal</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{requestedTerm} mo</div>
                          <div className="text-xs text-muted-foreground">Term</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${monthlyPayment > eligibility.availableDeductionCapacity ? 'text-red-600' : ''}`}>
                            {formatCurrencyZMW(monthlyPayment)}
                          </div>
                          <div className="text-xs text-muted-foreground">Monthly</div>
                        </div>
                      </div>
                      {monthlyPayment > eligibility.availableDeductionCapacity && (
                        <p className="text-xs text-red-600 mt-2">
                          Monthly payment exceeds available capacity
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Warnings */}
                {eligibility.warnings.length > 0 && (
                  <div className="space-y-2">
                    {eligibility.warnings.map((warning, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-amber-50 text-amber-800 text-sm">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reasons for ineligibility */}
                {!eligibility.isEligible && eligibility.reasons.length > 0 && (
                  <div className="space-y-2">
                    {eligibility.reasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-red-50 text-red-800 text-sm">
                        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Breakdown */}
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="h-4 w-4" />
                    Calculation Breakdown
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Deduction ({config?.max_deduction_percent}%)</span>
                      <span>{formatCurrencyZMW(eligibility.breakdown.maxAllowedDeduction)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Less: Existing</span>
                      <span className="text-red-600">-{formatCurrencyZMW(eligibility.breakdown.existingDeductions)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Remaining Capacity</span>
                      <span>{formatCurrencyZMW(eligibility.breakdown.remainingCapacity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Pay Retained</span>
                      <span>{eligibility.breakdown.netPayPercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PMICEligibilityCalculator;
