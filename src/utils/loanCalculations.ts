/**
 * Unified Loan Calculation Utilities
 * Handles interest period normalization, flat vs reducing balance,
 * and penalty calculations across the entire application.
 */

import { calculateMarketeerLoan, parseMarketeerTiers } from "@/lib/marketeerCalculations";

export type InterestPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type InterestType = 'flat' | 'reducing';
export type PenaltyFrequency = 'daily' | 'weekly' | 'monthly' | 'one_time';
export type TermUnit = 'days' | 'weeks' | 'months' | 'years';

export interface LoanProduct {
  product_name?: string | null;
  product_code?: string | null;
  pricing_tiers?: unknown;
  interest_rate: number;
  interest_period?: InterestPeriod | null;
  interest_type?: InterestType | null;
  processing_fee_percent?: number | null;
  enforcement_fee_percent?: number | null;
  insurance_percent?: number | null;
  vat_percent?: number | null;
  platform_fee_percent?: number | null;
  late_payment_penalty_percent?: number | null;
  penalty_frequency?: PenaltyFrequency | null;
  grace_period_days?: number | null;
  early_repayment_fee_percent?: number | null;
  term_unit?: TermUnit | null; // NEW: Unit for loan term
}

export interface LoanCalculationResult {
  principal: number;
  monthlyInterestRate: number;
  weeklyInterestRate?: number; // NEW: For weekly loans
  totalInterest: number;
  processingFee: number;
  enforcementFee: number;
  insuranceFee: number;
  vatAmount: number;
  platformFee: number;
  totalFees: number;
  /** Amount deducted before disbursement (processing fee, VAT, etc.) */
  feesDeductedUpfront: number;
  /** Actual amount borrower receives after fee deductions */
  disbursementAmount: number;
  /** Total amount borrower repays (principal + interest only, fees already deducted) */
  totalRepayment: number;
  monthlyPayment: number;
  weeklyPayment?: number; // NEW: For weekly loans
  dailyPayment?: number;
  effectiveAnnualRate: number;
  paymentFrequency?: 'weekly' | 'monthly' | 'daily';
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
  rate: number,
  term: number,
  period: InterestPeriod = 'monthly'
): number {
  return principal * (rate / 100) * term;
}

/**
 * Calculate flat interest for weekly loans
 */
export function calculateFlatInterestWeekly(
  principal: number,
  weeklyRate: number,
  termWeeks: number
): number {
  return principal * (weeklyRate / 100) * termWeeks;
}

/**
 * Calculate reducing balance payment
 * Uses amortization formula for equal payments
 */
export function calculateReducingBalancePayment(
  principal: number,
  rate: number,
  term: number
): number {
  const r = rate / 100;
  if (r === 0) return principal / term;
  
  // PMT = P × [r(1+r)^n] / [(1+r)^n – 1]
  const payment = principal * (r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1);
  return payment;
}

/**
 * Calculate total interest for reducing balance
 */
export function calculateReducingBalanceInterest(
  principal: number,
  rate: number,
  term: number
): number {
  const payment = calculateReducingBalancePayment(principal, rate, term);
  return (payment * term) - principal;
}

/**
 * Main loan calculation function
 * Handles all interest periods and types with fees
 * Supports weekly and monthly payment frequencies
 */
export function calculateLoan(
  principal: number,
  termValue: number, // Can be weeks or months depending on term_unit
  product: LoanProduct,
  termUnit: TermUnit = 'months' // NEW: Specify if term is in weeks, months, etc.
): LoanCalculationResult {
  if (product.product_code === "MARKETEER") {
    let tiers = parseMarketeerTiers(product.pricing_tiers);
    if (!tiers.length) {
      tiers = parseMarketeerTiers([
        { minPrincipal: 1000, maxPrincipal: 5000, interestPercent: 30, durationDays: 10 },
        { minPrincipal: 5001, maxPrincipal: 10000, interestPercent: 20, durationDays: 15 },
      ]);
    }
    const m = calculateMarketeerLoan(principal, tiers);
    if (m) {
      const monthlyRate = normalizeToMonthlyRate(product.interest_rate || 0, "daily");
      return {
        principal,
        monthlyInterestRate: monthlyRate,
        totalInterest: m.totalInterest,
        processingFee: 0,
        enforcementFee: 0,
        insuranceFee: 0,
        vatAmount: 0,
        platformFee: 0,
        totalFees: 0,
        feesDeductedUpfront: 0,
        disbursementAmount: principal,
        totalRepayment: m.totalRepayment,
        monthlyPayment: m.dailyInstallment,
        dailyPayment: m.dailyInstallment,
        effectiveAnnualRate: Math.round(monthlyToAnnualRate(monthlyRate) * 100) / 100,
        paymentFrequency: "daily",
      };
    }
  }

  const normalizedProductName = (product.product_name || "").trim().toLowerCase();
  const isBusinessShortTerm =
    normalizedProductName === "business loan - short term" ||
    (normalizedProductName.includes("business loan") && normalizedProductName.includes("short term"));
  const interestPeriod = (product.interest_period as InterestPeriod) || 'monthly';
  const rawInterestType = (product.interest_type as string) || 'flat';
  const interestType = (rawInterestType === 'reducing_balance'
    ? 'reducing'
    : rawInterestType) as InterestType;
  
  // Determine payment frequency based on term_unit
  const isWeekly = termUnit === 'weeks' || (termUnit === 'months' && interestPeriod === 'weekly');
  
  let totalInterest: number;
  let monthlyPayment: number = 0;
  let weeklyPayment: number = 0;
  let monthlyRate: number = 0;
  let weeklyRate: number = 0;
  
  if (isWeekly && interestPeriod === 'weekly') {
    // For weekly loans with weekly interest: calculate per week, don't normalize
    weeklyRate = product.interest_rate;
    const termWeeks = termUnit === 'weeks' ? termValue : termValue * 4.33; // Convert months to weeks if needed
    
    if (interestType === 'reducing') {
      weeklyPayment = calculateReducingBalancePayment(principal, weeklyRate, termWeeks);
      totalInterest = calculateReducingBalanceInterest(principal, weeklyRate, termWeeks);
    } else {
      // Flat interest: Principal × Weekly Rate × Weeks
      totalInterest = calculateFlatInterestWeekly(principal, weeklyRate, termWeeks);
      weeklyPayment = (principal + totalInterest) / termWeeks;
    }
    
    // Convert to monthly for display purposes
    monthlyRate = weeklyRate * 4.33;
    monthlyPayment = weeklyPayment * 4.33;
  } else {
    // For monthly loans or weekly loans with monthly interest: normalize to monthly
    monthlyRate = normalizeToMonthlyRate(product.interest_rate, interestPeriod);
    const termMonths = termUnit === 'weeks' ? termValue / 4.33 : termValue; // Convert weeks to months if needed
    
    if (interestType === 'reducing') {
      monthlyPayment = calculateReducingBalancePayment(principal, monthlyRate, termMonths);
      totalInterest = calculateReducingBalanceInterest(principal, monthlyRate, termMonths);
    } else {
      // Flat interest:
      // - Business Loan - Short Term: one-time flat interest over the full term (as agreed by business)
      // - All other products: recurring interest by period
      totalInterest = isBusinessShortTerm
        ? principal * (product.interest_rate / 100)
        : calculateFlatInterest(principal, monthlyRate, termMonths, interestPeriod);
      monthlyPayment = (principal + totalInterest) / termMonths;
    }
    
    // For weekly payment frequency with monthly interest, calculate weekly payment
    if (termUnit === 'weeks') {
      weeklyPayment = monthlyPayment / 4.33;
    }
  }
  
  // Calculate fees - these are DEDUCTED from disbursement, not added to repayment
  const processingFee = principal * ((product.processing_fee_percent || 0) / 100);
  const enforcementFee = principal * ((product.enforcement_fee_percent || 0) / 100);
  const insuranceFee = principal * ((product.insurance_percent || 0) / 100);
  const platformFee = principal * ((product.platform_fee_percent || 0) / 100);
  
  // VAT on fees (not on principal or interest typically)
  const vatableAmount = processingFee + enforcementFee + platformFee;
  const vatAmount = vatableAmount * ((product.vat_percent || 0) / 100);
  
  const totalFees = processingFee + enforcementFee + insuranceFee + platformFee + vatAmount;
  
  // ALL fees are deducted upfront from disbursement
  const feesDeductedUpfront = processingFee + enforcementFee + insuranceFee + platformFee + vatAmount;
  const disbursementAmount = principal - feesDeductedUpfront;
  
  // Total repayment is just principal + interest (fees already deducted from disbursement)
  const totalRepayment = principal + totalInterest;
  
  // Adjust payment amounts for flat interest only (reducing balance already has correct amortized payments)
  if (interestType !== 'reducing') {
    if (isWeekly && weeklyPayment > 0) {
      const termWeeks = termUnit === 'weeks' ? termValue : termValue * 4.33;
      weeklyPayment = totalRepayment / termWeeks;
      monthlyPayment = weeklyPayment * 4.33;
    } else if (monthlyPayment > 0) {
      const termMonths = termUnit === 'weeks' ? termValue / 4.33 : termValue;
      monthlyPayment = totalRepayment / termMonths;
    }
  }
  
  return {
    principal,
    monthlyInterestRate: monthlyRate,
    weeklyInterestRate: isWeekly ? weeklyRate : undefined,
    totalInterest: Math.round(totalInterest * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    enforcementFee: Math.round(enforcementFee * 100) / 100,
    insuranceFee: Math.round(insuranceFee * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    feesDeductedUpfront: Math.round(feesDeductedUpfront * 100) / 100,
    disbursementAmount: Math.round(disbursementAmount * 100) / 100,
    totalRepayment: Math.round(totalRepayment * 100) / 100,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    weeklyPayment: isWeekly ? Math.round(weeklyPayment * 100) / 100 : undefined,
    effectiveAnnualRate: Math.round(monthlyToAnnualRate(monthlyRate) * 100) / 100,
    paymentFrequency: isWeekly ? 'weekly' : 'monthly',
  };
}

/**
 * Generate amortization schedule
 * Supports both weekly and monthly payment frequencies
 */
export function generateRepaymentSchedule(
  principal: number,
  termValue: number, // Can be weeks or months
  product: LoanProduct,
  startDate: Date,
  termUnit: TermUnit = 'months' // NEW: Specify if term is in weeks, months, etc.
): RepaymentScheduleItem[] {
  const interestPeriod = (product.interest_period as InterestPeriod) || 'monthly';
  const interestType = (product.interest_type as InterestType) || 'flat';
  
  // Determine if this is a weekly loan
  const isWeekly = termUnit === 'weeks' || (termUnit === 'months' && interestPeriod === 'weekly');
  
  // Calculate loan details
  const loanCalc = calculateLoan(principal, termValue, product, termUnit);
  
  const schedule: RepaymentScheduleItem[] = [];
  let remainingBalance = principal;
  
  // Determine number of installments and payment amount
  const numInstallments = termUnit === 'weeks' ? termValue : (termUnit === 'months' ? termValue : termValue);
  const paymentAmount = isWeekly && loanCalc.weeklyPayment 
    ? loanCalc.weeklyPayment 
    : loanCalc.monthlyPayment;
  
  // Get the appropriate interest rate
  const rate = isWeekly && loanCalc.weeklyInterestRate 
    ? loanCalc.weeklyInterestRate 
    : loanCalc.monthlyInterestRate;
  
  for (let i = 1; i <= numInstallments; i++) {
    const dueDate = new Date(startDate);
    
    // Calculate due date based on payment frequency
    if (isWeekly) {
      // Add weeks (7 days per week)
      dueDate.setDate(dueDate.getDate() + (i * 7));
    } else {
      // Add months
      dueDate.setMonth(dueDate.getMonth() + i);
    }
    
    let interestPayment: number;
    let principalPayment: number;
    
    if (interestType === 'reducing') {
      // Interest on remaining balance
      const periodRate = isWeekly ? (rate / 100) : (rate / 100);
      interestPayment = remainingBalance * periodRate;
      principalPayment = paymentAmount - interestPayment;
    } else {
      // Flat: equal interest each period
      interestPayment = loanCalc.totalInterest / numInstallments;
      principalPayment = principal / numInstallments;
    }
    
    remainingBalance = Math.max(0, remainingBalance - principalPayment);
    
    schedule.push({
      installmentNumber: i,
      dueDate,
      principal: Math.round(principalPayment * 100) / 100,
      interest: Math.round(interestPayment * 100) / 100,
      totalPayment: Math.round(paymentAmount * 100) / 100,
      remainingBalance: Math.round(remainingBalance * 100) / 100,
    });
  }
  
  return schedule;
}

/**
 * Calculate penalty for overdue payment
 * NOTE: overdueAmount should be the PRINCIPAL SUM (loan_amount), not the installment due amount
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
