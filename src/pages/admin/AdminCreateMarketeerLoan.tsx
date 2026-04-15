import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";

export default function AdminCreateMarketeerLoan() {
  return (
    <ProductLoanFormShell
      productCode="MARKETEER"
      title="Create Marketeer Loan"
      description="Fixed daily-collection Marketeer flow at 30% over 26 days (Sundays excluded)."
      termUnit="days"
      defaultTermValue={26}
    />
  );
}
