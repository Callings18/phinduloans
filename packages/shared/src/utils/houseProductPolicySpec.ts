/**
 * Canonical product policy expectations for loan houses.
 * Used by unit tests to keep useProductLoanRules aligned with DB enforce_house_product_rules().
 * When changing rules in migrations, update this spec and useProductLoanRules together.
 */
import type { LoanProductCode } from "@phinduloans/shared/config/loanProductModules";

export type HouseTermUnit = "days" | "weeks" | "months";

export interface HousePolicySpec {
  productCode: LoanProductCode;
  termUnit: HouseTermUnit;
  minTerm: number;
  maxTerm: number;
  /** When set, only these cities (lowercase) are allowed. */
  allowedCities?: string[];
  employmentTypes?: Array<"employed" | "self_employed" | "contract" | "other">;
  requiresCivilServantConfirm?: boolean;
  requiresLocalAuthorityCompliance?: boolean;
  minBusinessMonths?: number;
  minAmount?: number;
  maxAmount?: number;
  /** Collateral: interest is total % over whole loan (per_loan). */
  interestPeriod?: "per_loan" | "monthly";
}

export const HOUSE_PRODUCT_POLICY_SPECS: HousePolicySpec[] = [
  {
    productCode: "SALARY_ADVANCE",
    termUnit: "months",
    minTerm: 1,
    maxTerm: 1,
    employmentTypes: ["employed", "contract"],
    requiresCivilServantConfirm: true,
    minAmount: 500,
    maxAmount: 10000,
  },
  {
    productCode: "SALARY_ADVANCE_STAFF",
    termUnit: "months",
    minTerm: 1,
    maxTerm: 1,
    employmentTypes: ["employed", "contract"],
    requiresCivilServantConfirm: true,
    minAmount: 500,
    maxAmount: 3000,
  },
  {
    productCode: "PAYDAY_SOFT",
    termUnit: "days",
    minTerm: 30,
    maxTerm: 30,
    allowedCities: ["lusaka"],
  },
  {
    productCode: "COLLATERAL",
    termUnit: "months",
    minTerm: 1,
    maxTerm: 12,
    interestPeriod: "per_loan",
  },
  {
    productCode: "BUSINESS",
    termUnit: "months",
    minTerm: 1,
    maxTerm: 120,
    employmentTypes: ["self_employed", "contract"],
  },
  {
    productCode: "MOTOR_VEHICLE",
    termUnit: "months",
    minTerm: 3,
    maxTerm: 24,
  },
  {
    productCode: "MARKETEER",
    termUnit: "days",
    minTerm: 26,
    maxTerm: 26,
    requiresLocalAuthorityCompliance: true,
    minBusinessMonths: 6,
    minAmount: 1000,
    maxAmount: 10000,
  },
];

export function specForProduct(code: LoanProductCode): HousePolicySpec | undefined {
  return HOUSE_PRODUCT_POLICY_SPECS.find((s) => s.productCode === code);
}
