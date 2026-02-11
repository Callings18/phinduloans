/**
 * Payslip PDF generator for Zambian payroll.
 * Generates detailed payslips with PAYE, NHIMA, NAPSA breakdowns.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatZMW, getMonthName } from "./payrollCalculations";

export function generatePayslipPDF(record: any, run: any) {
  const doc = new jsPDF();
  const emp = record.employees;
  const name = emp?.full_name || "Employee";
  const period = run ? `${getMonthName(run.payroll_month)} ${run.payroll_year}` : "";

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PAYSLIP", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Phindu Finance Limited", 14, 27);
  doc.text(`Pay Period: ${period}`, 14, 33);

  // Employee Info
  doc.setFontSize(9);
  doc.text(`Employee: ${name}`, 14, 42);
  doc.text(`Department: ${emp?.department || "—"}`, 14, 48);
  doc.text(`Position: ${emp?.position || "—"}`, 14, 54);
  if (emp?.bank_name) doc.text(`Bank: ${emp.bank_name} — ${emp.bank_account_number || ""}`, 120, 42);

  // Earnings Table
  autoTable(doc, {
    startY: 62,
    head: [["EARNINGS", "AMOUNT (ZMW)"]],
    body: [
      ["Basic Salary", formatZMW(Number(record.basic_salary || 0))],
      ["Housing Allowance", formatZMW(Number(record.housing_allowance || 0))],
      ["Transport Allowance", formatZMW(Number(record.transport_allowance || 0))],
      ["Lunch Allowance", formatZMW(Number(record.lunch_allowance || 0))],
      ["Other Allowances", formatZMW(Number(record.other_allowances || 0))],
      ["Overtime Pay", formatZMW(Number(record.overtime_pay || 0))],
      ["Commission", formatZMW(Number(record.commission_amount || 0))],
    ],
    foot: [["GROSS PAY", formatZMW(Number(record.gross_pay || 0))]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    theme: "grid",
  });

  const afterEarnings = (doc as any).lastAutoTable.finalY + 6;

  // Deductions Table
  autoTable(doc, {
    startY: afterEarnings,
    head: [["DEDUCTIONS", "EMPLOYEE (ZMW)", "EMPLOYER (ZMW)"]],
    body: [
      ["PAYE (Income Tax)", formatZMW(Number(record.paye_tax || 0)), "—"],
      ["NHIMA", formatZMW(Number(record.nhima_employee || 0)), formatZMW(Number(record.nhima_employer || 0))],
      ["NAPSA", formatZMW(Number(record.napsa_employee || 0)), formatZMW(Number(record.napsa_employer || 0))],
      ["Loan Deduction", formatZMW(Number(record.loan_deduction || 0)), "—"],
      ["Pension", formatZMW(Number(record.pension_deduction || 0)), "—"],
      ["Union Dues", formatZMW(Number(record.union_dues || 0)), "—"],
      ["Other", formatZMW(Number(record.other_deductions || 0)), "—"],
    ],
    foot: [["TOTAL DEDUCTIONS", formatZMW(Number(record.total_deductions || 0)), formatZMW(Number(record.nhima_employer || 0) + Number(record.napsa_employer || 0))]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [139, 30, 30], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    theme: "grid",
  });

  const afterDeductions = (doc as any).lastAutoTable.finalY + 8;

  // Net Pay box
  doc.setFillColor(30, 58, 95);
  doc.rect(14, afterDeductions, 182, 14, "F");
  doc.setTextColor(255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("NET PAY", 18, afterDeductions + 10);
  doc.text(formatZMW(Number(record.net_pay || 0)), 160, afterDeductions + 10, { align: "right" });

  // Total Employer Cost
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Employer Cost: ${formatZMW(Number(record.total_employer_cost || 0))}`, 14, afterDeductions + 24);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("This is a computer-generated payslip. Phindu Finance Limited - Confidential.", 14, doc.internal.pageSize.height - 10);

  doc.save(`payslip-${name.replace(/\s+/g, "-")}-${period.replace(/\s+/g, "-")}.pdf`);
}

export function generateAllPayslipsPDF(records: any[], run: any) {
  const doc = new jsPDF();
  const period = run ? `${getMonthName(run.payroll_month)} ${run.payroll_year}` : "";

  // Summary page
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PAYROLL SUMMARY", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Phindu Finance Limited — ${period}`, 14, 28);

  autoTable(doc, {
    startY: 36,
    head: [["Employee", "Department", "Gross", "PAYE", "NHIMA", "NAPSA", "Net Pay"]],
    body: records.map((r: any) => [
      r.employees?.full_name || "—",
      r.employees?.department || "—",
      formatZMW(Number(r.gross_pay || 0)),
      formatZMW(Number(r.paye_tax || 0)),
      formatZMW(Number(r.nhima_employee || 0)),
      formatZMW(Number(r.napsa_employee || 0)),
      formatZMW(Number(r.net_pay || 0)),
    ]),
    foot: [[
      `Total (${records.length})`, "",
      formatZMW(Number(run.total_gross || 0)),
      formatZMW(Number(run.total_paye || 0)),
      formatZMW(Number(run.total_nhima || 0)),
      formatZMW(Number(run.total_napsa || 0)),
      formatZMW(Number(run.total_net || 0)),
    ]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    theme: "grid",
  });

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("Phindu Finance Limited - Confidential", 14, doc.internal.pageSize.height - 10);

  doc.save(`payroll-summary-${period.replace(/\s+/g, "-")}.pdf`);
}
