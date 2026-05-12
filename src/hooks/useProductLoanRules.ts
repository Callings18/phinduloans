import type { LoanProductCode } from "@/config/loanProductModules";

export interface ProductLoanFormValues {
  employmentType: "employed" | "self_employed" | "contract" | "other";
  city: string;
  loanAmount: number;
  termValue: number;
  businessMonths: number;
  isCivilServantConfirmed: boolean;
  hasLocalAuthorityCompliance: boolean;
  productMinAmount?: number | null;
  productMaxAmount?: number | null;
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
      const minAmount = Number(values.productMinAmount ?? 500);
      const maxAmount = Number(values.productMaxAmount ?? 10000);
      if (values.loanAmount < minAmount || values.loanAmount > maxAmount) {
        errors.push(`Salary Advance amount must be between K${minAmount.toLocaleString()} and K${maxAmount.toLocaleString()}.`);
      }
      if (values.termValue !== 1) {
        errors.push("Salary Advance term is fixed at 1 month.");
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
      const minAmount = Number(values.productMinAmount ?? 500);
      const maxAmount = Number(values.productMaxAmount ?? 3000);
      if (values.loanAmount < minAmount || values.loanAmount > maxAmount) {
        errors.push(`Staff salary advance amount must be between K${minAmount.toLocaleString()} and K${maxAmount.toLocaleString()}.`);
      }
      if (values.termValue !== 1) {
        errors.push("Staff salary advance term is fixed at 1 month.");
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
      // Mirrors enforce_house_product_rules() in the DB:
      //   IF v_product_code = 'COLLATERAL' THEN
      //     IF coalesce(NEW.loan_term_months, 0) <> 6 THEN
      //       RAISE EXCEPTION 'Collateral loan term must be fixed at 6 months';
      //     END IF;
      //   END IF;
      if (values.termValue !== 6) {
        errors.push("Collateral loan term is fixed at 6 months (30% total interest).");
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
      const minAmount = Number(values.productMinAmount ?? 500);
      const maxAmount = Number(values.productMaxAmount ?? 10000);
      if (!values.hasLocalAuthorityCompliance) {
        errors.push("Local authority compliance must be confirmed for Marketeer loans.");
      }
      if (values.businessMonths < 6) errors.push("Business must exist for at least 6 months.");
      if (values.loanAmount < minAmount || values.loanAmount > maxAmount) {
        errors.push(`Marketeer loan amount must be between K${minAmount.toLocaleString()} and K${maxAmount.toLocaleString()}.`);
      }
      if (values.termValue !== 26) {
        errors.push("Marketeer term is fixed at 26 collection days (Sundays excluded).");
      }
      return errors;
    },
  },
};

export function useProductLoanRules(productCode: LoanProductCode): ProductLoanRuleSet {
  return productRules[productCode];
}
