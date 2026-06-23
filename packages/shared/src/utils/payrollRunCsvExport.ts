import { getMonthName } from "@phinduloans/shared/utils/payrollCalculations";

function csvCell(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type PayrollRunCsvRecord = {
  employees?: { full_name?: string; department?: string | null };
  basic_salary?: number | null;
  housing_allowance?: number | null;
  transport_allowance?: number | null;
  lunch_allowance?: number | null;
  other_allowances?: number | null;
  commission_amount?: number | null;
  gross_pay?: number | null;
  paye_tax?: number | null;
  nhima_employee?: number | null;
  napsa_employee?: number | null;
  net_pay?: number | null;
  total_employer_cost?: number | null;
};

export function buildPayrollRunCsv(
  run: { payroll_month: number; payroll_year: number; status?: string | null },
  records: PayrollRunCsvRecord[],
): string {
  const header = [
    "Employee",
    "Department",
    "Basic",
    "Allowances",
    "Commission",
    "Gross",
    "PAYE",
    "NHIMA (employee)",
    "NAPSA (employee)",
    "Net pay",
    "Employer cost",
  ];

  const lines: string[] = [];
  const periodLabel = `${getMonthName(run.payroll_month)} ${run.payroll_year}`;
  lines.push(`Payroll run: ${periodLabel}${run.status ? ` (${run.status})` : ""}`);
  lines.push("");
  lines.push(header.map(csvCell).join(","));

  let sumBasic = 0;
  let sumAllow = 0;
  let sumComm = 0;
  let sumGross = 0;
  let sumPaye = 0;
  let sumNhima = 0;
  let sumNapsa = 0;
  let sumNet = 0;
  let sumEmpCost = 0;

  for (const rec of records) {
    const totalAllowances =
      Number(rec.housing_allowance || 0) +
      Number(rec.transport_allowance || 0) +
      Number(rec.lunch_allowance || 0) +
      Number(rec.other_allowances || 0);
    const basic = Number(rec.basic_salary || 0);
    const comm = Number(rec.commission_amount || 0);
    const gross = Number(rec.gross_pay || 0);
    const paye = Number(rec.paye_tax || 0);
    const nhima = Number(rec.nhima_employee || 0);
    const napsa = Number(rec.napsa_employee || 0);
    const net = Number(rec.net_pay || 0);
    const empCost = Number(rec.total_employer_cost || 0);

    sumBasic += basic;
    sumAllow += totalAllowances;
    sumComm += comm;
    sumGross += gross;
    sumPaye += paye;
    sumNhima += nhima;
    sumNapsa += napsa;
    sumNet += net;
    sumEmpCost += empCost;

    lines.push(
      [
        rec.employees?.full_name ?? "",
        rec.employees?.department ?? "",
        basic.toFixed(2),
        totalAllowances.toFixed(2),
        comm.toFixed(2),
        gross.toFixed(2),
        paye.toFixed(2),
        nhima.toFixed(2),
        napsa.toFixed(2),
        net.toFixed(2),
        empCost.toFixed(2),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  lines.push(
    [
      "TOTALS",
      "",
      sumBasic.toFixed(2),
      sumAllow.toFixed(2),
      sumComm.toFixed(2),
      sumGross.toFixed(2),
      sumPaye.toFixed(2),
      sumNhima.toFixed(2),
      sumNapsa.toFixed(2),
      sumNet.toFixed(2),
      sumEmpCost.toFixed(2),
    ]
      .map(csvCell)
      .join(","),
  );

  return lines.join("\n");
}

export function downloadPayrollRunCsv(
  run: { payroll_month: number; payroll_year: number; status?: string | null },
  records: PayrollRunCsvRecord[],
): void {
  const csv = buildPayrollRunCsv(run, records);
  const filename = `payroll-run-${run.payroll_year}-${String(run.payroll_month).padStart(2, "0")}.csv`;
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
