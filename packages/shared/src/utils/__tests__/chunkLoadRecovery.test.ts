import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "../chunkLoadRecovery";

describe("chunkLoadRecovery", () => {
  it("detects Vite dynamic import failures", () => {
    expect(
      isChunkLoadError(
        new Error(
          "Failed to fetch dynamically imported module: https://office.phindu.com/assets/HouseLayout-abc.js",
        ),
      ),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
  });
});
