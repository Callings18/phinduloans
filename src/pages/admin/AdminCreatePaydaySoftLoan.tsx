import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";

export default function AdminCreatePaydaySoftLoan() {
  return (
    <ProductLoanFormShell
      productCode="PAYDAY_SOFT"
      title="Create Payday Soft Loan"
      description="Lusaka-only 30-day non-civil servant flow with home verification requirement."
      termUnit="days"
      defaultTermValue={30}
    />
  );
}
