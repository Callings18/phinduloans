/**
 * Zambian-compliant Payslip PDF Generator
 * Professional layout with PAYE, NHIMA, NAPSA breakdowns.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatZMW, getMonthName } from "./payrollCalculations";
import { format } from "date-fns";

const BRAND_COLOR: [number, number, number] = [107, 25, 58]; // Brand magenta #C2185B
const DARK_COLOR: [number, number, number] = [30, 30, 30];
const LIGHT_BG: [number, number, number] = [248, 245, 246];
const WHITE: [number, number, number] = [255, 255, 255];

function drawPayslipPage(doc: jsPDF, record: any, run: any) {
  const emp = record.employees || {};
  const name = emp.full_name || "Employee";
  const period = run ? `${getMonthName(run.payroll_month)} ${run.payroll_year}` : "";
  const pageW = doc.internal.pageSize.width;
  let y = 12;

  // ── Header Band ──────────────────────────────────────────
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 36, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("PAYSLIP", 14, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Phindu Credit Solutions Limited", 14, 24);
  doc.text(`Pay Period: ${period}`, 14, 30);

  // Right-aligned status
  const status = (record.status || run?.status || "draft").toUpperCase();
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(status, pageW - 14, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy")}`, pageW - 14, 24, { align: "right" });

  y = 44;

  // ── Employee Information ─────────────────────────────────
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y, pageW - 28, 28, 2, 2, "F");

  doc.setTextColor(...DARK_COLOR);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("EMPLOYEE DETAILS", 18, y + 6);

  doc.setFont("helvetica", "normal");
  const col1 = 18;
  const col2 = pageW / 2 + 4;
  const infoY = y + 12;

  doc.text(`Name: ${name}`, col1, infoY);
  doc.text(`Department: ${emp.department || "—"}`, col2, infoY);
  doc.text(`Position: ${emp.position || "—"}`, col1, infoY + 6);
  doc.text(`TPIN: ${emp.tpin || "—"}`, col2, infoY + 6);
  doc.text(`NAPSA No: ${emp.napsa_number || "—"}`, col1, infoY + 12);
  doc.text(`NHIMA No: ${emp.nhima_number || "—"}`, col2, infoY + 12);

  y += 34;

  // ── Earnings Table ───────────────────────────────────────
  autoTable(doc, {
    startY: y,
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
    margin: { left: 14, right: pageW / 2 + 2 },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BRAND_COLOR, textColor: WHITE, fontStyle: "bold" },
    footStyles: { fillColor: LIGHT_BG, textColor: DARK_COLOR, fontStyle: "bold" },
    theme: "grid",
    tableWidth: pageW / 2 - 16,
  });

  // ── Deductions Table (side by side) ──────────────────────
  autoTable(doc, {
    startY: y,
    head: [["DEDUCTIONS", "EMPLOYEE", "EMPLOYER"]],
    body: [
      ["PAYE (Income Tax)", formatZMW(Number(record.paye_tax || 0)), "—"],
      ["NHIMA (1%)", formatZMW(Number(record.nhima_employee || 0)), formatZMW(Number(record.nhima_employer || 0))],
      ["NAPSA (5%)", formatZMW(Number(record.napsa_employee || 0)), formatZMW(Number(record.napsa_employer || 0))],
      ["Loan Deduction", formatZMW(Number(record.loan_deduction || 0)), "—"],
      ["Pension", formatZMW(Number(record.pension_deduction || 0)), "—"],
      ["Union Dues", formatZMW(Number(record.union_dues || 0)), "—"],
      ["Other", formatZMW(Number(record.other_deductions || 0)), "—"],
    ],
    foot: [["TOTAL", formatZMW(Number(record.total_deductions || 0)), formatZMW(Number(record.nhima_employer || 0) + Number(record.napsa_employer || 0))]],
    margin: { left: pageW / 2 + 2, right: 14 },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [139, 30, 30], textColor: WHITE, fontStyle: "bold" },
    footStyles: { fillColor: LIGHT_BG, textColor: DARK_COLOR, fontStyle: "bold" },
    theme: "grid",
    tableWidth: pageW / 2 - 16,
  });

  // Find the bottom of the taller table
  const afterTables = Math.max(
    (doc as any).lastAutoTable?.finalY || y + 60,
    y + 60
  );
  y = afterTables + 8;

  // ── Net Pay Banner ───────────────────────────────────────
  doc.setFillColor(...BRAND_COLOR);
  doc.roundedRect(14, y, pageW - 28, 16, 2, 2, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("NET PAY", 20, y + 11);
  doc.text(formatZMW(Number(record.net_pay || 0)), pageW - 20, y + 11, { align: "right" });

  y += 22;

  // ── Employer Cost Summary ────────────────────────────────
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y, pageW - 28, 20, 2, 2, "F");
  doc.setTextColor(...DARK_COLOR);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("EMPLOYER CONTRIBUTIONS", 18, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(`NHIMA (Employer): ${formatZMW(Number(record.nhima_employer || 0))}`, 18, y + 12);
  doc.text(`NAPSA (Employer): ${formatZMW(Number(record.napsa_employer || 0))}`, pageW / 2, y + 12);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Employer Cost: ${formatZMW(Number(record.total_employer_cost || 0))}`, 18, y + 18);

  y += 26;

  // ── Bank Details ─────────────────────────────────────────
  if (emp.bank_name || emp.bank_account_number) {
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(14, y, pageW - 28, 14, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT DETAILS", 18, y + 6);
    doc.setFont("helvetica", "normal");
    doc.text(`Bank: ${emp.bank_name || "—"}    Account: ${emp.bank_account_number || "—"}    Branch: ${emp.bank_branch || "—"}    Method: ${emp.payment_method || "Bank Transfer"}`, 18, y + 12);
    y += 18;
  }

  // ── Footer ───────────────────────────────────────────────
  const footerY = doc.internal.pageSize.height - 12;
  doc.setDrawColor(200);
  doc.line(14, footerY - 4, pageW - 14, footerY - 4);
  doc.setFontSize(6);
  doc.setTextColor(140);
  doc.setFont("helvetica", "normal");
  doc.text("This is a computer-generated payslip and does not require a signature.", 14, footerY);
  doc.text("Phindu Credit Solutions Limited — Confidential", pageW - 14, footerY, { align: "right" });
}

/**
 * Generate and download a single employee payslip PDF.
 */
export function generatePayslipPDF(record: any, run: any) {
  const doc = new jsPDF();
  drawPayslipPage(doc, record, run);

  const emp = record.employees || {};
  const name = (emp.full_name || "Employee").replace(/\s+/g, "-");
  const period = run ? `${getMonthName(run.payroll_month)}-${run.payroll_year}` : "payslip";
  doc.save(`Payslip-${name}-${period}.pdf`);
}

/**
 * Generate multi-page PDF with all employee payslips for a run.
 */
export function generateAllPayslipsPDF(records: any[], run: any) {
  if (!records.length) return;

  const doc = new jsPDF();
  const period = run ? `${getMonthName(run.payroll_month)} ${run.payroll_year}` : "";
  const pageW = doc.internal.pageSize.width;

  // ── Page 1: Summary ──────────────────────────────────────
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PAYROLL SUMMARY", 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Phindu Credit Solutions Limited — ${period}`, 14, 22);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, pageW - 14, 22, { align: "right" });

  autoTable(doc, {
    startY: 36,
    head: [["#", "Employee", "Department", "Gross", "PAYE", "NHIMA", "NAPSA", "Deductions", "Net Pay"]],
    body: records.map((r: any, i: number) => [
      String(i + 1),
      r.employees?.full_name || "—",
      r.employees?.department || "—",
      formatZMW(Number(r.gross_pay || 0)),
      formatZMW(Number(r.paye_tax || 0)),
      formatZMW(Number(r.nhima_employee || 0)),
      formatZMW(Number(r.napsa_employee || 0)),
      formatZMW(Number(r.total_deductions || 0)),
      formatZMW(Number(r.net_pay || 0)),
    ]),
    foot: [[
      "", `Total (${records.length} employees)`, "",
      formatZMW(Number(run.total_gross || 0)),
      formatZMW(Number(run.total_paye || 0)),
      formatZMW(Number(run.total_nhima || 0)),
      formatZMW(Number(run.total_napsa || 0)),
      "—",
      formatZMW(Number(run.total_net || 0)),
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: BRAND_COLOR, textColor: WHITE, fontStyle: "bold" },
    footStyles: { fillColor: LIGHT_BG, textColor: DARK_COLOR, fontStyle: "bold" },
    theme: "grid",
  });

  // Footer on summary page
  doc.setFontSize(6);
  doc.setTextColor(140);
  doc.text("Phindu Credit Solutions Limited — Confidential", 14, doc.internal.pageSize.height - 8);

  // ── Individual Payslips ──────────────────────────────────
  records.forEach((record) => {
    doc.addPage();
    drawPayslipPage(doc, record, run);
  });

  const periodSlug = period.replace(/\s+/g, "-");
  doc.save(`Payslips-${periodSlug}.pdf`);
}
