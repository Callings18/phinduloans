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

/** Profile row as returned by the borrower dashboard `profiles` query (select *). */
export type BorrowerDashboardProfile = Database["public"]["Tables"]["profiles"]["Row"];

/** KYC info subset selected by the borrower dashboard query. */
export type BorrowerDashboardKycInfo = Pick<
  Database["public"]["Tables"]["borrower_kyc_info"]["Row"],
  | "is_verified"
  | "bank_name"
  | "bank_account_number"
  | "airtel_money_number"
  | "mtn_mobile_money_number"
  | "zamtel_kwacha_number"
>;
