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
  housePath: string;
  betaKey: string;
}

export const LOAN_PRODUCT_MODULES: LoanProductModuleDefinition[] = [
  {
    code: "SALARY_ADVANCE",
    name: "Salary Advance",
    createPath: "/admin/loans/create/salary-advance",
    housePath: "/admin/houses/SALARY_ADVANCE",
    betaKey: "loan_create_salary_advance",
  },
  {
    code: "PAYDAY_SOFT",
    name: "Payday Soft",
    createPath: "/admin/loans/create/payday-soft",
    housePath: "/admin/houses/PAYDAY_SOFT",
    betaKey: "loan_create_payday_soft",
  },
  {
    code: "COLLATERAL",
    name: "Collateral Loan",
    createPath: "/admin/loans/create/collateral",
    housePath: "/admin/houses/COLLATERAL",
    betaKey: "loan_create_collateral",
  },
  {
    code: "BUSINESS",
    name: "Business Loan",
    createPath: "/admin/loans/create/business",
    housePath: "/admin/houses/BUSINESS",
    betaKey: "loan_create_business",
  },
  {
    code: "MOTOR_VEHICLE",
    name: "Motor Vehicle Loan",
    createPath: "/admin/loans/create/motor-vehicle",
    housePath: "/admin/houses/MOTOR_VEHICLE",
    betaKey: "loan_create_motor_vehicle",
  },
  {
    code: "MARKETEER",
    name: "Marketeer Loan",
    createPath: "/admin/loans/create/marketeer",
    housePath: "/admin/houses/MARKETEER",
    betaKey: "marketeer",
  },
];
