import { getBorrowerAppUrl } from "@phinduloans/shared/config/siteMode";

/**
 * Google OAuth is activated only when explicitly enabled at build time. The
 * borrower UI keeps the option visible as disabled until this is configured.
 * Turn on after Supabase Auth → Providers → Google is configured with valid
 * redirect URLs (e.g. https://app.phindu.com/auth).
 */
export function isBorrowerGoogleOAuthEnabled(): boolean {
  return String(import.meta.env.VITE_BORROWER_GOOGLE_OAUTH_ENABLED || "").toLowerCase() === "true";
}

/** OAuth callback URL — must be listed in Supabase Auth redirect allowlist. */
export function getBorrowerOAuthRedirectUrl(nextPath?: string | null): string {
  const params = new URLSearchParams();
  if (nextPath && nextPath.startsWith("/")) {
    params.set("next", nextPath);
  }
  const qs = params.toString();
  return `${getBorrowerAppUrl()}/auth${qs ? `?${qs}` : ""}`;
}

export const BORROWER_GOOGLE_SIGNUP_CONSENT_KEY = "borrower_google_signup_consent";
