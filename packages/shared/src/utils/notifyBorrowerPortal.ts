import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { notificationService } from "@phinduloans/shared/utils/notificationService";

const borrowerPortalBase = (import.meta.env.VITE_BORROWER_APP_URL || "").replace(/\/+$/, "");
function borrowerPortalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!borrowerPortalBase) return normalized;
  return `${borrowerPortalBase}${normalized}`;
}

async function insertBorrowerInboxNotification(input: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  actionUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  const { error } = await supabase.rpc("create_inbox_notification", {
    p_user_id: input.userId,
    p_title: input.title,
    p_message: input.message,
    p_type: input.type ?? "info",
    p_action_url: input.actionUrl ?? borrowerPortalUrl("/dashboard?tab=loans"),
    p_metadata: {},
    p_related_entity_type: input.relatedEntityType ?? null,
    p_related_entity_id: input.relatedEntityId ?? null,
  });
  if (error) {
    console.warn("Inbox notification insert failed:", error.message);
  }
}

export async function notifyBorrowerDocumentRequest(
  userId: string,
  borrowerName: string,
  documentNames: string,
  loanId?: string,
) {
  await insertBorrowerInboxNotification({
    userId,
    title: "Additional documents required",
    message: `Please upload: ${documentNames}`,
    type: "warning",
    actionUrl: borrowerPortalUrl("/dashboard?tab=loans"),
    relatedEntityType: loanId ? "loan_application" : undefined,
    relatedEntityId: loanId,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, email")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.phone) {
    await notificationService.sendDocumentRequest(
      userId,
      borrowerName,
      documentNames,
      profile.phone,
      profile.email ?? undefined,
    );
  }
}

export async function notifyBorrowerVisibleNote(
  userId: string,
  borrowerName: string,
  note: string,
  loanId?: string,
) {
  await insertBorrowerInboxNotification({
    userId,
    title: "Update on your loan application",
    message: note,
    type: "info",
    actionUrl: borrowerPortalUrl("/dashboard?tab=loans"),
    relatedEntityType: loanId ? "loan_application" : undefined,
    relatedEntityId: loanId,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, email")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.phone && !profile?.email) return;

  await notificationService.sendMultiChannel({
    userId,
    phone: profile.phone ?? undefined,
    email: profile.email ?? undefined,
    message: `Hi ${borrowerName},\n\nUpdate on your loan application:\n\n${note}\n\nPlease check your borrower dashboard for details: ${borrowerPortalUrl("/dashboard?tab=loans")}\n\n- Phindu Finance`,
    subject: "Update on Your Loan Application",
    title: "Loan Application Update",
    eventType: "document_request",
  });
}
