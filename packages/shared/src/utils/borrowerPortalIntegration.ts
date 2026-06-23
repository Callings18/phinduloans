import type { LoanProductCode } from "@phinduloans/shared/config/loanProductModules";

/** Products borrowers may apply for via the self-service portal. */
export function isBorrowerPortalProduct(product: {
  channels?: string[] | null;
  is_active?: boolean | null;
}): boolean {
  if (product.is_active === false) return false;
  const channels = product.channels ?? ["website", "admin"];
  return channels.includes("website");
}

export function loanApplicationSourceLabel(source: string | null | undefined): string {
  switch ((source || "").toLowerCase()) {
    case "dashboard":
    case "website":
      return "Borrower Portal";
    case "internal":
      return "Staff Created";
    case "referral":
      return "Referral";
    default:
      return source ? source.replace(/_/g, " ") : "Unknown";
  }
}

export function isPortalSourcedApplication(source: string | null | undefined): boolean {
  const s = (source || "").toLowerCase();
  return s === "dashboard" || s === "website";
}

export function asLoanProductCode(code: string | null | undefined): LoanProductCode | null {
  const normalized = (code || "").toUpperCase();
  const valid: LoanProductCode[] = [
    "SALARY_ADVANCE",
    "SALARY_ADVANCE_STAFF",
    "PAYDAY_SOFT",
    "COLLATERAL",
    "BUSINESS",
    "MOTOR_VEHICLE",
    "MARKETEER",
  ];
  return valid.includes(normalized as LoanProductCode) ? (normalized as LoanProductCode) : null;
}
