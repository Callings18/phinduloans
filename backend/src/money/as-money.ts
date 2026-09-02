/**
 * ZMW is stored as numeric(12,2) in Postgres. New Nest money paths round to ngwee
 * (1/100 Kwacha) before write so float drift does not accumulate on those routes.
 */
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
