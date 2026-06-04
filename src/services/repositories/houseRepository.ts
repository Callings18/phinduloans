import { supabase } from "@/integrations/supabase/client";
import { startOfDay } from "date-fns";

type HouseProduct = {
  id: string;
  name: string;
  product_code: string;
  interest_rate: number | null;
  interest_period?: string | null;
  interest_type?: string | null;
  processing_fee_percent?: number | null;
  enforcement_fee_percent?: number | null;
  insurance_percent?: number | null;
  vat_percent?: number | null;
  platform_fee_percent?: number | null;
  legal_fee_percent?: number | null;
  legal_fee_deduction_mode?: string | null;
  min_amount?: number | null;
  max_amount?: number | null;
  term_unit?: string | null;
  repayment_frequency?: string | null;
  pricing_tiers?: unknown;
  eligible_locations?: string[] | null;
  is_active: boolean | null;
};

type HouseLoan = {
  id: string;
  user_id: string | null;
  loan_amount: number | null;
  status: string;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  nrc_number?: string | null;
  city?: string | null;
  total_repayment?: number | null;
  loan_term_months?: number | null;
  term_unit?: string | null;
};

type HouseRepayment = {
  status: string;
  due_date: string;
  amount: number | null;
};

type HouseDisbursement = {
  status: string;
  amount: number | null;
};

export async function fetchHouseProductByCode(productCode: string) {
  const normalizedProductCode = productCode.trim().toUpperCase();
  const { data, error } = await supabase
    .from("loan_products")
    .select("id, name, product_code, interest_rate, interest_period, interest_type, processing_fee_percent, enforcement_fee_percent, insurance_percent, vat_percent, platform_fee_percent, legal_fee_percent, legal_fee_deduction_mode, min_amount, max_amount, term_unit, repayment_frequency, pricing_tiers, eligible_locations, is_active")
    .eq("product_code", normalizedProductCode)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data?.[0] ?? null) as HouseProduct | null);
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
  return (data ?? []) as HouseLoan[];
}

export async function fetchHouseBorrowers(productCode: string) {
  const { data: memberships, error: membershipError } = await (supabase.from as any)("product_house_borrowers")
    .select("borrower_id")
    .eq("product_code", productCode)
    .order("created_at", { ascending: false })
    .limit(500);

  if (membershipError) throw membershipError;

  const userIds: string[] = Array.from(
    new Set(
      (memberships ?? [])
        .map((row: { borrower_id: unknown }) => row.borrower_id)
        .filter((borrowerId: unknown): borrowerId is string => typeof borrowerId === "string" && borrowerId.length > 0)
    )
  );
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, city, nrc_number")
    .in("id", userIds);
  if (error) throw error;
  const borrowerMap = new Map((data ?? []).map((profile) => [profile.id, profile]));
  return userIds.map((id) => borrowerMap.get(id)).filter(Boolean);
}

export async function fetchHouseRepayments(productCode: string) {
  const loans = await fetchHouseLoans(productCode);
  const loanIds = Array.from(new Set(loans.map((l) => l.id)));
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
  const loanIds = Array.from(new Set(loans.map((l) => l.id)));
  if (loanIds.length === 0) return [];
  const { data, error } = await supabase
    .from("disbursements")
    .select("*")
    .in("loan_id", loanIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchHouseExpenses(productCode: string) {
  const loans = await fetchHouseLoans(productCode);
  const loanIds = Array.from(new Set(loans.map((l) => l.id)));
  if (loanIds.length === 0) return [];
  const { data, error } = await supabase
    .from("expenses")
    .select("id, loan_id, amount, expense_date, status, expense_category")
    .in("loan_id", loanIds)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface HousesReportBundle {
  loans: HouseLoan[];
  repayments: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  disbursements: Array<Record<string, unknown>>;
}

/**
 * Fetch loans, repayments, expenses and disbursements across one or many houses
 * (product codes) in a few batched queries. A single code behaves like one house;
 * multiple codes aggregate across all of them.
 */
export async function fetchHousesReportBundle(productCodes: string[]): Promise<HousesReportBundle> {
  const empty: HousesReportBundle = { loans: [], repayments: [], expenses: [], disbursements: [] };
  const codes = Array.from(
    new Set((productCodes ?? []).map((c) => (c || "").trim().toUpperCase()).filter(Boolean)),
  );
  if (codes.length === 0) return empty;

  const { data: products, error: productError } = await supabase
    .from("loan_products")
    .select("id, product_code, is_active")
    .in("product_code", codes)
    .eq("is_active", true);
  if (productError) throw productError;

  const productIds = Array.from(new Set((products ?? []).map((p) => p.id).filter(Boolean)));
  if (productIds.length === 0) return empty;

  const { data: loanData, error: loanError } = await supabase
    .from("loan_applications")
    .select("*")
    .in("loan_product_id", productIds)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (loanError) throw loanError;
  const loans = (loanData ?? []) as HouseLoan[];

  const loanIds = Array.from(new Set(loans.map((l) => l.id)));
  if (loanIds.length === 0) return { ...empty, loans };

  const [repaymentsRes, expensesRes, disbursementsRes] = await Promise.all([
    supabase.from("loan_repayments").select("*").in("loan_id", loanIds).order("due_date", { ascending: true }),
    supabase
      .from("expenses")
      .select("id, loan_id, amount, expense_date, status, expense_category")
      .in("loan_id", loanIds)
      .order("expense_date", { ascending: false }),
    supabase.from("disbursements").select("*").in("loan_id", loanIds).order("created_at", { ascending: false }),
  ]);
  if (repaymentsRes.error) throw repaymentsRes.error;
  if (expensesRes.error) throw expensesRes.error;
  if (disbursementsRes.error) throw disbursementsRes.error;

  return {
    loans,
    repayments: (repaymentsRes.data ?? []) as Array<Record<string, unknown>>,
    expenses: (expensesRes.data ?? []) as Array<Record<string, unknown>>,
    disbursements: (disbursementsRes.data ?? []) as Array<Record<string, unknown>>,
  };
}

export async function fetchHouseReportSummary(productCode: string) {
  const [loans, repayments, disbursements] = await Promise.all([
    fetchHouseLoans(productCode),
    fetchHouseRepayments(productCode),
    fetchHouseDisbursements(productCode),
  ]);
  const totalLoans = loans.length;
  const activeLoans = loans.filter((l) => ["active", "disbursed"].includes(l.status)).length;
  const today = startOfDay(new Date());
  const overdue = (repayments as HouseRepayment[]).filter((r) => {
    if (r.status === "paid" || !r.due_date) return false;
    return startOfDay(new Date(r.due_date)) < today;
  }).length;
  const disbursed = disbursements
    .filter((d) => (d as HouseDisbursement).status === "completed")
    .reduce((sum, d) => sum + Number((d as HouseDisbursement).amount || 0), 0);
  return { totalLoans, activeLoans, overdue, totalDisbursed: disbursed };
}
