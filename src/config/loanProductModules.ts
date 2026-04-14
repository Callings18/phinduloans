export type LoanProductCode =
  | "SALARY_ADVANCE"
  | "PAYDAY_SOFT"
  | "COLLATERAL"
  | "BUSINESS"
  | "MOTOR_VEHICLE"
  | "MARKETEER";

export interface LoanProductModuleDefinition {
  code: LoanProductCode;
  name: string;
  createPath: string;
  betaKey: string;
}

export const LOAN_PRODUCT_MODULES: LoanProductModuleDefinition[] = [
  {
    code: "SALARY_ADVANCE",
    name: "Salary Advance",
    createPath: "/admin/loans/create/salary-advance",
    betaKey: "loan_create_salary_advance",
  },
  {
    code: "PAYDAY_SOFT",
    name: "Payday Soft",
    createPath: "/admin/loans/create/payday-soft",
    betaKey: "loan_create_payday_soft",
  },
  {
    code: "COLLATERAL",
    name: "Collateral Loan",
    createPath: "/admin/loans/create/collateral",
    betaKey: "loan_create_collateral",
  },
  {
    code: "BUSINESS",
    name: "Business Loan",
    createPath: "/admin/loans/create/business",
    betaKey: "loan_create_business",
  },
  {
    code: "MOTOR_VEHICLE",
    name: "Motor Vehicle Loan",
    createPath: "/admin/loans/create/motor-vehicle",
    betaKey: "loan_create_motor_vehicle",
  },
  {
    code: "MARKETEER",
    name: "Marketeer Loan",
    createPath: "/admin/loans/create/marketeer",
    betaKey: "marketeer",
  },
];
