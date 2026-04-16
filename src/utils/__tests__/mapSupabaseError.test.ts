import { describe, expect, it } from "vitest";
import { mapSupabaseError } from "../mapSupabaseError";

describe("mapSupabaseError", () => {
  it("maps RLS / permission denied", () => {
    expect(mapSupabaseError({ message: "new row violates row-level security policy", code: "42501" })).toMatch(
      /don't have permission/i,
    );
  });

  it("maps unique violation", () => {
    expect(mapSupabaseError({ message: "duplicate key value violates unique constraint", code: "23505" })).toMatch(
      /already exists/i,
    );
  });

  it("returns message when plain Error", () => {
    expect(mapSupabaseError(new Error("Custom failure"))).toBe("Custom failure");
  });
});
