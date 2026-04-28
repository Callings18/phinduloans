import { describe, it, expect } from "vitest";
import { LegacyDataFallback } from "../LegacyDataFallback";

/**
 * Smoke test: the project does not bundle @testing-library/react in CI, so we
 * verify the component is importable and is a valid React function component.
 * Runtime render coverage is exercised by the broader e2e/integration suite.
 *
 * Behaviour-level guarantees for the *data* helpers feeding this component
 * live in `src/utils/__tests__/legacyData.test.ts`.
 */
describe("<LegacyDataFallback> module surface", () => {
  it("is exported as a function component", () => {
    expect(typeof LegacyDataFallback).toBe("function");
  });

  it("accepts every supported variant without throwing during prop-time evaluation", () => {
    // Calling as a function (not rendering) is enough to exercise variant key
    // lookup logic — this catches missing variant entries at module load.
    const variants = ["missing", "incomplete", "empty", "unknown_status"] as const;
    for (const variant of variants) {
      expect(() => LegacyDataFallback({ variant })).not.toThrow();
    }
  });

  it("does not throw when called with no props", () => {
    expect(() => LegacyDataFallback({})).not.toThrow();
  });

  it("does not throw in compact mode", () => {
    expect(() => LegacyDataFallback({ compact: true, title: "Compact" })).not.toThrow();
  });
});
