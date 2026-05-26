import { Navigate, useParams } from "react-router-dom";
import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";
import type { LoanProductCode } from "@/config/loanProductModules";

const houseEditConfig: Record<string, { title: string; description: string; termUnit: "days" | "weeks" | "months"; defaultTermValue: number }> = {
  SALARY_ADVANCE: { title: "Create Salary Advance", description: "Edit this salary-backed loan application.", termUnit: "months", defaultTermValue: 1 },
  SALARY_ADVANCE_STAFF: { title: "Create Staff Salary Advance", description: "Edit this staff salary advance.", termUnit: "months", defaultTermValue: 1 },
  PAYDAY_SOFT: { title: "Create Payday Soft Loan", description: "Edit this payday loan.", termUnit: "days", defaultTermValue: 30 },
  COLLATERAL: { title: "Create Collateral Loan", description: "Edit this collateral loan, borrowers and documents.", termUnit: "months", defaultTermValue: 6 },
  BUSINESS: { title: "Create Business Loan", description: "Edit this business loan.", termUnit: "months", defaultTermValue: 12 },
  MOTOR_VEHICLE: { title: "Create Motor Vehicle Loan", description: "Edit this motor vehicle loan.", termUnit: "months", defaultTermValue: 24 },
  MARKETEER: { title: "Create Marketeer Loan", description: "Edit this marketeer loan.", termUnit: "days", defaultTermValue: 26 },
};

export default function HouseLoanEditPage() {
  const { productCode = "", loanId = "" } = useParams<{ productCode: string; loanId: string }>();
  const code = productCode.toUpperCase();
  if (!code || !loanId) return <Navigate to="/admin" replace />;
  const cfg = houseEditConfig[code] ?? {
    title: `Edit ${code.replace(/_/g, " ")} Loan`,
    description: "Edit this custom loan product application.",
    termUnit: "months" as const,
    defaultTermValue: 12,
  };
  return (
    <ProductLoanFormShell
      productCode={code}
      title={cfg.title}
      description={cfg.description}
      termUnit={cfg.termUnit}
      defaultTermValue={cfg.defaultTermValue}
      showChecklist={false}
      successRedirectPath={`/admin/houses/${code}/loans/${loanId}`}
      editLoanId={loanId}
    />
  );
}
