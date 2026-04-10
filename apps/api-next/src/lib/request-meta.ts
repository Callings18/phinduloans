import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

export function getRequestId(req: NextRequest): string {
  return req.headers.get("x-request-id") ?? randomUUID();
}

export function getIdempotencyKey(req: NextRequest): string | null {
  return req.headers.get("idempotency-key");
}
