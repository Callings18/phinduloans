import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";

export default function AdminCreateSalaryAdvanceLoan() {
  return (
    <ProductLoanFormShell
      productCode="SALARY_ADVANCE"
      title="Create Salary Advance Loan"
      description="Civil-servant lending flow with payday date anchoring (23rd)."
      termUnit="months"
      defaultTermValue={1}
    />
  );
}
