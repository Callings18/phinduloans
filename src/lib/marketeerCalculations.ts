export interface MarketeerTier {
  minPrincipal: number;
  maxPrincipal: number;
  interestPercent: number;
  durationDays: number;
}

export function parseMarketeerTiers(raw: unknown): MarketeerTier[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: MarketeerTier[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const minPrincipal = Number(r.minPrincipal);
    const maxPrincipal = Number(r.maxPrincipal);
    const interestPercent = Number(r.interestPercent);
    const durationDays = Number(r.durationDays);
    if ([minPrincipal, maxPrincipal, interestPercent, durationDays].some((n) => Number.isNaN(n) || n <= 0)) continue;
    out.push({ minPrincipal, maxPrincipal, interestPercent, durationDays });
  }
  return out.sort((a, b) => a.minPrincipal - b.minPrincipal);
}

export function resolveMarketeerTier(principal: number, tiers: MarketeerTier[]): MarketeerTier | null {
  if (principal <= 0 || tiers.length === 0) return null;
  for (const t of tiers) {
    if (principal >= t.minPrincipal && principal <= t.maxPrincipal) return t;
  }
  return null;
}

export interface MarketeerCalculationResult {
  principal: number;
  tier: MarketeerTier;
  totalInterest: number;
  totalRepayment: number;
  dailyInstallment: number;
  durationDays: number;
}

/**
 * Flat fee: total interest = principal × tier.interestPercent / 100.
 * Daily installment = totalRepayment / durationDays (aligned with Phindu examples).
 */
export function calculateMarketeerLoan(principal: number, tiers: MarketeerTier[]): MarketeerCalculationResult | null {
  const tier = resolveMarketeerTier(principal, tiers);
  if (!tier) return null;
  const totalInterest = Math.round(principal * (tier.interestPercent / 100) * 100) / 100;
  const totalRepayment = Math.round((principal + totalInterest) * 100) / 100;
  const dailyInstallment = Math.round((totalRepayment / tier.durationDays) * 100) / 100;
  return {
    principal,
    tier,
    totalInterest,
    totalRepayment,
    dailyInstallment,
    durationDays: tier.durationDays,
  };
}
