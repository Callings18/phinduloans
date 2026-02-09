/**
 * Audit log helper: insert critical actions into audit_logs.
 * Use after status updates, approve, disburse, product edit, etc.
 * Fire-and-forget; failures are non-blocking.
 */

import { supabase } from "@/integrations/supabase/client";

export type AuditPayload = {
  action: string;
  entity_type: string;
  entity_id: string;
  module?: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
};

let cachedIp: string | null = null;

async function getClientIp(): Promise<string | null> {
  if (cachedIp !== undefined) return cachedIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    cachedIp = data?.ip ?? null;
  } catch {
    cachedIp = null;
  }
  return cachedIp;
}

/**
 * Log an action to audit_logs. Does not throw; logs errors to console.
 */
export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ip = await getClientIp();
    const row = {
      user_id: user?.id ?? null,
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      module: payload.module ?? payload.entity_type,
      old_values: payload.old_values ?? null,
      new_values: payload.new_values ?? null,
      details: payload.details ?? null,
      ip_address: ip,
    };
    await supabase.from("audit_logs").insert(row);
  } catch (e) {
    console.warn("audit_log insert failed", e);
  }
}

/** Detect RLS/permission denial from Supabase error */
export function isPermissionError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  const msg = (e?.message ?? "").toLowerCase();
  return (
    e?.code === "42501" ||
    e?.code === "PGRST301" ||
    msg.includes("permission") ||
    msg.includes("policy") ||
    msg.includes("row-level security")
  );
}

/** Call from mutation onError: log unauthorized_attempt and show toast when error is permission-related */
export async function handleUnauthorized(
  error: unknown,
  context: { entity_type: string; entity_id: string; module?: string }
): Promise<boolean> {
  if (!isPermissionError(error)) return false;
  await logAudit({
    action: "unauthorized_attempt",
    entity_type: context.entity_type,
    entity_id: context.entity_id,
    module: context.module ?? context.entity_type,
    details: { message: (error as Error)?.message },
  });
  return true;
}
