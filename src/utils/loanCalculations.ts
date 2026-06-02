/**
 * Unified Loan Calculation Utilities
 * Handles interest period normalization, flat vs reducing balance,
 * and penalty calculations across the entire application.
 */

import { calculateMarketeerLoan, getMarketeerTiersOrDefault } from "@/lib/marketeerCalculations";

export type InterestPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'per_loan' | 'per_day' | 'per_week' | 'per_month' | 'per_year';
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
    case 'per_day':
      // Daily rate × 30 days = monthly rate
      return rate * 30;
    case 'weekly':
    case 'per_week':
      // Weekly rate × ~4.33 weeks = monthly rate
      return rate * 4.33;
    case 'monthly':
    case 'per_month':
      return rate;
    case 'yearly':
    case 'per_year':
      // Yearly rate ÷ 12 = monthly rate
      return rate / 12;
    case 'per_loan':
      // Total over loan; not normalizable to a per-period rate without knowing term.
      // Return 0 here so callers don't accidentally show a misleading per-month rate.
      return 0;
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
 * Supports daily, weekly, and monthly payment frequencies.
 *
 * If `termUnit` is omitted, the function falls back to `product.term_unit`
 * so callers that only know the product (e.g. the borrower application form
 * or the public Calculator page) still get correct math for daily/weekly
 * products like PAYDAY_SOFT (30 days) or MARKETEER (26 days). Without this
 * fallback a 30-day Payday Soft loan would be priced as a 30-MONTH loan,
 * inflating the quoted interest dramatically.
 */
export function calculateLoan(
  principal: number,
  termValue: number, // Can be days, weeks, months or years (per termUnit / product.term_unit)
  product: LoanProduct,
  termUnit?: TermUnit
): LoanCalculationResult {
  const resolvedTermUnit: TermUnit =
    termUnit ?? (product.term_unit as TermUnit | null | undefined) ?? 'months';
  const isCollateral = isCollateralProduct(product);

  if (isCollateral) {
    // Collateral loans are a SINGLE 30-day payment at a flat % of principal
    // (default 30%). They are NOT split into monthly installments — the previous
    // hardcoded 6-month split produced wrong "monthly" figures (e.g. K1,840).
    const collateralInterestRateTotal = product.interest_rate || 30;
    const totalInterest = principal * (collateralInterestRateTotal / 100);
    const totalRepayment = principal + totalInterest;
    const monthlyPayment = totalRepayment; // one bullet payment

    const processingFee = principal * ((product.processing_fee_percent || 0) / 100);
    const enforcementFee = principal * ((product.enforcement_fee_percent || 0) / 100);
    const insuranceFee = principal * ((product.insurance_percent || 0) / 100);
    const platformFee = principal * ((product.platform_fee_percent || 0) / 100);
    const vatableAmount = processingFee + enforcementFee + platformFee;
    const vatAmount = vatableAmount * ((product.vat_percent || 0) / 100);
    const totalFees = processingFee + enforcementFee + insuranceFee + platformFee + vatAmount;
    const feesDeductedUpfront = totalFees;
    const disbursementAmount = principal - feesDeductedUpfront;

    return {
      principal,
      monthlyInterestRate: collateralInterestRateTotal,
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
      effectiveAnnualRate: Math.round(monthlyToAnnualRate(collateralInterestRateTotal) * 100) / 100,
      paymentFrequency: "monthly",
    };
  }

  if (product.product_code === "MARKETEER") {
    const tiers = getMarketeerTiersOrDefault(product.pricing_tiers);
    const m = calculateMarketeerLoan(principal, tiers);
    if (m) {
      // Marketeer is a fixed-term per-loan product (30% / 26 days).
      // Express an equivalent "monthly" rate purely for display: total interest %
      // scaled by (30 / durationDays) so a 26-day, 30% loan reads ~34.6%/month.
      const interestPercentTotal = m.tier.interestPercent;
      const equivMonthlyRate = m.tier.durationDays > 0
        ? (interestPercentTotal * 30) / m.tier.durationDays
        : interestPercentTotal;
      return {
        principal,
        monthlyInterestRate: Math.round(equivMonthlyRate * 100) / 100,
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
        effectiveAnnualRate: Math.round(monthlyToAnnualRate(equivMonthlyRate) * 100) / 100,
        paymentFrequency: "daily",
      };
    }
  }

  // NOTE: Whether interest is a one-time total (per_loan) or recurs per period is now
  // driven entirely by the `interest_period` the admin selects on the loan form —
  // no product-name/code special-casing. Set interest_period = 'per_loan' for a
  // one-time flat % of principal over the whole term (e.g. Business / Collateral).
  const interestPeriod = (product.interest_period as InterestPeriod) || 'monthly';
  const rawInterestType = (product.interest_type as string) || 'flat';
  const interestType = (rawInterestType === 'reducing_balance'
    ? 'reducing'
    : rawInterestType) as InterestType;

  // Normalize "days" / "years" to a months-based view so the rest of the
  // calculation reuses the existing weekly/monthly branches without
  // introducing extra payment-frequency cases. Marketeer (days) is already
  // handled by the early-return above; the remaining "days" product today
  // is PAYDAY_SOFT (30 days = 1 month equivalent).
  let workingTermValue = termValue;
  let workingTermUnit: TermUnit = resolvedTermUnit;
  if (workingTermUnit === 'days') {
    workingTermValue = termValue / 30;
    workingTermUnit = 'months';
  } else if (workingTermUnit === 'years') {
    workingTermValue = termValue * 12;
    workingTermUnit = 'months';
  }

  // Determine payment frequency based on the working term unit
  const isWeekly = !isCollateral && (workingTermUnit === 'weeks' || (workingTermUnit === 'months' && interestPeriod === 'weekly'));
  
  let totalInterest: number;
  let monthlyPayment: number = 0;
  let weeklyPayment: number = 0;
  let monthlyRate: number = 0;
  let weeklyRate: number = 0;
  
  if (isWeekly && interestPeriod === 'weekly') {
    // For weekly loans with weekly interest: calculate per week, don't normalize
    weeklyRate = product.interest_rate;
    const termWeeks = workingTermUnit === 'weeks' ? workingTermValue : workingTermValue * 4.33; // Convert months to weeks if needed
    
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
    const termMonths = workingTermUnit === 'weeks' ? workingTermValue / 4.33 : workingTermValue; // Convert weeks to months if needed
    
    if (interestType === 'reducing') {
      monthlyPayment = calculateReducingBalancePayment(principal, monthlyRate, termMonths);
      totalInterest = calculateReducingBalanceInterest(principal, monthlyRate, termMonths);
    } else {
      // Flat interest:
      // - interest_period = 'per_loan': total rate is one-time over the full term
      //   (regardless of how many months). e.g. Collateral / Business 30% flat / loan.
      // - All other periods: recurring interest by period.
      const isPerLoanFlat = (interestPeriod as string) === 'per_loan';
      totalInterest = isPerLoanFlat
        ? principal * (product.interest_rate / 100)
        : calculateFlatInterest(principal, monthlyRate, termMonths, interestPeriod);
      monthlyPayment = (principal + totalInterest) / termMonths;
    }
    
    // For weekly payment frequency with monthly interest, calculate weekly payment
    if (workingTermUnit === 'weeks') {
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
      const termWeeks = workingTermUnit === 'weeks' ? workingTermValue : workingTermValue * 4.33;
      weeklyPayment = totalRepayment / termWeeks;
      monthlyPayment = weeklyPayment * 4.33;
    } else if (monthlyPayment > 0) {
      const termMonths = workingTermUnit === 'weeks' ? workingTermValue / 4.33 : workingTermValue;
      if (termMonths > 0) {
        monthlyPayment = totalRepayment / termMonths;
      }
    }
  }
  
  // For per_loan products, derive a display monthly rate from the total interest %
  // (e.g. 30% over 3 months => 10% / month effective).
  if ((interestPeriod as string) === 'per_loan') {
    const termMonthsDisplay = workingTermUnit === 'weeks' ? workingTermValue / 4.33 : workingTermValue;
    if (termMonthsDisplay > 0) {
      monthlyRate = product.interest_rate / termMonthsDisplay;
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
 * Supports daily, weekly and monthly payment frequencies. The authoritative
 * server-side schedule is built by `createRepaymentScheduleForLoan` in
 * `src/utils/createRepaymentSchedule.ts` (which honours business calendar
 * & holidays). This helper is for UI previews only.
 */
export function generateRepaymentSchedule(
  principal: number,
  termValue: number, // Can be days, weeks, months or years (per termUnit / product.term_unit)
  product: LoanProduct,
  startDate: Date,
  termUnit?: TermUnit
): RepaymentScheduleItem[] {
  const resolvedTermUnit: TermUnit =
    termUnit ?? (product.term_unit as TermUnit | null | undefined) ?? 'months';
  const isCollateral = isCollateralProduct(product);
  const interestPeriod = (product.interest_period as InterestPeriod) || 'monthly';
  const interestType = (product.interest_type as InterestType) || 'flat';

  // Determine if this is a weekly or daily loan
  const isWeekly = resolvedTermUnit === 'weeks' || (resolvedTermUnit === 'months' && interestPeriod === 'weekly');
  const isDaily = !isCollateral && resolvedTermUnit === 'days';

  // Calculate loan details
  const loanCalc = calculateLoan(principal, termValue, product, resolvedTermUnit);

  const schedule: RepaymentScheduleItem[] = [];
  let remainingBalance = principal;

  // Determine number of installments and payment amount.
  // Collateral is a single 30-day bullet payment (not 6 monthly installments).
  const numInstallments = isCollateral
    ? 1
    : isDaily
      ? termValue
      : resolvedTermUnit === 'weeks'
        ? termValue
        : termValue;
  const paymentAmount = isDaily && loanCalc.dailyPayment
    ? loanCalc.dailyPayment
    : isWeekly && loanCalc.weeklyPayment
      ? loanCalc.weeklyPayment
      : loanCalc.monthlyPayment;

  // Get the appropriate interest rate (display only — used by reducing balance)
  const rate = isWeekly && loanCalc.weeklyInterestRate
    ? loanCalc.weeklyInterestRate
    : loanCalc.monthlyInterestRate;

  for (let i = 1; i <= numInstallments; i++) {
    const dueDate = new Date(startDate);

    // Calculate due date based on payment frequency
    if (isCollateral) {
      dueDate.setDate(dueDate.getDate() + 30); // single payment 30 days out
    } else if (isDaily) {
      dueDate.setDate(dueDate.getDate() + i);
    } else if (isWeekly) {
      dueDate.setDate(dueDate.getDate() + (i * 7));
    } else {
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
    case 'weekly': {
      const weeksOverdue = Math.ceil(effectiveDaysOverdue / 7);
      return overdueAmount * (penaltyRate / 100) * weeksOverdue;
    }
    case 'monthly': {
      const monthsOverdue = Math.ceil(effectiveDaysOverdue / 30);
      return overdueAmount * (penaltyRate / 100) * monthsOverdue;
    }
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
