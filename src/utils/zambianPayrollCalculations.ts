/**
 * Zambian Payroll Calculations
 * Compliant with ZRA (Zambia Revenue Authority) and NAPSA regulations
 */

// ZRA PAYE Tax Brackets (2024 rates - update annually)
export const PAYE_TAX_BRACKETS = [
  { min: 0, max: 4800, rate: 0 }, // No tax on first 4,800
  { min: 4800, max: 7000, rate: 0.25 }, // 25% on next bracket
  { min: 7000, max: 10000, rate: 0.30 }, // 30% on next bracket
  { min: 10000, max: Infinity, rate: 0.37 }, // 37% on remaining
];

// NAPSA Contribution Rates
export const NAPSA_EMPLOYEE_RATE = 0.05; // 5% employee contribution
export const NAPSA_EMPLOYER_RATE = 0.05; // 5% employer contribution
export const NAPSA_MAX_CONTRIBUTABLE = 6000; // Maximum contributable salary (as of 2024)

// NHIMA Contribution (if applicable)
export const NHIMA_RATE = 0.01; // 1% (example rate, verify current rate)

// Personal Relief (annual, divided by 12 for monthly)
export const PERSONAL_RELIEF_MONTHLY = 300; // K300 per month personal relief

/**
 * Calculate PAYE (Pay As You Earn) tax based on Zambian tax brackets
 * @param grossSalary - Gross salary before deductions
 * @param personalRelief - Personal relief amount (default: K300/month)
 * @returns PAYE tax amount
 */
export function calculatePAYE(grossSalary: number, personalRelief: number = PERSONAL_RELIEF_MONTHLY): number {
  if (grossSalary <= 0) return 0;

  let taxableIncome = grossSalary;
  let tax = 0;
  let remainingIncome = taxableIncome;

  // Apply tax brackets
  for (let i = 0; i < PAYE_TAX_BRACKETS.length; i++) {
    const bracket = PAYE_TAX_BRACKETS[i];
    
    if (remainingIncome <= 0) break;

    const bracketRange = bracket.max === Infinity 
      ? remainingIncome 
      : Math.min(bracket.max - bracket.min, remainingIncome - bracket.min);

    if (bracketRange > 0 && remainingIncome > bracket.min) {
      const taxableInBracket = Math.min(bracketRange, remainingIncome - bracket.min);
      tax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
    }
  }

  // Apply personal relief
  tax = Math.max(0, tax - personalRelief);

  return Math.round(tax * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate NAPSA employee contribution
 * @param grossSalary - Gross salary
 * @returns NAPSA contribution amount
 */
export function calculateNAPSAEmployee(grossSalary: number): number {
  if (grossSalary <= 0) return 0;
  
  // NAPSA is 5% of gross, but capped at maximum contributable amount
  const contributableAmount = Math.min(grossSalary, NAPSA_MAX_CONTRIBUTABLE);
  const contribution = contributableAmount * NAPSA_EMPLOYEE_RATE;
  
  return Math.round(contribution * 100) / 100;
}

/**
 * Calculate NAPSA employer contribution
 * @param grossSalary - Gross salary
 * @returns NAPSA employer contribution amount
 */
export function calculateNAPSAEmployer(grossSalary: number): number {
  if (grossSalary <= 0) return 0;
  
  const contributableAmount = Math.min(grossSalary, NAPSA_MAX_CONTRIBUTABLE);
  const contribution = contributableAmount * NAPSA_EMPLOYER_RATE;
  
  return Math.round(contribution * 100) / 100;
}

/**
 * Calculate NHIMA contribution
 * @param grossSalary - Gross salary
 * @returns NHIMA contribution amount
 */
export function calculateNHIMA(grossSalary: number): number {
  if (grossSalary <= 0) return 0;
  
  const contribution = grossSalary * NHIMA_RATE;
  return Math.round(contribution * 100) / 100;
}

/**
 * Calculate net salary after all deductions
 * @param grossSalary - Gross salary
 * @param deductions - Object containing all deduction amounts
 * @returns Net salary
 */
export function calculateNetSalary(
  grossSalary: number,
  deductions: {
    napsa?: number;
    nhima?: number;
    paye?: number;
    unionDues?: number;
    loanDeductions?: number;
    advanceDeductions?: number;
    otherDeductions?: number;
    unpaidLeaveDeduction?: number;
  }
): number {
  const totalDeductions = 
    (deductions.napsa || 0) +
    (deductions.nhima || 0) +
    (deductions.paye || 0) +
    (deductions.unionDues || 0) +
    (deductions.loanDeductions || 0) +
    (deductions.advanceDeductions || 0) +
    (deductions.otherDeductions || 0) +
    (deductions.unpaidLeaveDeduction || 0);

  const netSalary = grossSalary - totalDeductions;
  return Math.max(0, Math.round(netSalary * 100) / 100); // Ensure non-negative
}

/**
 * Calculate complete payroll for an employee
 * @param grossSalary - Gross salary
 * @param personalRelief - Personal relief amount
 * @param otherDeductions - Other deductions (loans, advances, etc.)
 * @returns Complete payroll breakdown
 */
export function calculateCompletePayroll(
  grossSalary: number,
  personalRelief: number = PERSONAL_RELIEF_MONTHLY,
  otherDeductions: {
    unionDues?: number;
    loanDeductions?: number;
    advanceDeductions?: number;
    otherDeductions?: number;
    unpaidLeaveDeduction?: number;
  } = {}
) {
  const napsaEmployee = calculateNAPSAEmployee(grossSalary);
  const napsaEmployer = calculateNAPSAEmployer(grossSalary);
  const nhima = calculateNHIMA(grossSalary);
  const paye = calculatePAYE(grossSalary, personalRelief);

  const totalDeductions = 
    napsaEmployee +
    nhima +
    paye +
    (otherDeductions.unionDues || 0) +
    (otherDeductions.loanDeductions || 0) +
    (otherDeductions.advanceDeductions || 0) +
    (otherDeductions.otherDeductions || 0) +
    (otherDeductions.unpaidLeaveDeduction || 0);

  const netSalary = grossSalary - totalDeductions;

  return {
    grossSalary,
    deductions: {
      napsaEmployee,
      napsaEmployer,
      nhima,
      paye,
      unionDues: otherDeductions.unionDues || 0,
      loanDeductions: otherDeductions.loanDeductions || 0,
      advanceDeductions: otherDeductions.advanceDeductions || 0,
      otherDeductions: otherDeductions.otherDeductions || 0,
      unpaidLeaveDeduction: otherDeductions.unpaidLeaveDeduction || 0,
    },
    totalDeductions,
    netSalary: Math.max(0, netSalary),
  };
}

/**
 * Calculate leave deduction for unpaid leave
 * @param grossSalary - Monthly gross salary
 * @param unpaidLeaveDays - Number of unpaid leave days
 * @param workingDaysPerMonth - Working days in the month (default: 22)
 * @returns Deduction amount for unpaid leave
 */
export function calculateLeaveDeduction(
  grossSalary: number,
  unpaidLeaveDays: number,
  workingDaysPerMonth: number = 22
): number {
  if (unpaidLeaveDays <= 0) return 0;
  
  const dailyRate = grossSalary / workingDaysPerMonth;
  const deduction = dailyRate * unpaidLeaveDays;
  
  return Math.round(deduction * 100) / 100;
}

/**
 * Get Zambian provinces list
 */
export const ZAMBIAN_PROVINCES = [
  'Central',
  'Copperbelt',
  'Eastern',
  'Luapula',
  'Lusaka',
  'Muchinga',
  'Northern',
  'North-Western',
  'Southern',
  'Western',
];

/**
 * Get Zambian departments list (common for financial institutions)
 */
export const ZAMBIAN_DEPARTMENTS = [
  'Administration',
  'Finance',
  'Operations',
  'Credit',
  'Collections',
  'Risk Management',
  'IT',
  'Human Resources',
  'Marketing',
  'Legal',
  'Compliance',
  'Customer Service',
];
