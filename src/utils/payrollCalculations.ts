/**
 * Zambian Payroll Calculation Engine
 * Handles PAYE, NHIMA, NAPSA and full payroll computation
 * using rates from payroll_tax_config table.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────

export interface TaxBand {
  band_min: number;
  band_max: number | null; // null = unlimited
  rate_percent: number;
  label?: string;
}

export interface StatutoryRate {
  employee_rate_percent: number;
  employer_rate_percent: number;
  ceiling_amount?: number | null;
}

export interface ContributionSplit {
  employee: number;
  employer: number;
}

export interface PayrollEmployee {
  id: string;
  full_name: string;
  salary: number;
  housing_allowance?: number;
  transport_allowance?: number;
  lunch_allowance?: number;
  other_allowances?: number;
  commission_percentage?: number;
}

export interface PayrollCalculation {
  employee_id: string;
  employee_name: string;

  /** Income on which PAYE was computed (gross or chargeable after NAPSA). */
  paye_taxable_income: number;

  // Gross components
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  lunch_allowance: number;
  other_allowances: number;
  overtime_pay: number;
  commission_amount: number;
  gross_pay: number;

  // Statutory deductions
  paye_tax: number;
  nhima_employee: number;
  nhima_employer: number;
  napsa_employee: number;
  napsa_employer: number;

  // Other deductions
  loan_deduction: number;
  pension_deduction: number;
  union_dues: number;
  other_deductions: number;

  // Totals
  total_deductions: number;
  net_pay: number;
  total_employer_cost: number;
}

export interface TaxConfig {
  payeBands: TaxBand[];
  nhima: StatutoryRate;
  napsa: StatutoryRate;
  /** Monthly personal relief (Kwacha), subtracted from calculated PAYE (not from income). From payroll_tax_config. */
  personalReliefMonthly?: number;
  /**
   * If true (default when loaded from DB), PAYE marginal bands apply to chargeable income =
   * gross pay minus NAPSA employee contribution — common Zambian practice; confirm with ZRA guidance.
   * If false, bands apply to full gross (legacy / comparison).
   */
  payeOnChargeableAfterNapsa?: boolean;
}

// ── Core Calculation Functions ─────────────────────────────

/**
 * Progressive PAYE tax calculation using Zambian tax bands.
 * Iterates through bands, taxing each portion at its rate.
 */
export function calculatePAYE(grossPay: number, taxBands: TaxBand[]): number {
  if (grossPay <= 0 || taxBands.length === 0) return 0;

  // Sort bands by band_min ascending
  const sorted = [...taxBands].sort((a, b) => a.band_min - b.band_min);
  let totalTax = 0;

  for (const band of sorted) {
    const min = band.band_min;
    const max = band.band_max ?? Infinity;

    if (grossPay <= min) break;

    const taxableInBand = Math.min(grossPay, max) - min;
    if (taxableInBand > 0) {
      totalTax += taxableInBand * (band.rate_percent / 100);
    }
  }

  return Math.round(totalTax * 100) / 100;
}

/**
 * NHIMA (National Health Insurance) contribution.
 * Both employee and employer pay a percentage of gross.
 */
export function calculateNHIMA(
  grossPay: number,
  employeeRate: number,
  employerRate: number
): ContributionSplit {
  const employee = Math.round(grossPay * (employeeRate / 100) * 100) / 100;
  const employer = Math.round(grossPay * (employerRate / 100) * 100) / 100;
  return { employee, employer };
}

/**
 * NAPSA (National Pension Scheme) contribution.
 * Applied to pensionable pay capped at the ceiling amount.
 */
export function calculateNAPSA(
  grossPay: number,
  employeeRate: number,
  employerRate: number,
  ceiling: number
): ContributionSplit {
  const pensionablePay = Math.min(grossPay, ceiling);
  const employee = Math.round(pensionablePay * (employeeRate / 100) * 100) / 100;
  const employer = Math.round(pensionablePay * (employerRate / 100) * 100) / 100;
  return { employee, employer };
}

// ── Tax Config Fetcher ─────────────────────────────────────

/**
 * Fetch current tax configuration from payroll_tax_config table.
 * Filters by is_active and effective_from <= today.
 */
export async function fetchTaxConfig(): Promise<TaxConfig> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await (supabase
    .from("payroll_tax_config") as any)
    .select("*")
    .eq("is_active", true)
    .lte("effective_from", today)
    .order("band_min", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch tax config: ${error.message}`);

  const rows = data || [];

  const payeBands: TaxBand[] = rows
    .filter((r: any) => r.config_type === "paye_band")
    .map((r: any) => ({
      band_min: Number(r.band_min) || 0,
      band_max: r.band_max != null ? Number(r.band_max) : null,
      rate_percent: Number(r.rate_percent) || 0,
      label: r.label,
    }));

  const nhimaRow = rows.find((r: any) => r.config_type === "nhima");
  const nhima: StatutoryRate = {
    employee_rate_percent: Number(nhimaRow?.employee_rate_percent) || 1,
    employer_rate_percent: Number(nhimaRow?.employer_rate_percent) || 1,
  };

  const napsaRow = rows.find((r: any) => r.config_type === "napsa");
  const napsa: StatutoryRate = {
    employee_rate_percent: Number(napsaRow?.employee_rate_percent) || 5,
    employer_rate_percent: Number(napsaRow?.employer_rate_percent) || 5,
    ceiling_amount: napsaRow?.ceiling_amount != null
      ? Number(napsaRow.ceiling_amount)
      : 30408.80,
  };

  const reliefRow = rows.find(
    (r: any) =>
      r.config_type === "general" &&
      String(r.label || "").toLowerCase().includes("personal_relief"),
  );
  const personalReliefMonthly =
    reliefRow?.ceiling_amount != null ? Number(reliefRow.ceiling_amount) : 300;

  const chargeableRow = rows.find(
    (r: any) =>
      r.config_type === "general" &&
      String(r.label || "").toLowerCase().includes("chargeable_after_napsa"),
  );
  const payeOnChargeableAfterNapsa =
    chargeableRow == null ? true : Number(chargeableRow.band_min ?? 1) !== 0;

  return {
    payeBands,
    nhima,
    napsa,
    personalReliefMonthly,
    payeOnChargeableAfterNapsa,
  };
}

// ── Full Payroll Calculator ────────────────────────────────

export interface CalculatePayrollInput {
  employee: PayrollEmployee;
  commission?: number;
  overtimePay?: number;
  loanDeduction?: number;
  pensionDeduction?: number;
  unionDues?: number;
  otherDeductions?: number;
  taxConfig: TaxConfig;
}

/**
 * Calculate complete payroll for a single employee.
 * Uses pre-fetched taxConfig to avoid repeated DB calls during batch runs.
 */
export function calculatePayroll(input: CalculatePayrollInput): PayrollCalculation {
  const {
    employee,
    commission = 0,
    overtimePay = 0,
    loanDeduction = 0,
    pensionDeduction = 0,
    unionDues = 0,
    otherDeductions = 0,
    taxConfig,
  } = input;

  const basicSalary = Number(employee.salary) || 0;
  const housing = Number(employee.housing_allowance) || 0;
  const transport = Number(employee.transport_allowance) || 0;
  const lunch = Number(employee.lunch_allowance) || 0;
  const otherAllow = Number(employee.other_allowances) || 0;

  // Gross pay
  const grossPay = basicSalary + housing + transport + lunch + otherAllow + commission + overtimePay;

  // NAPSA / NHIMA on gross (NAPSA ceiling applied inside calculateNAPSA)
  const nhima = calculateNHIMA(
    grossPay,
    taxConfig.nhima.employee_rate_percent,
    taxConfig.nhima.employer_rate_percent
  );
  const napsa = calculateNAPSA(
    grossPay,
    taxConfig.napsa.employee_rate_percent,
    taxConfig.napsa.employer_rate_percent,
    taxConfig.napsa.ceiling_amount ?? 30408.80
  );

  const useChargeable =
    taxConfig.payeOnChargeableAfterNapsa !== false;
  const payeTaxableIncome = useChargeable
    ? Math.max(0, grossPay - napsa.employee)
    : grossPay;

  const rawPaye = calculatePAYE(payeTaxableIncome, taxConfig.payeBands);
  const relief = taxConfig.personalReliefMonthly ?? 0;
  const paye = Math.max(0, Math.round((rawPaye - relief) * 100) / 100);

  // Total deductions (employee side only)
  const totalDeductions =
    paye + nhima.employee + napsa.employee +
    loanDeduction + pensionDeduction + unionDues + otherDeductions;

  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;
  const totalEmployerCost = Math.round((grossPay + nhima.employer + napsa.employer) * 100) / 100;

  return {
    employee_id: employee.id,
    employee_name: employee.full_name,
    paye_taxable_income: Math.round(payeTaxableIncome * 100) / 100,
    basic_salary: basicSalary,
    housing_allowance: housing,
    transport_allowance: transport,
    lunch_allowance: lunch,
    other_allowances: otherAllow,
    overtime_pay: overtimePay,
    commission_amount: commission,
    gross_pay: grossPay,
    paye_tax: paye,
    nhima_employee: nhima.employee,
    nhima_employer: nhima.employer,
    napsa_employee: napsa.employee,
    napsa_employer: napsa.employer,
    loan_deduction: loanDeduction,
    pension_deduction: pensionDeduction,
    union_dues: unionDues,
    other_deductions: otherDeductions,
    total_deductions: Math.round(totalDeductions * 100) / 100,
    net_pay: netPay,
    total_employer_cost: totalEmployerCost,
  };
}

// ── Formatting Helpers ─────────────────────────────────────

/** Format as Zambian Kwacha */
export function formatZMW(amount: number): string {
  return `K${amount.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Get month name from number */
export function getMonthName(month: number): string {
  return new Date(2026, month - 1).toLocaleString("en", { month: "long" });
}
