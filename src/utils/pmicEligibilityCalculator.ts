export interface PMICEligibilityInput {
  grossSalary: number;
  netSalary: number;
  existingDeductions: number;
  maxDeductionPercent: number;  // e.g., 33 means 33%
  minNetPayPercent: number;     // e.g., 50 means 50% of net must remain
  maxLoanMultiplier: number;    // e.g., 36 means max loan = 36x monthly deduction
  interestRate: number;         // Monthly interest rate as percentage
  defaultTermMonths: number;    // Default loan term
  maxConcurrentLoans: number;
  currentActiveLoans: number;
}

export interface PMICEligibilityResult {
  isEligible: boolean;
  maxDeductionAmount: number;
  availableDeductionCapacity: number;
  maxLoanAmount: number;
  recommendedLoanAmount: number;
  maxMonthlyPayment: number;
  minNetPayAfterDeduction: number;
  reasons: string[];
  warnings: string[];
  breakdown: {
    grossSalary: number;
    netSalary: number;
    existingDeductions: number;
    maxAllowedDeduction: number;
    remainingCapacity: number;
    netPayAfterAllDeductions: number;
    netPayPercentage: number;
  };
}

/**
 * Calculate loan eligibility based on PMIC enrollment data and configuration
 */
export function calculatePMICEligibility(input: PMICEligibilityInput): PMICEligibilityResult {
  const {
    grossSalary,
    netSalary,
    existingDeductions,
    maxDeductionPercent,
    minNetPayPercent,
    maxLoanMultiplier,
    interestRate,
    defaultTermMonths,
    maxConcurrentLoans,
    currentActiveLoans,
  } = input;

  const reasons: string[] = [];
  const warnings: string[] = [];
  let isEligible = true;

  // Calculate maximum allowed deduction based on gross salary
  const maxAllowedDeduction = (grossSalary * maxDeductionPercent) / 100;

  // Calculate remaining deduction capacity
  const remainingCapacity = Math.max(0, maxAllowedDeduction - existingDeductions);

  // Calculate net pay after all deductions (existing + new max deduction)
  const netPayAfterAllDeductions = netSalary - remainingCapacity;

  // Calculate minimum required net pay
  const minRequiredNetPay = (netSalary * minNetPayPercent) / 100;

  // Adjust available capacity based on min net pay requirement
  let availableDeductionCapacity = remainingCapacity;
  if (netPayAfterAllDeductions < minRequiredNetPay) {
    // Reduce capacity to ensure minimum net pay is maintained
    const maxDeductionForMinNetPay = netSalary - minRequiredNetPay;
    availableDeductionCapacity = Math.min(remainingCapacity, Math.max(0, maxDeductionForMinNetPay));
    warnings.push(`Deduction limited to maintain ${minNetPayPercent}% minimum net pay`);
  }

  // Calculate net pay percentage after deduction
  const netPayPercentage = netSalary > 0 
    ? ((netSalary - availableDeductionCapacity) / netSalary) * 100 
    : 0;

  // Check concurrent loan limit
  if (currentActiveLoans >= maxConcurrentLoans) {
    isEligible = false;
    reasons.push(`Maximum concurrent loans (${maxConcurrentLoans}) reached`);
  }

  // Check if there's any deduction capacity
  if (availableDeductionCapacity <= 0) {
    isEligible = false;
    reasons.push('No available deduction capacity');
  }

  // Calculate maximum loan amount based on multiplier
  const maxLoanFromMultiplier = availableDeductionCapacity * maxLoanMultiplier;

  // Calculate loan amount based on affordable monthly payment using flat interest
  // Total repayment = Principal + (Principal × Rate × Term)
  // Monthly payment = Total repayment / Term
  // If monthly payment = availableDeductionCapacity
  // Then: availableDeductionCapacity = (P + P × R × T) / T
  // availableDeductionCapacity × T = P × (1 + R × T)
  // P = (availableDeductionCapacity × T) / (1 + R × T)
  const monthlyRate = interestRate / 100;
  const totalRateFactor = 1 + (monthlyRate * defaultTermMonths);
  const maxLoanFromPayment = (availableDeductionCapacity * defaultTermMonths) / totalRateFactor;

  // Take the minimum of both calculations
  const maxLoanAmount = Math.min(maxLoanFromMultiplier, maxLoanFromPayment);

  // Calculate recommended loan (80% of max for safety margin)
  const recommendedLoanAmount = Math.floor(maxLoanAmount * 0.8 / 100) * 100;

  // Calculate what the monthly payment would be for max loan
  const maxMonthlyPayment = availableDeductionCapacity;

  // Minimum loan threshold
  const minLoanThreshold = 500;
  if (maxLoanAmount < minLoanThreshold && isEligible) {
    isEligible = false;
    reasons.push(`Maximum eligible amount (K${maxLoanAmount.toFixed(2)}) below minimum threshold (K${minLoanThreshold})`);
  }

  // Add eligibility notes
  if (isEligible && reasons.length === 0) {
    if (availableDeductionCapacity < remainingCapacity) {
      warnings.push('Capacity adjusted to protect minimum net pay');
    }
  }

  return {
    isEligible,
    maxDeductionAmount: maxAllowedDeduction,
    availableDeductionCapacity,
    maxLoanAmount: Math.max(0, Math.floor(maxLoanAmount)),
    recommendedLoanAmount: Math.max(0, recommendedLoanAmount),
    maxMonthlyPayment,
    minNetPayAfterDeduction: netSalary - availableDeductionCapacity,
    reasons,
    warnings,
    breakdown: {
      grossSalary,
      netSalary,
      existingDeductions,
      maxAllowedDeduction,
      remainingCapacity,
      netPayAfterAllDeductions: netSalary - availableDeductionCapacity,
      netPayPercentage,
    },
  };
}

/**
 * Calculate monthly payment for a given loan amount
 */
export function calculateMonthlyPayment(
  principal: number,
  monthlyInterestRate: number,
  termMonths: number
): number {
  // Flat interest calculation
  const totalInterest = principal * (monthlyInterestRate / 100) * termMonths;
  const totalRepayment = principal + totalInterest;
  return totalRepayment / termMonths;
}

/**
 * Calculate maximum loan for a given monthly payment budget
 */
export function calculateMaxLoanForPayment(
  maxMonthlyPayment: number,
  monthlyInterestRate: number,
  termMonths: number
): number {
  const monthlyRate = monthlyInterestRate / 100;
  const totalRateFactor = 1 + (monthlyRate * termMonths);
  return (maxMonthlyPayment * termMonths) / totalRateFactor;
}

/**
 * Format currency for display
 */
export function formatCurrencyZMW(amount: number): string {
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency: 'ZMW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('ZMW', 'K');
}
