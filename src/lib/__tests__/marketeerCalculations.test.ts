import { describe, expect, it } from "vitest";
import { calculateMarketeerLoan, parseMarketeerTiers } from "../marketeerCalculations";

const sampleTiers = parseMarketeerTiers([
  { minPrincipal: 1000, maxPrincipal: 5000, interestPercent: 30, durationDays: 10 },
  { minPrincipal: 5001, maxPrincipal: 10000, interestPercent: 20, durationDays: 15 },
]);

describe("calculateMarketeerLoan", () => {
  it("matches K1,000 example: K130 daily for 10 days", () => {
    const r = calculateMarketeerLoan(1000, sampleTiers);
    expect(r).not.toBeNull();
    expect(r!.dailyInstallment).toBe(130);
    expect(r!.durationDays).toBe(10);
    expect(r!.totalRepayment).toBe(1300);
  });

  it("matches K6,000 example: K480 daily for 15 days", () => {
    const r = calculateMarketeerLoan(6000, sampleTiers);
    expect(r).not.toBeNull();
    expect(r!.dailyInstallment).toBe(480);
    expect(r!.durationDays).toBe(15);
    expect(r!.totalRepayment).toBe(7200);
  });

  it("returns null outside bands", () => {
    expect(calculateMarketeerLoan(500, sampleTiers)).toBeNull();
    expect(calculateMarketeerLoan(20000, sampleTiers)).toBeNull();
  });
});
