import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getBorrowerOAuthRedirectUrl, isBorrowerGoogleOAuthEnabled } from "../src/config/borrowerOAuth";

describe("borrowerOAuth", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_BORROWER_APP_URL", "https://app.phindu.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds redirect URL with optional next path", () => {
    expect(getBorrowerOAuthRedirectUrl()).toBe("https://app.phindu.com/auth");
    expect(getBorrowerOAuthRedirectUrl("/dashboard")).toBe("https://app.phindu.com/auth?next=%2Fdashboard");
  });

  it("reads Google OAuth enabled flag", () => {
    vi.stubEnv("VITE_BORROWER_GOOGLE_OAUTH_ENABLED", "true");
    expect(isBorrowerGoogleOAuthEnabled()).toBe(true);
    vi.stubEnv("VITE_BORROWER_GOOGLE_OAUTH_ENABLED", "false");
    expect(isBorrowerGoogleOAuthEnabled()).toBe(false);
  });
});
