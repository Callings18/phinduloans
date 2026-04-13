/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_API_URL?: string;
  readonly VITE_API_LOAN_PRODUCTS?: string;
  readonly VITE_API_PHASE1_WORKFLOW?: string;
  readonly VITE_DEV_SUPPORT_WHATSAPP?: string;
  /** Comma-separated beta module keys (e.g. loans_by_product,product_dashboards,marketeer) */
  readonly VITE_BETA_MODULES?: string;
}
