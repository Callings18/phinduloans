import { describe, expect, it } from "vitest";
import {
  formatZambianMobileDisplay,
  isValidZambianMobile,
  parseZambianMobileInput,
} from "../src/utils/zambianPhone";

describe("zambianPhone", () => {
  it("parses and validates common mobile prefixes", () => {
    expect(parseZambianMobileInput("097 123 4567")).toBe("971234567");
    expect(isValidZambianMobile("971234567")).toBe(true);
    expect(isValidZambianMobile("881234567")).toBe(false);
  });

  it("formats display spacing", () => {
    expect(formatZambianMobileDisplay("971234567")).toBe("971 234 567");
  });
});
