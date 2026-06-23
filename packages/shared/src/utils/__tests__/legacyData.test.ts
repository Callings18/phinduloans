import { describe, it, expect } from "vitest";
import {
  safeText,
  safeAmount,
  safeNumber,
  safeDate,
  safeArray,
  safeGet,
  safeStatusLabel,
  isKnownLoanStatus,
  assessLoanCompleteness,
  assessDocumentCompleteness,
  LEGACY_FALLBACKS,
} from "../legacyData";

describe("legacyData / safeText", () => {
  it.each([
    [null, LEGACY_FALLBACKS.text],
    [undefined, LEGACY_FALLBACKS.text],
    ["", LEGACY_FALLBACKS.text],
    ["   ", LEGACY_FALLBACKS.text],
    ["Lusaka", "Lusaka"],
    [42, "42"],
    [Number.NaN, LEGACY_FALLBACKS.text],
    [true, "Yes"],
    [false, "No"],
    [{}, LEGACY_FALLBACKS.text],
  ])("returns safe value for %p", (input, expected) => {
    expect(safeText(input)).toBe(expected);
  });

  it("respects custom fallback", () => {
    expect(safeText(null, "n/a")).toBe("n/a");
  });
});

describe("legacyData / safeAmount", () => {
  it("formats numeric values as currency", () => {
    expect(safeAmount(1500)).toMatch(/1,500/);
  });

  it("parses numeric strings", () => {
    expect(safeAmount("2500.5")).toMatch(/2,500/);
  });

  it.each([null, undefined, "", "abc", Number.NaN, Infinity])(
    "returns fallback for invalid input %p",
    (v) => {
      expect(safeAmount(v)).toBe(LEGACY_FALLBACKS.amount);
    },
  );

  it("respects custom currency code", () => {
    expect(safeAmount(100, { currency: "USD" })).toMatch(/100/);
  });
});

describe("legacyData / safeNumber", () => {
  it("returns finite numbers", () => {
    expect(safeNumber(10)).toBe(10);
    expect(safeNumber("3.14")).toBeCloseTo(3.14);
  });

  it.each([null, undefined, "", "abc", Number.NaN])(
    "returns null for invalid input %p",
    (v) => {
      expect(safeNumber(v)).toBeNull();
    },
  );
});

describe("legacyData / safeDate", () => {
  it("formats valid date strings", () => {
    expect(safeDate("2025-01-15")).not.toBe(LEGACY_FALLBACKS.date);
  });

  it.each([null, undefined, "", "null", "0000-00-00", "garbage", Number.NaN])(
    "returns fallback for invalid input %p",
    (v) => {
      expect(safeDate(v)).toBe(LEGACY_FALLBACKS.date);
    },
  );

  it("survives a formatter that throws", () => {
    expect(
      safeDate("2025-01-15", () => {
        throw new Error("boom");
      }),
    ).toBe(LEGACY_FALLBACKS.date);
  });
});

describe("legacyData / status helpers", () => {
  it("recognises canonical statuses", () => {
    expect(isKnownLoanStatus("active")).toBe(true);
    expect(isKnownLoanStatus("pending")).toBe(true);
  });

  it.each([null, undefined, "", "legacy_blob", 42, {}])(
    "rejects unknown / invalid status %p",
    (v) => {
      expect(isKnownLoanStatus(v)).toBe(false);
    },
  );

  it("safeStatusLabel returns a human label for known statuses", () => {
    expect(safeStatusLabel("active")).toBe("Active");
    expect(safeStatusLabel("awaiting_disbursement")).toBe("Awaiting Disbursement");
  });

  it("safeStatusLabel humanises unknown but string statuses", () => {
    expect(safeStatusLabel("legacy_blob")).toBe("Legacy Blob");
  });

  it.each([null, undefined, "", 42])(
    "safeStatusLabel returns fallback for non-string %p",
    (v) => {
      expect(safeStatusLabel(v)).toBe(LEGACY_FALLBACKS.status);
    },
  );
});

describe("legacyData / safeArray + safeGet", () => {
  it("safeArray returns [] for null/undefined/non-array", () => {
    expect(safeArray(null)).toEqual([]);
    expect(safeArray(undefined)).toEqual([]);
    expect(safeArray([1, 2])).toEqual([1, 2]);
    expect(safeArray("not array" as unknown as unknown[])).toEqual([]);
  });

  it("safeGet traverses nested paths", () => {
    expect(safeGet({ a: { b: { c: 7 } } }, "a.b.c")).toBe(7);
  });

  it("safeGet returns fallback for missing path", () => {
    expect(safeGet({ a: 1 }, "a.b.c", "default")).toBe("default");
    expect(safeGet(null, "a.b")).toBeNull();
    expect(safeGet({ a: null }, "a.b")).toBeNull();
  });
});

describe("legacyData / assessLoanCompleteness", () => {
  it("flags entire record missing", () => {
    const r = assessLoanCompleteness(null);
    expect(r.isComplete).toBe(false);
    expect(r.hasMinimumViable).toBe(false);
    expect(r.missing).toContain("entire_record");
  });

  it("flags missing required fields", () => {
    const r = assessLoanCompleteness({ id: "x" });
    expect(r.hasMinimumViable).toBe(false);
    expect(r.missing).toEqual(expect.arrayContaining(["loan_amount", "status"]));
  });

  it("passes minimum-viable when required fields present, even if optionals missing", () => {
    const r = assessLoanCompleteness({ id: "x", loan_amount: 1000, status: "active" });
    expect(r.hasMinimumViable).toBe(true);
    expect(r.isComplete).toBe(false);
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it("reports complete when all fields present", () => {
    const r = assessLoanCompleteness({
      id: "x",
      loan_amount: 1000,
      status: "active",
      loan_term_months: 6,
      monthly_repayment: 200,
      total_repayment: 1200,
      disbursement_date: "2025-01-01",
    });
    expect(r.isComplete).toBe(true);
    expect(r.missing).toEqual([]);
  });
});

describe("legacyData / assessDocumentCompleteness", () => {
  it("handles null/undefined doc list", () => {
    const r = assessDocumentCompleteness(null, ["nrc", "payslip"]);
    expect(r.hasAny).toBe(false);
    expect(r.missingRequired).toEqual(["nrc", "payslip"]);
    expect(r.total).toBe(0);
  });

  it("flags missing required types", () => {
    const r = assessDocumentCompleteness(
      [{ doc_type: "nrc" }, { doc_type: null }, { not_a_doc: true }],
      ["nrc", "payslip"],
    );
    expect(r.hasAny).toBe(true);
    expect(r.missingRequired).toEqual(["payslip"]);
    expect(r.total).toBe(3);
  });

  it("returns empty missing list when all required present", () => {
    const r = assessDocumentCompleteness(
      [{ doc_type: "nrc" }, { doc_type: "payslip" }],
      ["nrc", "payslip"],
    );
    expect(r.missingRequired).toEqual([]);
  });
});
