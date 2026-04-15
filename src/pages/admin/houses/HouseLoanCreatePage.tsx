import { Navigate, useParams } from "react-router-dom";
import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";
import type { LoanProductCode } from "@/config/loanProductModules";

const houseCreateConfig: Record<LoanProductCode, { title: string; description: string; termUnit: "days" | "weeks" | "months"; defaultTermValue: number }> = {
  SALARY_ADVANCE: { title: "Create Salary Advance", description: "Fast salary-backed lending workflow.", termUnit: "months", defaultTermValue: 1 },
  PAYDAY_SOFT: { title: "Create Payday Soft Loan", description: "Short-tenor payroll cycle lending.", termUnit: "days", defaultTermValue: 30 },
  COLLATERAL: { title: "Create Collateral Loan", description: "Collateral-secured lending workflow.", termUnit: "months", defaultTermValue: 6 },
  BUSINESS: { title: "Create Business Loan", description: "Working capital and business growth lending.", termUnit: "months", defaultTermValue: 12 },
  MOTOR_VEHICLE: { title: "Create Motor Vehicle Loan", description: "Vehicle-backed lending with structured terms.", termUnit: "months", defaultTermValue: 24 },
  MARKETEER: { title: "Create Marketeer Loan", description: "Fixed daily-collection workflow at 30% over 26 days (Sundays excluded).", termUnit: "days", defaultTermValue: 26 },
};

export default function HouseLoanCreatePage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const code = productCode as LoanProductCode;
  const cfg = houseCreateConfig[code];
  if (!cfg) return <Navigate to="/admin" replace />;
  return (
    <ProductLoanFormShell
      productCode={code}
      title={cfg.title}
      description={cfg.description}
      termUnit={cfg.termUnit}
      defaultTermValue={cfg.defaultTermValue}
      showChecklist={false}
      successRedirectPath={`/admin/houses/${code}/loans`}
    />
  );
}
