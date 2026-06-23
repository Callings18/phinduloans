import { describe, expect, it } from "vitest";
import {
  borrowerDashboardHrefFromLegacyProfileTab,
  borrowerDashboardProfileHref,
} from "./borrowerDashboardLinks";

describe("borrowerDashboardProfileHref", () => {
  it("defaults to profile tab", () => {
    expect(borrowerDashboardProfileHref()).toBe("/dashboard?tab=profile");
  });

  it("opens KYC workspace", () => {
    expect(borrowerDashboardProfileHref({ openKycWorkspace: true })).toBe(
      "/dashboard?tab=profile&kyc=documents",
    );
  });

  it("deep-links security section", () => {
    expect(borrowerDashboardProfileHref({ profileSection: "security" })).toBe(
      "/dashboard?tab=profile&profileSection=security",
    );
  });
});

describe("borrowerDashboardHrefFromLegacyProfileTab", () => {
  it("maps legacy kyc tabs to workspace", () => {
    expect(borrowerDashboardHrefFromLegacyProfileTab("kyc")).toBe(
      "/dashboard?tab=profile&kyc=documents",
    );
    expect(borrowerDashboardHrefFromLegacyProfileTab("documents")).toBe(
      "/dashboard?tab=profile&kyc=documents",
    );
  });

  it("maps legacy security and notifications", () => {
    expect(borrowerDashboardHrefFromLegacyProfileTab("security")).toBe(
      "/dashboard?tab=profile&profileSection=security",
    );
    expect(borrowerDashboardHrefFromLegacyProfileTab("notifications")).toBe(
      "/dashboard?tab=profile&profileSection=notifications",
    );
  });
});
