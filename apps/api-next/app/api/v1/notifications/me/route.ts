import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-context";
import { toErrorResponse } from "@/lib/http-errors";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const { data, error } = await supabaseAdmin
      .from("notification_logs")
      .select("*")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (error) {
    const out = toErrorResponse(error);
    return NextResponse.json(out.body, { status: out.status });
  }
}
