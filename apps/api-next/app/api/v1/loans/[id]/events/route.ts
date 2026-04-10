import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-context";
import { HttpError, toErrorResponse } from "@/lib/http-errors";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { id: loanId } = await params;
    const scope = req.nextUrl.searchParams.get("scope") ?? (auth.actorType === "admin" ? "admin" : "borrower");

    const { data: loan, error: loanErr } = await supabaseAdmin
      .from("loan_applications")
      .select("id, user_id")
      .eq("id", loanId)
      .single();
    if (loanErr || !loan) throw new HttpError(404, "LOAN_NOT_FOUND", "Loan application not found");

    if (auth.actorType !== "admin" && loan.user_id !== auth.userId) {
      throw new HttpError(403, "FORBIDDEN", "You cannot view events for this loan");
    }

    const { data: events, error } = await supabaseAdmin
      .from("loan_events")
      .select("*")
      .eq("loan_id", loanId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const filtered =
      scope === "admin"
        ? events ?? []
        : (events ?? []).filter((e) => {
            const visibility = (e.previous_values as Record<string, unknown> | null)?.visibility;
            return visibility !== "admin";
          });

    return NextResponse.json({ ok: true, data: filtered });
  } catch (error) {
    const out = toErrorResponse(error);
    return NextResponse.json(out.body, { status: out.status });
  }
}
