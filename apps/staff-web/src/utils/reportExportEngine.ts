import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { PDF_THEME } from "@phinduloans/shared/utils/pdfTheme";

const formatK = (v: number) => `K${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ReportExportOptions {
  title: string;
  subtitle?: string;
  filters?: Record<string, string>;
  headers: string[];
  rows: (string | number)[][];
  summaryRows?: { label: string; value: string }[];
  filename: string;
}

export function exportReportPDF(opts: ReportExportOptions) {
  const doc = new jsPDF({ orientation: "landscape" });

  // Header
  doc.setFillColor(...PDF_THEME.header);
  doc.rect(0, 0, doc.internal.pageSize.width, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (opts.subtitle) doc.text(opts.subtitle, 14, 22);
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, doc.internal.pageSize.width - 14, 14, { align: "right" });

  let startY = 34;

  // Filters
  if (opts.filters && Object.keys(opts.filters).length > 0) {
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    const filterText = Object.entries(opts.filters)
      .map(([k, v]) => `${k}: ${v}`)
      .join("  |  ");
    doc.text(filterText, 14, startY);
    startY += 8;
  }

  // Data table
  autoTable(doc, {
    head: [opts.headers],
    body: opts.rows.map((r) => r.map(String)),
    startY,
    theme: "grid",
    headStyles: {
      fillColor: PDF_THEME.header,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 7, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: PDF_THEME.stripe },
    margin: { left: 14, right: 14 },
  });

  // Summary
  if (opts.summaryRows && opts.summaryRows.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY || startY + 20;
    autoTable(doc, {
      head: [["Metric", "Value"]],
      body: opts.summaryRows.map((s) => [s.label, s.value]),
      startY: finalY + 8,
      theme: "grid",
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9, fontStyle: "bold" },
      margin: { left: 14, right: 100 },
    });
  }

  doc.save(`${opts.filename}.pdf`);
}

export function exportReportExcel(opts: ReportExportOptions) {
  const wb = XLSX.utils.book_new();

  // Metadata rows
  const meta = [
    [opts.title],
    [opts.subtitle || ""],
    [`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`],
  ];
  if (opts.filters) {
    Object.entries(opts.filters).forEach(([k, v]) => meta.push([`${k}: ${v}`]));
  }
  meta.push([]);

  // Data
  const data = [opts.headers, ...opts.rows.map((r) => r.map(String))];

  // Summary
  if (opts.summaryRows) {
    data.push([]);
    data.push(["Summary", ""]);
    opts.summaryRows.forEach((s) => data.push([s.label, s.value]));
  }

  const allRows = [...meta, ...data];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  ws["!cols"] = opts.headers.map(() => ({ wch: 18 }));

  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${opts.filename}.xlsx`);
}

export { formatK };
