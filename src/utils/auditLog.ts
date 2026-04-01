import { supabase } from "@/integrations/supabase/client";
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

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, any>
) {
  return logAuditEvent({ action, entityType, entityId, details });
}

export function handleUnauthorized(message?: string) {
  toast.error(message || "You do not have permission to perform this action");
}
