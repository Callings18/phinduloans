import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { toErrorResponse } from "@/lib/http-errors";

const SORT_COLUMNS = ["name", "interest_rate", "min_amount"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function parseActive(raw: string | null): boolean {
  if (raw === null || raw === "") return true;
  const v = raw.toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const activeOnly = parseActive(sp.get("active"));

    const sortRaw = sp.get("sort") ?? "name";
    const sort: SortColumn = SORT_COLUMNS.includes(sortRaw as SortColumn)
      ? (sortRaw as SortColumn)
      : "name";

    const orderRaw = (sp.get("order") ?? "asc").toLowerCase();
    const ascending = orderRaw !== "desc";

    let query = supabaseAdmin.from("loan_products").select("*");
    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    query = query.order(sort, { ascending });

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    const out = toErrorResponse(error);
    return NextResponse.json(out.body, { status: out.status });
  }
}
