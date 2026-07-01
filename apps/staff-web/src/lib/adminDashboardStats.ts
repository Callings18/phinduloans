import type { SupabaseClient } from "@supabase/supabase-js";
import { format, startOfDay } from "date-fns";

export type AdminDashboardStats = {
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  activeLoans: number;
  completedLoans: number;
  totalBorrowers: number;
  totalDisbursed: number;
  amountRecovered: number;
  outstandingBalance: number;
  overdueAmount: number;
  overdueCount: number;
  recentApplications: Record<string, unknown>[];
};

export async function fetchAdminDashboardStats(
  supabase: SupabaseClient,
  options: { loanProductId?: string | null }
): Promise<AdminDashboardStats> {
  const loanProductId = options.loanProductId || null;

  let appQuery = supabase
    .from("loan_applications")
    .select("id, full_name, phone, loan_amount, status, total_repayment, created_at, user_id, loan_product_id")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (loanProductId) {
    appQuery = appQuery.eq("loan_product_id", loanProductId);
  }

  const [applications, profiles, disbursementsBase, repaymentsBase] = await Promise.all([
    appQuery,
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("disbursements").select("amount, loan_id, status"),
    supabase
      .from("loan_repayments")
      .select("id, loan_id, amount, due_date, status, principal_paid, original_amount, penalty_amount, penalty_paid"),
  ]);

  if (applications.error) throw applications.error;
  if (profiles.error) throw profiles.error;
  if (disbursementsBase.error) throw disbursementsBase.error;
  if (repaymentsBase.error) throw repaymentsBase.error;

  const loans = (applications.data || []) as {
    id: string;
    full_name: string;
    phone: string;
    loan_amount: number;
    status: string;
    total_repayment: number | null;
    created_at: string;
    user_id: string;
    loan_product_id: string | null;
  }[];

  const loanIds = new Set(loans.map((l) => l.id));

  let completedDisbursements = (disbursementsBase.data || []).filter((d) => d.status === "completed");
  let allRepayments = repaymentsBase.data || [];

  if (loanProductId) {
    completedDisbursements = completedDisbursements.filter((d) => loanIds.has(d.loan_id));
    allRepayments = allRepayments.filter((r) => loanIds.has(r.loan_id));
  }

  const totalDisbursed = completedDisbursements.reduce((sum, d) => sum + Number(d.amount), 0);
  const activeLoans = loans.filter((l) => l.status === "active");
  const paidRepayments = allRepayments.filter((r) => r.status === "paid");
  const amountRecovered = paidRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
  const pendingRepayments = allRepayments.filter((r) => r.status === "pending");
  const outstandingBalance = pendingRepayments.reduce((sum, r) => sum + Number(r.amount), 0);

  const today = startOfDay(new Date());
  const overdueRepayments = pendingRepayments.filter((r) => new Date(r.due_date) < today);
  const overdueAmount = overdueRepayments.reduce((sum, r) => sum + Number(r.amount), 0);

  const distinctBorrowers = loanProductId ? new Set(loans.map((l) => l.user_id)).size : profiles.count || 0;

  return {
    totalApplications: loans.length,
    pendingApplications: loans.filter((l) => l.status === "pending").length,
    approvedApplications: loans.filter((l) => l.status === "approved").length,
    activeLoans: activeLoans.length,
    completedLoans: loans.filter((l) => l.status === "completed").length,
    totalBorrowers: distinctBorrowers,
    totalDisbursed,
    amountRecovered,
    outstandingBalance,
    overdueAmount,
    overdueCount: overdueRepayments.length,
    recentApplications: loans.slice(0, 6) as unknown as Record<string, unknown>[],
  };
}

export async function fetchAdminUpcomingPayments(
  supabase: SupabaseClient,
  options: { loanProductId?: string | null; daysAhead?: number; limit?: number }
) {
  const loanProductId = options.loanProductId || null;
  const daysAhead = options.daysAhead ?? 7;
  const limit = options.limit ?? 100;
  const today = new Date();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + daysAhead);

  // When a specific loan house is selected, resolve its loan ids first and
  // filter the repayments query server-side. Filtering client-side after a
  // capped fetch would silently drop that house's payments whenever they fall
  // outside the first `limit` rows ordered across every house.
  let loanIdFilter: string[] | null = null;
  if (loanProductId) {
    const { data: houseLoans, error: houseLoansError } = await supabase
      .from("loan_applications")
      .select("id")
      .eq("loan_product_id", loanProductId);
    if (houseLoansError) throw houseLoansError;
    loanIdFilter = (houseLoans ?? []).map((l: { id: string }) => l.id);
    // No loans for this house means there is nothing upcoming to show.
    if (loanIdFilter.length === 0) return [];
  }

  let query = supabase
    .from("loan_repayments")
    .select(`*, loan:loan_applications(id, full_name, phone, loan_amount, loan_product_id)`)
    .eq("status", "pending")
    .gte("due_date", format(today, "yyyy-MM-dd"))
    .lte("due_date", format(horizon, "yyyy-MM-dd"))
    .order("due_date", { ascending: true })
    .limit(limit);

  if (loanIdFilter) {
    query = query.in("loan_id", loanIdFilter);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}
