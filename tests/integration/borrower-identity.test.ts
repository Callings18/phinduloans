import { describe, expect, it } from "vitest";
import {
  isDuplicateBorrowerAuthError,
  isProductionSupabaseUrl,
  matchesBorrowerAuthIdentity,
  normalizeBorrowerPhone,
} from "../../supabase/functions/create-borrower/borrowerIdentity";

describe("borrower identity normalization", () => {
  it.each(["0979943293", "+260 979 943 293", "260979943293", "979943293"])(
    "normalizes %s to Auth E.164",
    (input) => expect(normalizeBorrowerPhone(input)).toBe("+260979943293"),
  );

  it("rejects incomplete and overlong phone numbers", () => {
    expect(normalizeBorrowerPhone("0979")).toBeNull();
    expect(normalizeBorrowerPhone("2609799432939")).toBeNull();
    expect(normalizeBorrowerPhone(null)).toBeNull();
  });

  it("matches legacy stored phone formats when resolving a duplicate", () => {
    expect(matchesBorrowerAuthIdentity({ phone: "260979943293" }, "new@example.test", "0979943293")).toBe(true);
    expect(matchesBorrowerAuthIdentity({ phone: "0979943293" }, "new@example.test", "+260979943293")).toBe(true);
  });

  it("only classifies actual duplicate-user errors as duplicates", () => {
    expect(isDuplicateBorrowerAuthError({ message: "Phone number already registered" })).toBe(true);
    expect(isDuplicateBorrowerAuthError({ code: "email_exists" })).toBe(true);
    expect(isDuplicateBorrowerAuthError({ message: "Phone number is invalid" })).toBe(false);
  });

  it("blocks production Supabase from mutation-based integration tests", () => {
    expect(isProductionSupabaseUrl("https://seobilifwyxhtjvsgqpc.supabase.co")).toBe(true);
    expect(isProductionSupabaseUrl("https://uat-branch.supabase.co")).toBe(false);
    expect(isProductionSupabaseUrl(undefined)).toBe(false);
  });
});
