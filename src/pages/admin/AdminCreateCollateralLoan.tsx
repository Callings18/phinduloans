import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";

export default function AdminCreateCollateralLoan() {
  return (
    <ProductLoanFormShell
      productCode="COLLATERAL"
      title="Create Collateral Based Loan"
      description="Collateral-first flow with physical asset capture requirements."
      termUnit="months"
      defaultTermValue={3}
    />
  );
}
