import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { toast } from "sonner";

export async function logAuditEvent({
  action,
  entityType,
  entityId,
  details,
  module,
  oldValues,
  newValues,
}: {
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  module?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details || null,
      module: module || null,
      old_values: oldValues || null,
      new_values: newValues || null,
      user_id: user?.id || null,
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

export async function logAudit(params: {
  action: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, any>;
  module?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
}) {
  return logAuditEvent({
    action: params.action,
    entityType: params.entity_type,
    entityId: params.entity_id,
    details: params.details,
    module: params.module,
    oldValues: params.old_values,
    newValues: params.new_values,
  });
}

export async function handleUnauthorized(
  error: any,
  context?: { entity_type?: string; entity_id?: string; module?: string }
): Promise<boolean> {
  const msg = error?.message || String(error);
  const isAuthError =
    msg.includes("permission") ||
    msg.includes("authorized") ||
    msg.includes("403") ||
    msg.includes("RLS");

  if (isAuthError) {
    toast.error("You do not have permission to perform this action");
    if (context) {
      await logAudit({
        action: "UNAUTHORIZED_ACCESS",
        entity_type: context.entity_type || "unknown",
        entity_id: context.entity_id || "unknown",
        module: context.module,
        details: { error: msg },
      });
    }
    return true;
  }
  return false;
}
