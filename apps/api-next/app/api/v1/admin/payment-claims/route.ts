import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth-context";
import { toErrorResponse } from "@/lib/http-errors";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requireAdmin(auth);
    const status = req.nextUrl.searchParams.get("status") ?? "pending_review";

    const { data, error } = await supabaseAdmin
      .from("payment_claims")
      .select("id, loan_id, repayment_id, user_id, amount, reference, receipt_url, status, created_at, reviewed_at, reviewed_by, review_comment")
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (error) {
    const out = toErrorResponse(error);
    return NextResponse.json(out.body, { status: out.status });
  }
}
