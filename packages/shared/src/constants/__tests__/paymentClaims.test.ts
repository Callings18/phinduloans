import { describe, expect, it } from "vitest";
import {
  canSubmitNewPaymentClaim,
  getBorrowerPaymentClaimAction,
  isPaymentClaimPendingStatus,
} from "../paymentClaims";

describe("paymentClaims", () => {
  it("treats pending_review as blocking new claims", () => {
    expect(isPaymentClaimPendingStatus("pending_review")).toBe(true);
    expect(canSubmitNewPaymentClaim("pending_review")).toBe(false);
  });

  it("allows new claim after rejection", () => {
    expect(canSubmitNewPaymentClaim("rejected")).toBe(true);
  });

  it("allows first claim when no status", () => {
    expect(canSubmitNewPaymentClaim(undefined)).toBe(true);
  });

  it("allows update flow when staff requested more info", () => {
    expect(getBorrowerPaymentClaimAction("needs_more_info")).toBe("update");
    expect(canSubmitNewPaymentClaim("needs_more_info")).toBe(false);
  });
});
