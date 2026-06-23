import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { notificationService } from "@phinduloans/shared/utils/notificationService";

export async function notifyBorrowerDocumentRequest(
  userId: string,
  borrowerName: string,
  documentNames: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, email")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.phone) return;
  await notificationService.sendDocumentRequest(
    userId,
    borrowerName,
    documentNames,
    profile.phone,
    profile.email ?? undefined,
  );
}

export async function notifyBorrowerVisibleNote(
  userId: string,
  borrowerName: string,
  note: string,
) {
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
    message: `Hi ${borrowerName},\n\nUpdate on your loan application:\n\n${note}\n\nPlease check your borrower dashboard for details.\n\n- Phindu Finance`,
    subject: "Update on Your Loan Application",
    title: "Loan Application Update",
    eventType: "document_request",
  });
}
