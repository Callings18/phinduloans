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

const productRules: Record<LoanProductCode, ProductLoanRuleSet> = {
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
    checklist: ["NRC", "Selfie holding NRC", "Collateral details (physical collection required)"],
    validate() {
      return [];
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
      "Video of business with stock",
      "Video of residence",
      "Video signing contract",
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
      if (values.loanAmount < 1000 || values.loanAmount > 10000) {
        errors.push("Marketeer loan amount must be between K1,000 and K10,000.");
      }
      return errors;
    },
  },
};

export function useProductLoanRules(productCode: LoanProductCode): ProductLoanRuleSet {
  return productRules[productCode];
}
