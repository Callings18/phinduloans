import { describe, expect, it } from "vitest";
import {
  calculateMarketeerLoan,
  generateMarketeerCollectionDates,
  getMarketeerTiersOrDefault,
  MARKETEER_COLLECTION_DAYS,
  MARKETEER_FIXED_INTEREST_PERCENT,
} from "../marketeerCalculations";

const sampleTiers = getMarketeerTiersOrDefault(null);

describe("calculateMarketeerLoan", () => {
  it("uses fixed terms: K1,000 at 30% for 26 days", () => {
    const r = calculateMarketeerLoan(1000, sampleTiers);
    expect(r).not.toBeNull();
    expect(r!.durationDays).toBe(MARKETEER_COLLECTION_DAYS);
    expect(r!.tier.interestPercent).toBe(MARKETEER_FIXED_INTEREST_PERCENT);
    expect(r!.totalRepayment).toBe(1300);
    expect(r!.dailyInstallment).toBe(50);
  });

  it("uses fixed terms for higher principal bands too", () => {
    const r = calculateMarketeerLoan(6000, sampleTiers);
    expect(r).not.toBeNull();
    expect(r!.durationDays).toBe(MARKETEER_COLLECTION_DAYS);
    expect(r!.totalRepayment).toBe(7800);
    expect(r!.dailyInstallment).toBe(300);
  });

  it("returns null outside configured principal floor", () => {
    expect(calculateMarketeerLoan(500, sampleTiers)).toBeNull();
  });
});

describe("generateMarketeerCollectionDates", () => {
  it("skips Sundays and returns 26 collection dates", () => {
    const start = new Date("2026-04-13T00:00:00.000Z"); // Monday
    const dates = generateMarketeerCollectionDates(start, MARKETEER_COLLECTION_DAYS);
    expect(dates).toHaveLength(MARKETEER_COLLECTION_DAYS);
    expect(dates.every((d) => d.getDay() !== 0)).toBe(true);
  });
});
