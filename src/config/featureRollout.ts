/**
 * UI rollout flags (Beta badges, staged features). Comma-separated keys in .env.
 * Example: VITE_BETA_MODULES=loans_by_product,product_dashboards,marketeer
 */
function parseCommaList(raw: string | undefined | boolean): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const betaKeys = new Set(parseCommaList(import.meta.env.VITE_BETA_MODULES));

export function isBetaModule(key: string): boolean {
  return betaKeys.has(key);
}

export function anyBetaModuleActive(): boolean {
  return betaKeys.size > 0;
}
