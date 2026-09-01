/**
 * Strangler flags: route specific domains to the HTTP API instead of direct Supabase.
 * If `VITE_API_URL` is set (Railway / local Nest), core writes go to Nest automatically.
 */
function envBool(key: keyof ImportMetaEnv): boolean {
  const v = import.meta.env[key];
  return v === "true" || v === true;
}

function apiUrlConfigured(): boolean {
  const raw = import.meta.env.VITE_API_URL;
  return typeof raw === "string" && raw.trim().length > 0;
}

const useNestWrites = envBool("VITE_API_CORE_WRITES") || envBool("VITE_API_PHASE1_WORKFLOW") || apiUrlConfigured();

export const apiFeatureFlags = {
  loanProducts: envBool("VITE_API_LOAN_PRODUCTS") || useNestWrites,
  phase1Workflow: useNestWrites,
  coreWrites: useNestWrites,
} as const;
