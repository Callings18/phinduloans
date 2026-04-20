import { supabase } from "@/integrations/supabase/client";

export async function fetchHouseProductByCode(productCode: string) {
  const { data, error } = await supabase
    .from("loan_products")
    .select("id, name, product_code, interest_rate, is_active")
    .eq("product_code", productCode)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchHouseLoans(productCode: string) {
  const product = await fetchHouseProductByCode(productCode);
  if (!product?.id) return [];
  const { data, error } = await supabase
    .from("loan_applications")
    .select("*")
    .eq("loan_product_id", product.id)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data ?? [];
}

export async function fetchHouseBorrowers(productCode: string) {
  const { data: memberships, error: membershipError } = await (supabase.from as any)("product_house_borrowers")
    .select("borrower_id")
    .eq("product_code", productCode)
    .order("created_at", { ascending: false })
    .limit(500);

  if (membershipError) throw membershipError;

  const userIds = Array.from(new Set((memberships ?? []).map((row: any) => row.borrower_id).filter(Boolean)));
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, city, nrc_number")
    .in("id", userIds);
  if (error) throw error;
  const borrowerMap = new Map((data ?? []).map((profile: any) => [profile.id, profile]));
  return userIds.map((id) => borrowerMap.get(id)).filter(Boolean);
}

export async function fetchHouseRepayments(productCode: string) {
  const loans = await fetchHouseLoans(productCode);
  const loanIds = Array.from(new Set((loans || []).map((l: any) => l.id)));
  if (loanIds.length === 0) return [];
  const { data, error } = await supabase
    .from("loan_repayments")
    .select("*")
    .in("loan_id", loanIds)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchHouseDisbursements(productCode: string) {
  const loans = await fetchHouseLoans(productCode);
  const loanIds = Array.from(new Set((loans || []).map((l: any) => l.id)));
  if (loanIds.length === 0) return [];
  const { data, error } = await supabase
    .from("disbursements")
    .select("*")
    .in("loan_id", loanIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchHouseReportSummary(productCode: string) {
  const [loans, repayments, disbursements] = await Promise.all([
    fetchHouseLoans(productCode),
    fetchHouseRepayments(productCode),
    fetchHouseDisbursements(productCode),
  ]);
  const totalLoans = loans.length;
  const activeLoans = loans.filter((l: any) => ["active", "disbursed"].includes(l.status)).length;
  const overdue = repayments.filter((r: any) => r.status !== "paid" && new Date(r.due_date) < new Date()).length;
  const disbursed = disbursements
    .filter((d: any) => d.status === "completed")
    .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
  return { totalLoans, activeLoans, overdue, totalDisbursed: disbursed };
}
