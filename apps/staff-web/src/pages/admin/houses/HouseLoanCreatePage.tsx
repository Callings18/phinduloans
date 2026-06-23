import { Navigate, useParams } from "react-router-dom";
import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";
import type { LoanProductCode } from "@phinduloans/shared/config/loanProductModules";

const houseCreateConfig: Record<string, { title: string; description: string; termUnit: "days" | "weeks" | "months"; defaultTermValue: number }> = {
  SALARY_ADVANCE: { title: "Create Salary Advance", description: "Fast salary-backed lending workflow.", termUnit: "months", defaultTermValue: 1 },
  SALARY_ADVANCE_STAFF: {
    title: "Create Staff Salary Advance",
    description: "Salary-backed lending for eligible internal staff.",
    termUnit: "months",
    defaultTermValue: 1,
  },
  PAYDAY_SOFT: { title: "Create Payday Soft Loan", description: "Short-tenor payroll cycle lending.", termUnit: "days", defaultTermValue: 30 },
  COLLATERAL: { title: "Create Collateral Loan", description: "Collateral-secured lending workflow.", termUnit: "months", defaultTermValue: 1 },
  BUSINESS: { title: "Create Business Loan", description: "Working capital and business growth lending.", termUnit: "months", defaultTermValue: 12 },
  MOTOR_VEHICLE: { title: "Create Motor Vehicle Loan", description: "Vehicle-backed lending with structured terms.", termUnit: "months", defaultTermValue: 24 },
  MARKETEER: { title: "Create Marketeer Loan", description: "Fixed daily-collection workflow at 30% over 26 days (Sundays excluded).", termUnit: "days", defaultTermValue: 26 },
};

export default function HouseLoanCreatePage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const code = productCode.toUpperCase();
  if (!code) return <Navigate to="/admin" replace />;
  // Use hard-coded config for legacy products, otherwise sensible defaults for custom products
  const cfg = houseCreateConfig[code] ?? {
    title: `Create ${code.replace(/_/g, " ")} Loan`,
    description: "Custom loan product workflow.",
    termUnit: "months" as const,
    defaultTermValue: 12,
  };
  return (
    <ProductLoanFormShell
      productCode={code as LoanProductCode}
      title={cfg.title}
      description={cfg.description}
      termUnit={cfg.termUnit}
      defaultTermValue={cfg.defaultTermValue}
      showChecklist={false}
      successRedirectPath={`/admin/houses/${code}/loans`}
    />
  );
}
