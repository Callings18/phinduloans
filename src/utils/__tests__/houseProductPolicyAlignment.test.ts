import { describe, expect, it } from "vitest";
import type { LoanProductCode } from "@/config/loanProductModules";
import { LOAN_PRODUCT_MODULES } from "@/config/loanProductModules";
import { useProductLoanRules } from "@/hooks/useProductLoanRules";
import type { ProductLoanFormValues } from "@/hooks/useProductLoanRules";
import { HOUSE_PRODUCT_POLICY_SPECS, specForProduct } from "../houseProductPolicySpec";

const codes = LOAN_PRODUCT_MODULES.map((m) => m.code);

function baseValues(overrides: Partial<ProductLoanFormValues> = {}): ProductLoanFormValues {
  return {
    employmentType: "employed",
    city: "Lusaka",
    loanAmount: 5000,
    termValue: 1,
    businessMonths: 12,
    isCivilServantConfirmed: true,
    hasLocalAuthorityCompliance: true,
    productMinAmount: 1000,
    productMaxAmount: 10000,
    ...overrides,
  };
}

describe("houseProductPolicySpec coverage", () => {
  it("has a spec for every enabled loan product module", () => {
    for (const code of codes) {
      expect(specForProduct(code), `missing spec for ${code}`).toBeDefined();
    }
    expect(HOUSE_PRODUCT_POLICY_SPECS.length).toBe(codes.length);
  });
});

describe("useProductLoanRules aligns with houseProductPolicySpec", () => {
  it.each(codes)("%s term bounds match spec", (code) => {
    const spec = specForProduct(code as LoanProductCode)!;
    const rules = useProductLoanRules(code as LoanProductCode);
    const employmentType = spec.employmentTypes?.[0] ?? "employed";
    const shared = {
      city: spec.allowedCities?.[0] ?? "Lusaka",
      employmentType,
      businessMonths: spec.minBusinessMonths ?? 12,
      isCivilServantConfirmed: spec.requiresCivilServantConfirm ?? true,
      hasLocalAuthorityCompliance: spec.requiresLocalAuthorityCompliance ?? true,
      productMinAmount: spec.minAmount,
      productMaxAmount: spec.maxAmount,
    };
    const below = baseValues({
      ...shared,
      termValue: spec.minTerm - (spec.termUnit === "days" ? 1 : 1),
      loanAmount: spec.minAmount ?? 5000,
    });
    const above = baseValues({
      ...shared,
      termValue: spec.maxTerm + 1,
      loanAmount: spec.maxAmount ?? 5000,
    });
    const valid = baseValues({
      ...shared,
      termValue: spec.minTerm,
      loanAmount: ((spec.minAmount ?? 1000) + (spec.maxAmount ?? 10000)) / 2,
    });

    if (spec.minTerm === spec.maxTerm && spec.termUnit !== "months") {
      // Fixed term products: invalid if not exact
      expect(rules.validate(below).length).toBeGreaterThan(0);
      expect(rules.validate(above).length).toBeGreaterThan(0);
    } else if (code === "COLLATERAL") {
      expect(rules.validate({ ...valid, termValue: 0 }).length).toBeGreaterThan(0);
      expect(rules.validate({ ...valid, termValue: 13 }).length).toBeGreaterThan(0);
    } else if (code === "MOTOR_VEHICLE") {
      expect(rules.validate({ ...valid, termValue: 2 }).length).toBeGreaterThan(0);
      expect(rules.validate({ ...valid, termValue: 25 }).length).toBeGreaterThan(0);
    }

    expect(rules.validate(valid).length, `${code} valid baseline should pass`).toBe(0);
  });

  it("PAYDAY_SOFT rejects non-Lusaka", () => {
    const rules = useProductLoanRules("PAYDAY_SOFT");
    const errs = rules.validate(baseValues({ city: "Ndola", termValue: 30 }));
    expect(errs.some((e) => e.toLowerCase().includes("lusaka"))).toBe(true);
  });

  it("SALARY_ADVANCE requires civil servant confirmation", () => {
    const rules = useProductLoanRules("SALARY_ADVANCE");
    expect(rules.validate(baseValues({ isCivilServantConfirmed: false, termValue: 1 })).length).toBeGreaterThan(0);
  });

  it("BUSINESS rejects employed-only profile", () => {
    const rules = useProductLoanRules("BUSINESS");
    expect(rules.validate(baseValues({ employmentType: "employed", termValue: 12 })).length).toBeGreaterThan(0);
    expect(rules.validate(baseValues({ employmentType: "self_employed", termValue: 12 })).length).toBe(0);
  });

  it("MARKETEER enforces compliance, business months, and 26-day term", () => {
    const rules = useProductLoanRules("MARKETEER");
    expect(rules.validate(baseValues({ hasLocalAuthorityCompliance: false, termValue: 26 })).length).toBeGreaterThan(0);
    expect(rules.validate(baseValues({ businessMonths: 5, termValue: 26 })).length).toBeGreaterThan(0);
    expect(rules.validate(baseValues({ termValue: 25 })).length).toBeGreaterThan(0);
  });
});
