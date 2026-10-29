/** Policy version bump when Terms or Privacy materially change. */
export const BORROWER_TERMS_POLICY_VERSION = "2026-01-17";

export function getMarketingTermsUrl(): string {
  const base = (import.meta.env.VITE_MARKETING_BASE_URL || "https://phindu.com").replace(/\/+$/, "");
  return `${base}/terms`;
}

export function getMarketingPrivacyUrl(): string {
  const base = (import.meta.env.VITE_MARKETING_BASE_URL || "https://phindu.com").replace(/\/+$/, "");
  return `${base}/privacy`;
}
