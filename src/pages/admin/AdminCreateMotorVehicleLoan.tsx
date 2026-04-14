import ProductLoanFormShell from "@/components/admin/ProductLoanFormShell";

export default function AdminCreateMotorVehicleLoan() {
  return (
    <ProductLoanFormShell
      productCode="MOTOR_VEHICLE"
      title="Create Motor Vehicle Loan"
      description="Vehicle financing flow with insurance and title-control review requirements."
      termUnit="months"
      defaultTermValue={12}
    />
  );
}
