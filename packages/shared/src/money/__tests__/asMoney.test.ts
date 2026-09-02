import { describe, expect, it } from "vitest";
import { ngweeToZmw, roundZmw, zmwToNgwee } from "../asMoney";

describe("roundZmw", () => {
  it("rounds half-up to two decimals for representable values", () => {
    expect(roundZmw(10.125)).toBe(10.13);
    expect(roundZmw(12.344)).toBe(12.34);
    expect(zmwToNgwee(12.34)).toBe(1234n);
    expect(ngweeToZmw(1234n)).toBe(12.34);
  });
});
