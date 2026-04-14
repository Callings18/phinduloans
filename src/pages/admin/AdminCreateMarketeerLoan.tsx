import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";

export default function AdminCreateMarketeerLoan() {
  return (
    <ProductLoanFormShell
      productCode="MARKETEER"
      title="Create Marketeer Loan"
      description="Daily-collection marketeer flow with tiered pricing and compliance checks."
      termUnit="days"
      defaultTermValue={10}
    />
  );
}
