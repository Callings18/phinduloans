export interface MarketeerTier {
  minPrincipal: number;
  maxPrincipal: number;
  interestPercent: number;
  durationDays: number;
}

export const MARKETEER_FIXED_INTEREST_PERCENT = 30;
export const MARKETEER_COLLECTION_DAYS = 26;

export const MARKETEER_DEFAULT_TIERS: MarketeerTier[] = [
  {
    minPrincipal: 1000,
    maxPrincipal: 1000000000,
    interestPercent: MARKETEER_FIXED_INTEREST_PERCENT,
    durationDays: MARKETEER_COLLECTION_DAYS,
  },
];

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

export function getMarketeerTiersOrDefault(raw: unknown, productMinAmount?: number | null, productMaxAmount?: number | null): MarketeerTier[] {
  const parsed = parseMarketeerTiers(raw);
  const tiers = parsed.length > 0 ? parsed : MARKETEER_DEFAULT_TIERS;
  const minAmount = Number(productMinAmount || 0);
  const maxAmount = Number(productMaxAmount || 0);
  return tiers.map((tier, index) => ({
    ...tier,
    minPrincipal: index === 0 && minAmount > 0 ? Math.min(tier.minPrincipal, minAmount) : tier.minPrincipal,
    maxPrincipal: maxAmount > 0 ? Math.min(tier.maxPrincipal, maxAmount) : tier.maxPrincipal,
  }));
}

/**
 * Advance a date forward until it lands on a collection day (Mon–Sat).
 * Sundays are skipped — no loan collections on Sundays.
 */
export function skipSundays(date: Date): Date {
  const d = new Date(date);
  while (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Generate collection dates excluding Sundays (0).
 * Marketeer loans collect Monday–Saturday.
 */
export function generateMarketeerCollectionDates(startDate: Date, collectionDays: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(startDate);

  while (dates.length < collectionDays) {
    if (cursor.getDay() !== 0) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
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
