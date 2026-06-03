import { describe, expect, it } from "vitest";
import {
  houseDisbursementsPath,
  houseLoanDetailPath,
  houseLoanEditPath,
  houseRootPath,
  normalizeProductCode,
  resolveProductCodeFromId,
} from "../adminHousePaths";

describe("adminHousePaths", () => {
  it("normalizes product codes", () => {
    expect(normalizeProductCode(" collateral ")).toBe("COLLATERAL");
    expect(normalizeProductCode("")).toBeNull();
    expect(normalizeProductCode(null)).toBeNull();
  });

  it("builds house paths", () => {
    expect(houseRootPath("MARKETEER")).toBe("/admin/houses/MARKETEER");
    expect(houseLoanDetailPath("COLLATERAL", "abc-123")).toBe("/admin/houses/COLLATERAL/loans/abc-123");
    expect(houseLoanEditPath("COLLATERAL", "abc-123")).toBe("/admin/houses/COLLATERAL/loans/abc-123/edit");
    expect(houseDisbursementsPath("PAYDAY_SOFT")).toBe("/admin/houses/PAYDAY_SOFT/disbursements");
  });

  it("resolves product code from loan product id", () => {
    const products = [
      { id: "p1", product_code: "marketeer" },
      { id: "p2", product_code: "COLLATERAL" },
    ];
    expect(resolveProductCodeFromId(products, "p2")).toBe("COLLATERAL");
    expect(resolveProductCodeFromId(products, "missing")).toBeNull();
    expect(resolveProductCodeFromId(undefined, "p1")).toBeNull();
  });
});
