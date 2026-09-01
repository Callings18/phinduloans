/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_API_URL?: string;
  readonly VITE_API_LOAN_PRODUCTS?: string;
  readonly VITE_API_PHASE1_WORKFLOW?: string;
  readonly VITE_API_CORE_WRITES?: string;
  readonly VITE_DEV_SUPPORT_WHATSAPP?: string;
  /** Comma-separated beta module keys (e.g. loans_by_product,product_dashboards,marketeer) */
  readonly VITE_BETA_MODULES?: string;
  /** Optional Sentry DSN for client error reporting (`@sentry/react`). */
  readonly VITE_SENTRY_DSN?: string;
  /** Borrower PWA origin for cross-domain redirects. */
  readonly VITE_BORROWER_APP_URL?: string;
  /** Staff office origin for cross-domain redirects. */
  readonly VITE_OFFICE_BASE_URL?: string;
  /** Marketing site origin (defaults to https://phindu.com). */
  readonly VITE_MARKETING_BASE_URL?: string;
  /** Staff-web deploy mode: marketing (default) or office. */
  readonly VITE_SITE_MODE?: string;
}
