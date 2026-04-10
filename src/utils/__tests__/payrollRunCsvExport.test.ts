import { describe, expect, it } from "vitest";
import { buildPayrollRunCsv } from "@/utils/payrollRunCsvExport";

describe("buildPayrollRunCsv", () => {
  it("includes header, employee rows, and totals row", () => {
    const csv = buildPayrollRunCsv(
      { payroll_month: 1, payroll_year: 2026, status: "draft" },
      [
        {
          employees: { full_name: "Alice", department: "Ops" },
          basic_salary: 10000,
          housing_allowance: 500,
          gross_pay: 12000,
          paye_tax: 100,
          nhima_employee: 50,
          napsa_employee: 200,
          net_pay: 11000,
          total_employer_cost: 13000,
        },
        {
          employees: { full_name: "Bob", department: "Finance" },
          basic_salary: 8000,
          gross_pay: 9000,
          paye_tax: 80,
          nhima_employee: 40,
          napsa_employee: 150,
          net_pay: 8200,
          total_employer_cost: 9500,
        },
      ],
    );

    expect(csv).toContain("Payroll run: January 2026 (draft)");
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
    expect(csv).toContain("TOTALS");
    expect(csv).toContain("21000.00"); // sum gross (12000 + 9000)
    expect(csv).toContain("19200.00"); // sum net (11000 + 8200)
  });
});
