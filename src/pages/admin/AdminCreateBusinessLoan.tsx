import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";

export default function AdminCreateBusinessLoan() {
  return (
    <ProductLoanFormShell
      productCode="BUSINESS"
      title="Create Business Loan"
      description="Business lending flow with financials, PACRA, tax clearance, and location proof."
      termUnit="months"
      defaultTermValue={12}
    />
  );
}
