import { describe, expect, it } from "vitest";
import { validateBorrowerReceiptFile } from "../borrowerUploadValidation";

describe("validateBorrowerReceiptFile", () => {
  it("accepts small pdf", () => {
    const f = new File([new Uint8Array([1, 2])], "r.pdf", { type: "application/pdf" });
    expect(validateBorrowerReceiptFile(f)).toBeNull();
  });

  it("rejects oversize", () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    const f = new File([big], "huge.pdf", { type: "application/pdf" });
    expect(validateBorrowerReceiptFile(f)).toMatch(/smaller/i);
  });
});
