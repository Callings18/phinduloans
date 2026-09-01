/**
 * Strangler flags: route specific domains to the HTTP API instead of direct Supabase.
 * Set in `.env`: `VITE_API_LOAN_PRODUCTS=true` and `VITE_API_URL` (defaults to
 * `http://localhost:3000`, the Nest `backend` service). Workflow routes live on Nest:
 * `/api/v1/loan-products`, loan transitions, payment claims, notifications.
 */
function envBool(key: keyof ImportMetaEnv): boolean {
  const v = import.meta.env[key];
  return v === "true" || v === true;
}

export const apiFeatureFlags = {
  loanProducts: envBool("VITE_API_LOAN_PRODUCTS"),
  phase1Workflow: envBool("VITE_API_PHASE1_WORKFLOW"),
} as const;
