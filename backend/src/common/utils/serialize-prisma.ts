/** Duck-typing Prisma.Decimal / decimal.js without tight coupling to Prisma internals. */
function isDecimalLike(value: unknown): value is { toNumber: () => number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  );
}

/** Recursively convert Prisma `Decimal` values to numbers for JSON responses. */
export function decimalsToNumbers<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (isDecimalLike(value)) {
    return value.toNumber() as T;
  }
  if (value instanceof Date) {
    return value as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => decimalsToNumbers(v)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = decimalsToNumbers(v);
    }
    return out as T;
  }
  return value;
}
