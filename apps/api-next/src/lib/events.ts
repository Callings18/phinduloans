import { supabaseAdmin } from "@/lib/supabase-admin";

export async function appendLoanEvent(input: {
  loanId: string;
  eventType: string;
  performedBy?: string;
  reason?: string | null;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  visibility?: "borrower" | "admin" | "both";
}) {
  const payload = {
    loan_id: input.loanId,
    event_type: input.eventType,
    performed_by: input.performedBy ?? null,
    reason: input.reason ?? null,
    previous_values: {
      ...(input.previousValues ?? {}),
      visibility: input.visibility ?? "both",
    },
    new_values: input.newValues ?? null,
  };
  const { error } = await supabaseAdmin.from("loan_events").insert(payload);
  if (error) throw error;
}
