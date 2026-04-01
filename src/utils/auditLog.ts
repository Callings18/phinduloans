import { supabase } from "@/integrations/supabase/client";

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
