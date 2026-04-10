import { supabaseAdmin } from "@/lib/supabase-admin";

export async function triggerInAppNotification(input: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("notification_logs").insert({
    user_id: input.userId,
    title: input.title,
    message: input.message,
    type: input.type ?? "system",
    status: "unread",
    recipient: input.userId,
    provider_response: input.metadata ?? {},
  });

  if (error) {
    // Non-blocking side effect in Phase 1: don't fail main mutation path.
    console.warn("[notify] failed to insert notification", error.message);
  }
}
