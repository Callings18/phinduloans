import { describe, expect, it } from "vitest";
import {
  borrowerIdentityKycSatisfiedFromVault,
  borrowerVaultCoreSlotsUploaded,
  mapLatestVaultRowByDocType,
  vaultDocForSlot,
} from "./borrowerKycDocs";

describe("borrowerIdentityKycSatisfiedFromVault", () => {
  it("requires verified NRC front, back, and selfie", () => {
    const docs = [
      { doc_type: "nrc_front", is_verified: true },
      { doc_type: "nrc_back", is_verified: true },
      { doc_type: "selfie", is_verified: true },
    ];
    expect(borrowerIdentityKycSatisfiedFromVault(docs)).toBe(true);
  });

  it("accepts selfie_holding_nrc as selfie slot", () => {
    const docs = [
      { doc_type: "nrc_front", is_verified: true },
      { doc_type: "nrc_back", is_verified: true },
      { doc_type: "selfie_holding_nrc", is_verified: true },
    ];
    expect(borrowerIdentityKycSatisfiedFromVault(docs)).toBe(true);
  });

  it("is false if selfie missing", () => {
    const docs = [
      { doc_type: "nrc_front", is_verified: true },
      { doc_type: "nrc_back", is_verified: true },
    ];
    expect(borrowerIdentityKycSatisfiedFromVault(docs)).toBe(false);
  });
});

describe("borrowerVaultCoreSlotsUploaded", () => {
  it("accepts either selfie vault key", () => {
    expect(borrowerVaultCoreSlotsUploaded(["nrc_front", "nrc_back", "selfie_holding_nrc"])).toBe(true);
    expect(borrowerVaultCoreSlotsUploaded(["nrc_front", "nrc_back", "selfie"])).toBe(true);
    expect(borrowerVaultCoreSlotsUploaded(["nrc_front", "nrc_back"])).toBe(false);
  });
});

describe("vaultDocForSlot", () => {
  it("maps selfie_holding_nrc into selfie slot", () => {
    const rows = [
      { doc_type: "selfie_holding_nrc", is_verified: false, id: "1" },
    ];
    const by = mapLatestVaultRowByDocType(rows);
    expect(vaultDocForSlot(by, "selfie")?.doc_type).toBe("selfie_holding_nrc");
  });
});
