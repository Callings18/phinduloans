/**
 * Strangler flags: route specific domains to the Nest API instead of Supabase.
 * Set in `.env`: `VITE_API_LOAN_PRODUCTS=true` and `VITE_API_URL=http://localhost:3000`
 */
function envBool(key: keyof ImportMetaEnv): boolean {
  const v = import.meta.env[key];
  return v === "true" || v === true;
}

export const apiFeatureFlags = {
  loanProducts: envBool("VITE_API_LOAN_PRODUCTS"),
  phase1Workflow: envBool("VITE_API_PHASE1_WORKFLOW"),
} as const;
