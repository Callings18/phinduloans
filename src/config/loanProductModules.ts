export type LoanProductCode =
  | "SALARY_ADVANCE"
  | "SALARY_ADVANCE_STAFF"
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
  enabled: boolean;
}

export const LOAN_PRODUCT_MODULES: LoanProductModuleDefinition[] = [
  {
    code: "SALARY_ADVANCE",
    name: "Salary Advance",
    createPath: "/admin/houses/SALARY_ADVANCE/loans/create",
    housePath: "/admin/houses/SALARY_ADVANCE",
    betaKey: "loan_create_salary_advance",
    enabled: true,
  },
  {
    code: "SALARY_ADVANCE_STAFF",
    name: "Staff Salary Advance",
    createPath: "/admin/houses/SALARY_ADVANCE_STAFF/loans/create",
    housePath: "/admin/houses/SALARY_ADVANCE_STAFF",
    betaKey: "loan_create_salary_advance_staff",
    enabled: false,
  },
  {
    code: "PAYDAY_SOFT",
    name: "Payday Soft",
    createPath: "/admin/houses/PAYDAY_SOFT/loans/create",
    housePath: "/admin/houses/PAYDAY_SOFT",
    betaKey: "loan_create_payday_soft",
    enabled: false,
  },
  {
    code: "COLLATERAL",
    name: "Collateral Loan",
    createPath: "/admin/houses/COLLATERAL/loans/create",
    housePath: "/admin/houses/COLLATERAL",
    betaKey: "loan_create_collateral",
    enabled: false,
  },
  {
    code: "BUSINESS",
    name: "Business Loan",
    createPath: "/admin/houses/BUSINESS/loans/create",
    housePath: "/admin/houses/BUSINESS",
    betaKey: "loan_create_business",
    enabled: false,
  },
  {
    code: "MOTOR_VEHICLE",
    name: "Motor Vehicle Loan",
    createPath: "/admin/houses/MOTOR_VEHICLE/loans/create",
    housePath: "/admin/houses/MOTOR_VEHICLE",
    betaKey: "loan_create_motor_vehicle",
    enabled: false,
  },
  {
    code: "MARKETEER",
    name: "Marketeer Loan",
    createPath: "/admin/houses/MARKETEER/loans/create",
    housePath: "/admin/houses/MARKETEER",
    betaKey: "marketeer",
    enabled: true,
  },
];
