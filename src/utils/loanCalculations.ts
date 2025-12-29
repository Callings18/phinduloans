/**
 * Unified Loan Calculation Utilities
 * Handles interest period normalization, flat vs reducing balance,
 * and penalty calculations across the entire application.
 */

export type InterestPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type InterestType = 'flat' | 'reducing';
export type PenaltyFrequency = 'daily' | 'weekly' | 'monthly' | 'one_time';

export interface LoanProduct {
  interest_rate: number;
  interest_period?: InterestPeriod | null;
  interest_type?: InterestType | null;
  processing_fee_percent?: number | null;
  insurance_percent?: number | null;
  vat_percent?: number | null;
  platform_fee_percent?: number | null;
  late_payment_penalty_percent?: number | null;
  penalty_frequency?: PenaltyFrequency | null;
  grace_period_days?: number | null;
  early_repayment_fee_percent?: number | null;
}

export interface LoanCalculationResult {
  principal: number;
  monthlyInterestRate: number;
  totalInterest: number;
  processingFee: number;
  insuranceFee: number;
  vatAmount: number;
  platformFee: number;
  totalFees: number;
  totalRepayment: number;
  monthlyPayment: number;
  effectiveAnnualRate: number;
}

export interface RepaymentScheduleItem {
  installmentNumber: number;
  dueDate: Date;
  principal: number;
  interest: number;
  totalPayment: number;
  remainingBalance: number;
}

/**
 * Normalizes any interest rate to a MONTHLY rate
 * @param rate - The stated interest rate as a percentage (e.g., 15 for 15%)
 * @param period - The period the rate applies to
 * @returns Monthly interest rate as a percentage
 */
export function normalizeToMonthlyRate(rate: number, period: InterestPeriod = 'monthly'): number {
  switch (period) {
    case 'daily':
      // Daily rate × 30 days = monthly rate
      return rate * 30;
    case 'weekly':
      // Weekly rate × ~4.33 weeks = monthly rate
      return rate * 4.33;
    case 'monthly':
      return rate;
    case 'yearly':
      // Yearly rate ÷ 12 = monthly rate
      return rate / 12;
    default:
      return rate; // Default to monthly
  }
}

/**
 * Converts monthly rate to annual effective rate
 */
export function monthlyToAnnualRate(monthlyRate: number): number {
  // (1 + monthly_rate)^12 - 1
  return (Math.pow(1 + monthlyRate / 100, 12) - 1) * 100;
}

/**
 * Calculate flat interest loan
 * Interest = Principal × Rate × Term
 */
export function calculateFlatInterest(
  principal: number,
  monthlyRate: number,
  termMonths: number
): number {
  return principal * (monthlyRate / 100) * termMonths;
}

/**
 * Calculate reducing balance interest
 * Uses amortization formula for equal monthly payments
 */
export function calculateReducingBalancePayment(
  principal: number,
  monthlyRate: number,
  termMonths: number
): number {
  const r = monthlyRate / 100;
  if (r === 0) return principal / termMonths;
  
  // PMT = P × [r(1+r)^n] / [(1+r)^n – 1]
  const payment = principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
  return payment;
}

/**
 * Calculate total interest for reducing balance
 */
export function calculateReducingBalanceInterest(
  principal: number,
  monthlyRate: number,
  termMonths: number
): number {
  const monthlyPayment = calculateReducingBalancePayment(principal, monthlyRate, termMonths);
  return (monthlyPayment * termMonths) - principal;
}

/**
 * Main loan calculation function
 * Handles all interest periods and types with fees
 */
export function calculateLoan(
  principal: number,
  termMonths: number,
  product: LoanProduct
): LoanCalculationResult {
  // Normalize interest rate to monthly
  const monthlyRate = normalizeToMonthlyRate(
    product.interest_rate,
    (product.interest_period as InterestPeriod) || 'monthly'
  );
  
  const interestType = (product.interest_type as InterestType) || 'flat';
  
  // Calculate interest based on type
  let totalInterest: number;
  let monthlyPayment: number;
  
  if (interestType === 'reducing') {
    monthlyPayment = calculateReducingBalancePayment(principal, monthlyRate, termMonths);
    totalInterest = calculateReducingBalanceInterest(principal, monthlyRate, termMonths);
  } else {
    // Flat interest
    totalInterest = calculateFlatInterest(principal, monthlyRate, termMonths);
    monthlyPayment = (principal + totalInterest) / termMonths;
  }
  
  // Calculate fees
  const processingFee = principal * ((product.processing_fee_percent || 0) / 100);
  const insuranceFee = principal * ((product.insurance_percent || 0) / 100);
  const platformFee = principal * ((product.platform_fee_percent || 0) / 100);
  
  // VAT on fees (not on principal or interest typically)
  const vatableAmount = processingFee + platformFee;
  const vatAmount = vatableAmount * ((product.vat_percent || 0) / 100);
  
  const totalFees = processingFee + insuranceFee + platformFee + vatAmount;
  const totalRepayment = principal + totalInterest + totalFees;
  
  // Recalculate monthly payment to include fees spread across term
  const adjustedMonthlyPayment = totalRepayment / termMonths;
  
  return {
    principal,
    monthlyInterestRate: monthlyRate,
    totalInterest: Math.round(totalInterest * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    insuranceFee: Math.round(insuranceFee * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    totalRepayment: Math.round(totalRepayment * 100) / 100,
    monthlyPayment: Math.round(adjustedMonthlyPayment * 100) / 100,
    effectiveAnnualRate: Math.round(monthlyToAnnualRate(monthlyRate) * 100) / 100,
  };
}

/**
 * Generate amortization schedule
 */
export function generateRepaymentSchedule(
  principal: number,
  termMonths: number,
  product: LoanProduct,
  startDate: Date
): RepaymentScheduleItem[] {
  const monthlyRate = normalizeToMonthlyRate(
    product.interest_rate,
    (product.interest_period as InterestPeriod) || 'monthly'
  );
  
  const interestType = (product.interest_type as InterestType) || 'flat';
  const loanCalc = calculateLoan(principal, termMonths, product);
  
  const schedule: RepaymentScheduleItem[] = [];
  let remainingBalance = principal;
  
  for (let i = 1; i <= termMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let interestPayment: number;
    let principalPayment: number;
    
    if (interestType === 'reducing') {
      // Interest on remaining balance
      interestPayment = remainingBalance * (monthlyRate / 100);
      principalPayment = loanCalc.monthlyPayment - interestPayment - (loanCalc.totalFees / termMonths);
    } else {
      // Flat: equal interest each month
      interestPayment = loanCalc.totalInterest / termMonths;
      principalPayment = principal / termMonths;
    }
    
    remainingBalance = Math.max(0, remainingBalance - principalPayment);
    
    schedule.push({
      installmentNumber: i,
      dueDate,
      principal: Math.round(principalPayment * 100) / 100,
      interest: Math.round(interestPayment * 100) / 100,
      totalPayment: Math.round(loanCalc.monthlyPayment * 100) / 100,
      remainingBalance: Math.round(remainingBalance * 100) / 100,
    });
  }
  
  return schedule;
}

/**
 * Calculate penalty for overdue payment
 */
export function calculatePenalty(
  overdueAmount: number,
  daysOverdue: number,
  product: LoanProduct
): number {
  const penaltyRate = product.late_payment_penalty_percent || 0;
  const frequency = (product.penalty_frequency as PenaltyFrequency) || 'monthly';
  const gracePeriod = product.grace_period_days || 0;
  
  // No penalty within grace period
  if (daysOverdue <= gracePeriod) return 0;
  
  const effectiveDaysOverdue = daysOverdue - gracePeriod;
  
  switch (frequency) {
    case 'daily':
      return overdueAmount * (penaltyRate / 100) * effectiveDaysOverdue;
    case 'weekly':
      const weeksOverdue = Math.ceil(effectiveDaysOverdue / 7);
      return overdueAmount * (penaltyRate / 100) * weeksOverdue;
    case 'monthly':
      const monthsOverdue = Math.ceil(effectiveDaysOverdue / 30);
      return overdueAmount * (penaltyRate / 100) * monthsOverdue;
    case 'one_time':
    default:
      return overdueAmount * (penaltyRate / 100);
  }
}

/**
 * Calculate early settlement amount
 */
export function calculateEarlySettlement(
  outstandingPrincipal: number,
  outstandingInterest: number,
  totalPenalties: number,
  product: LoanProduct
): {
  earlySettlementFee: number;
  totalPayoff: number;
} {
  const earlyFeeRate = product.early_repayment_fee_percent || 0;
  const earlySettlementFee = outstandingPrincipal * (earlyFeeRate / 100);
  const totalPayoff = outstandingPrincipal + outstandingInterest + totalPenalties + earlySettlementFee;
  
  return {
    earlySettlementFee: Math.round(earlySettlementFee * 100) / 100,
    totalPayoff: Math.round(totalPayoff * 100) / 100,
  };
}

/**
 * Format currency for display (Zambian Kwacha)
 */
export function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get interest period display text
 */
export function getInterestPeriodLabel(period: InterestPeriod | null | undefined): string {
  switch (period) {
    case 'daily': return 'per day';
    case 'weekly': return 'per week';
    case 'yearly': return 'per year';
    case 'monthly':
    default: return 'per month';
  }
}
