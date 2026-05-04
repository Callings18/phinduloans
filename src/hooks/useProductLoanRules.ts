import type { LoanProductCode } from "@/config/loanProductModules";

export interface ProductLoanFormValues {
  employmentType: "employed" | "self_employed" | "contract" | "other";
  city: string;
  loanAmount: number;
  termValue: number;
  businessMonths: number;
  isCivilServantConfirmed: boolean;
  hasLocalAuthorityCompliance: boolean;
}

export interface ProductLoanRuleSet {
  checklist: string[];
  validate: (values: ProductLoanFormValues) => string[];
}

// Optional product-level overrides loaded from the database. Fields that are
// not provided fall back to the hard-coded product policy below. This lets
// admins tune product limits (e.g., Marketeer min K500 instead of K1000) via
// the Loan Products screen without needing a code change.
export interface ProductLimitsOverride {
  min_amount?: number | null;
  max_amount?: number | null;
}

function formatK(n: number): string {
  return `K${Math.round(n).toLocaleString()}`;
}

function makeProductRules(overrides?: ProductLimitsOverride): Record<LoanProductCode, ProductLoanRuleSet> {
  // Default Marketeer band when the product hasn't been customised in the DB.
  const marketeerMin = Number.isFinite(Number(overrides?.min_amount)) && Number(overrides?.min_amount) > 0
    ? Number(overrides!.min_amount)
    : 1000;
  const marketeerMax = Number.isFinite(Number(overrides?.max_amount)) && Number(overrides?.max_amount) > 0
    ? Number(overrides!.max_amount)
    : 10000;

  return {
  SALARY_ADVANCE: {
    checklist: [
      "NRC",
      "3 months bank statements",
      "3 months payslips",
      "Proof of residence / utility bill",
      "Selfie holding NRC",
      "Civil servant confirmation",
    ],
    validate(values) {
      const errors: string[] = [];
      if (!values.isCivilServantConfirmed) errors.push("Civil servant confirmation is required.");
      if (!["employed", "contract"].includes(values.employmentType)) {
        errors.push("Salary Advance is restricted to employed/civil servant borrowers.");
      }
      return errors;
    },
  },
  SALARY_ADVANCE_STAFF: {
    checklist: [
      "NRC",
      "3 months bank statements",
      "3 months payslips",
      "Proof of residence / utility bill",
      "Selfie holding NRC",
      "Eligible staff member confirmation",
    ],
    validate(values) {
      const errors: string[] = [];
      if (!values.isCivilServantConfirmed) errors.push("Staff eligibility confirmation is required.");
      if (!["employed", "contract"].includes(values.employmentType)) {
        errors.push("Staff salary advance is restricted to employed/contract borrowers.");
      }
      return errors;
    },
  },
  PAYDAY_SOFT: {
    checklist: [
      "NRC",
      "Proof of employment / latest payslip",
      "Proof of residence",
      "Sketch map to residence",
      "Selfie holding NRC",
      "Home verification marked required",
    ],
    validate(values) {
      const errors: string[] = [];
      if ((values.city || "").trim().toLowerCase() !== "lusaka") {
        errors.push("Payday Soft is restricted to Lusaka.");
      }
      if (values.termValue !== 30) errors.push("Payday Soft term must be exactly 30 days.");
      return errors;
    },
  },
  COLLATERAL: {
    checklist: ["NRC", "Selfie holding NRC", "Collateral photos (physical collection required)"],
    validate(values) {
      const errors: string[] = [];
      if (values.termValue < 1 || values.termValue > 6) {
        errors.push("Collateral loan term must be between 1 and 6 months.");
      }
      return errors;
    },
  },
  BUSINESS: {
    checklist: [
      "NRC",
      "Financial statement (year-end)",
      "PACRA certificate",
      "Tax clearance",
      "Proof of business location",
    ],
    validate(values) {
      const errors: string[] = [];
      if (!["self_employed", "contract"].includes(values.employmentType)) {
        errors.push("Business loans should be captured for business owners/self-employed applicants.");
      }
      return errors;
    },
  },
  MOTOR_VEHICLE: {
    checklist: [
      "NRC",
      "3 months payslips",
      "3 months bank statements",
      "Selfie holding NRC",
      "Vehicle photos",
      "Comprehensive insurance evidence",
    ],
    validate(values) {
      const errors: string[] = [];
      if (values.termValue < 3 || values.termValue > 24) {
        errors.push("Motor Vehicle loan term must be between 3 and 24 months.");
      }
      return errors;
    },
  },
  MARKETEER: {
    checklist: [
      "NRC",
      "Selfie holding NRC",
      "Photo of business with stock",
      "Photo of residence",
      "Photo signing contract",
      "Sketch map to location",
      "Local authority compliance confirmation",
      "Business exists for at least 6 months",
    ],
    validate(values) {
      const errors: string[] = [];
      if (!values.hasLocalAuthorityCompliance) {
        errors.push("Local authority compliance must be confirmed for Marketeer loans.");
      }
      if (values.businessMonths < 6) errors.push("Business must exist for at least 6 months.");
      if (values.loanAmount < marketeerMin || values.loanAmount > marketeerMax) {
        errors.push(`Marketeer loan amount must be between ${formatK(marketeerMin)} and ${formatK(marketeerMax)}.`);
      }
      if (values.termValue !== 26) {
        errors.push("Marketeer term is fixed at 26 collection days (Sundays excluded).");
      }
      return errors;
    },
  },
  };
}

export function useProductLoanRules(
  productCode: LoanProductCode,
  overrides?: ProductLimitsOverride,
): ProductLoanRuleSet {
  return makeProductRules(overrides)[productCode];
}
