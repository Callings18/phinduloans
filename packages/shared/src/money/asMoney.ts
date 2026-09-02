/** Round ZMW to 2 decimal places (ngwee). Use on client amounts before Nest posts. */
export function roundZmw(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Invalid money amount");
  }
  return Math.round(amount * 100) / 100;
}

export function zmwToNgwee(amount: number): bigint {
  return BigInt(Math.round(roundZmw(amount) * 100));
}

export function ngweeToZmw(ngwee: bigint): number {
  return Number(ngwee) / 100;
}
