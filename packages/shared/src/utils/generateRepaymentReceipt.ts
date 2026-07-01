import jsPDF from 'jspdf';
import { format, isValid, parseISO } from 'date-fns';
import { PDF_THEME, pdfMoney } from '@phinduloans/shared/utils/pdfTheme';

interface RepaymentReceiptData {
  borrowerName: string;
  borrowerPhone: string;
  borrowerEmail: string;
  loanReference: string;
  loanAmount: number;
  repaymentAmount: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string;
  installmentNumber: number;
  totalInstallments: number;
  totalPaid: number;
  outstandingBalance: number;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
}

function safeFormatDate(value: string): string {
  if (!value) return format(new Date(), 'MMMM dd, yyyy');
  const parsed = value.includes('T') ? parseISO(value) : new Date(value);
  return isValid(parsed) ? format(parsed, 'MMMM dd, yyyy') : format(new Date(), 'MMMM dd, yyyy');
}

function safeText(value: unknown, fallback = '—'): string {
  if (value == null || value === '') return fallback;
  return String(value);
}

export const generateRepaymentReceipt = (data: RepaymentReceiptData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const companyName = data.companyName || 'PHINDU Finance';
  const companyAddress = data.companyAddress || 'Lusaka, Zambia';
  const companyPhone = data.companyPhone || '+260 967 713 001';

  const receiptNo =
    safeText(data.transactionReference, '') ||
    `RCP-${Date.now().toString().slice(-8)}`;

  // Header
  doc.setFillColor(...PDF_THEME.header);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(...PDF_THEME.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('PAYMENT RECEIPT', pageWidth / 2, 35, { align: 'center' });

  // Receipt Info
  doc.setTextColor(...PDF_THEME.body);
  doc.setFontSize(10);
  doc.text(`Receipt No: ${receiptNo}`, 15, 55);
  doc.text(`Date: ${safeFormatDate(data.paymentDate)}`, pageWidth - 15, 55, { align: 'right' });

  // Borrower Details Section
  doc.setFillColor(...PDF_THEME.softBg);
  doc.rect(15, 65, pageWidth - 30, 35, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_THEME.ink);
  doc.text('BORROWER DETAILS', 20, 75);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_THEME.body);
  doc.text(`Name: ${safeText(data.borrowerName, 'Borrower')}`, 20, 85);
  doc.text(`Phone: ${safeText(data.borrowerPhone)}`, 20, 92);
  doc.text(`Loan Reference: ${safeText(data.loanReference)}`, pageWidth / 2, 85);

  // Payment Details Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_THEME.ink);
  doc.text('PAYMENT DETAILS', 20, 115);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_THEME.body);

  const detailsY = 125;
  const col1X = 20;
  const col2X = pageWidth / 2;

  doc.text(`Payment Method:`, col1X, detailsY);
  doc.text(safeText(data.paymentMethod, 'cash').replace(/_/g, ' ').toUpperCase(), col1X + 45, detailsY);

  doc.text(`Transaction Ref:`, col2X, detailsY);
  doc.text(safeText(data.transactionReference), col2X + 45, detailsY);

  doc.text(`Installment:`, col1X, detailsY + 10);
  doc.text(`${data.installmentNumber || 1} of ${data.totalInstallments || 1}`, col1X + 45, detailsY + 10);

  // Amount Box
  doc.setFillColor(...PDF_THEME.header);
  doc.rect(15, detailsY + 25, pageWidth - 30, 30, 'F');

  doc.setTextColor(...PDF_THEME.white);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT PAID', pageWidth / 2, detailsY + 38, { align: 'center' });
  doc.setFontSize(20);
  doc.text(pdfMoney(data.repaymentAmount), pageWidth / 2, detailsY + 52, { align: 'center' });

  // Summary Section
  doc.setTextColor(...PDF_THEME.body);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_THEME.ink);
  doc.text('LOAN SUMMARY', 20, detailsY + 75);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_THEME.body);

  const summaryY = detailsY + 85;

  const drawSummaryRow = (label: string, value: string, y: number, bold = false) => {
    if (bold) doc.setFont('helvetica', 'bold');
    doc.text(label, 25, y);
    doc.text(value, pageWidth - 25, y, { align: 'right' });
    if (bold) doc.setFont('helvetica', 'normal');
  };

  doc.setDrawColor(...PDF_THEME.border);
  doc.line(20, summaryY - 5, pageWidth - 20, summaryY - 5);

  drawSummaryRow('Original Loan Amount:', pdfMoney(data.loanAmount), summaryY);
  doc.line(20, summaryY + 5, pageWidth - 20, summaryY + 5);

  drawSummaryRow('Total Paid to Date:', pdfMoney(data.totalPaid), summaryY + 15);
  doc.line(20, summaryY + 20, pageWidth - 20, summaryY + 20);

  doc.setFillColor(...PDF_THEME.successBg);
  doc.rect(20, summaryY + 25, pageWidth - 40, 12, 'F');
  drawSummaryRow('Outstanding Balance:', pdfMoney(data.outstandingBalance), summaryY + 33, true);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.accent);
  doc.text('Thank you for your payment!', pageWidth / 2, 270, { align: 'center' });
  doc.setTextColor(...PDF_THEME.muted);
  doc.text(`${companyName} | ${companyAddress} | ${companyPhone}`, pageWidth / 2, 277, { align: 'center' });
  doc.text(`Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, pageWidth / 2, 284, { align: 'center' });

  return doc;
};

export const downloadRepaymentReceipt = (data: RepaymentReceiptData, filename?: string) => {
  const doc = generateRepaymentReceipt(data);
  const ref = safeText(data.loanReference, 'receipt').replace(/[^a-zA-Z0-9-]/g, '');
  const defaultFilename = `Receipt_${ref}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename || defaultFilename);
};
