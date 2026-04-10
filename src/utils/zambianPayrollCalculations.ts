/**
 * @deprecated Use `payrollCalculations.ts` with `fetchTaxConfig()` — single engine tied to `payroll_tax_config`.
 * Re-exports location lists only; tax math lives in payrollCalculations.
 */

export {
  calculatePAYE,
  calculateNHIMA,
  calculateNAPSA,
  calculatePayroll,
  fetchTaxConfig,
  formatZMW,
  getMonthName,
  type TaxBand,
  type TaxConfig,
  type PayrollCalculation,
  type PayrollEmployee,
} from "./payrollCalculations";

export const ZAMBIAN_PROVINCES = [
  "Central",
  "Copperbelt",
  "Eastern",
  "Luapula",
  "Lusaka",
  "Muchinga",
  "Northern",
  "North-Western",
  "Southern",
  "Western",
];

export const ZAMBIAN_DEPARTMENTS = [
  "Administration",
  "Finance",
  "Operations",
  "Credit",
  "Collections",
  "Risk Management",
  "IT",
  "Human Resources",
  "Marketing",
  "Legal",
  "Compliance",
  "Customer Service",
];
