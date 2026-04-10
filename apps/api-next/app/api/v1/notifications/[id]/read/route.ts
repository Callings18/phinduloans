import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-context";
import { HttpError, toErrorResponse } from "@/lib/http-errors";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { id } = await params;
    const { data: notification, error: readErr } = await supabaseAdmin
      .from("notification_logs")
      .select("id, user_id")
      .eq("id", id)
      .single();
    if (readErr || !notification) throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
    if (notification.user_id !== auth.userId) {
      throw new HttpError(403, "FORBIDDEN", "Cannot mark another user's notification as read");
    }

    const { error } = await supabaseAdmin.from("notification_logs").update({ status: "read" }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true, data: { id, status: "read" } });
  } catch (error) {
    const out = toErrorResponse(error);
    return NextResponse.json(out.body, { status: out.status });
  }
}
