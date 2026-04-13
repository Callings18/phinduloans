import type { Database } from "@/integrations/supabase/types";

type LoanRow = Database["public"]["Tables"]["loan_applications"]["Row"];
type ProductFreq = Pick<
  Database["public"]["Tables"]["loan_products"]["Row"],
  "repayment_frequency" | "interest_period"
>;

/** Loan row as returned by the borrower dashboard query (product join for frequency labels). */
export type BorrowerDashboardLoan = LoanRow & {
  loan_products?: ProductFreq | null;
};

export type BorrowerDashboardRepayment = Database["public"]["Tables"]["loan_repayments"]["Row"];
