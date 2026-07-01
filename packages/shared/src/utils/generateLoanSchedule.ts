import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { PDF_THEME } from '@phinduloans/shared/utils/pdfTheme';

interface LoanScheduleData {
  borrowerName: string;
  borrowerPhone: string;
  borrowerEmail: string;
  loanReference: string;
  loanAmount: number;
  interestRate: number;
  interestPeriod: string;
  termMonths: number;
  monthlyPayment: number;
  totalRepayment: number;
  outstandingBalance?: number;
  disbursementDate: string;
  firstRepaymentDate: string;
  termSummaryLabel?: string;
  paymentColumnTitle?: string;
  repayments: Array<{
    installmentNumber: number;
    dueDate: string;
    amount: number;
    status: string;
    paidDate?: string;
  }>;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
}

export const generateLoanSchedule = (data: LoanScheduleData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const companyName = data.companyName || 'PHINDU Finance';
  const companyAddress = data.companyAddress || 'Lusaka, Zambia';
  const companyPhone = data.companyPhone || '+260 967 713 001';
  const outstandingBalance = Number(data.outstandingBalance || 0);

  doc.setFillColor(...PDF_THEME.header);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('LOAN REPAYMENT SCHEDULE', pageWidth / 2, 32, { align: 'center' });

  doc.setTextColor(...PDF_THEME.ink);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy')}`, pageWidth - 15, 50, { align: 'right' });

  doc.setFillColor(...PDF_THEME.softBg);
  doc.rect(15, 55, pageWidth - 30, 45, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('LOAN DETAILS', 20, 65);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const col1 = 20;
  const col2 = pageWidth / 2 + 10;
  let y = 75;

  doc.text(`Borrower: ${data.borrowerName}`, col1, y);
  doc.text(`Loan Reference: ${data.loanReference}`, col2, y);

  y += 8;
  doc.text(`Phone: ${data.borrowerPhone || '-'}`, col1, y);
  doc.text(`Principal Amount: K${data.loanAmount.toLocaleString()}`, col2, y);

  y += 8;
  doc.text(`Email: ${data.borrowerEmail || '-'}`, col1, y);
  doc.text(`Interest Rate: ${data.interestRate}% (${data.interestPeriod})`, col2, y);

  doc.setFillColor(...PDF_THEME.header);
  const boxWidth = (pageWidth - 30) / 3;
  doc.rect(15, 105, boxWidth, 25, 'F');
  doc.rect(15 + boxWidth, 105, boxWidth, 25, 'F');
  doc.rect(15 + 2 * boxWidth, 105, boxWidth, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const paymentCol = data.paymentColumnTitle || 'INSTALLMENT';
  doc.text('TERM', 15 + boxWidth / 2, 113, { align: 'center' });
  doc.text(paymentCol, 15 + boxWidth + boxWidth / 2, 113, { align: 'center' });
  doc.text('TOTAL REPAYMENT', 15 + 2 * boxWidth + boxWidth / 2, 113, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const termSummary = data.termSummaryLabel || `${data.termMonths} Months`;
  doc.text(termSummary, 15 + boxWidth / 2, 124, { align: 'center' });
  doc.text(`K${data.monthlyPayment.toLocaleString()}`, 15 + boxWidth + boxWidth / 2, 124, { align: 'center' });
  doc.text(`K${data.totalRepayment.toLocaleString()}`, 15 + 2 * boxWidth + boxWidth / 2, 124, { align: 'center' });

  if (outstandingBalance > 0) {
    doc.setFillColor(...PDF_THEME.softBg);
    doc.rect(15, 136, pageWidth - 30, 12, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_THEME.ink);
    doc.setFont('helvetica', 'bold');
    doc.text('OUTSTANDING BALANCE', 20, 144);
    doc.text(`K${outstandingBalance.toLocaleString()}`, pageWidth - 20, 144, { align: 'right' });
  }

  doc.setTextColor(...PDF_THEME.ink);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('REPAYMENT SCHEDULE', 20, outstandingBalance > 0 ? 160 : 145);

  const tableData = data.repayments.map((rep) => [
    rep.installmentNumber.toString(),
    format(new Date(rep.dueDate), 'MMM dd, yyyy'),
    `K${rep.amount.toLocaleString()}`,
    rep.status.charAt(0).toUpperCase() + rep.status.slice(1),
    rep.paidDate ? format(new Date(rep.paidDate), 'MMM dd, yyyy') : '-',
  ]);

  autoTable(doc, {
    startY: outstandingBalance > 0 ? 165 : 150,
    head: [['#', 'Due Date', 'Amount', 'Status', 'Paid Date']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: PDF_THEME.header,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: PDF_THEME.stripe,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'center' },
      4: { halign: 'center' },
    },
  });

  const finalY = ((doc as any).lastAutoTable?.finalY ?? 130) + 15;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text('This is a computer-generated document and does not require a signature.', pageWidth / 2, finalY, { align: 'center' });
  doc.text(`${companyName} | ${companyAddress} | ${companyPhone}`, pageWidth / 2, finalY + 7, { align: 'center' });

  return doc;
};

export const downloadLoanSchedule = (data: LoanScheduleData, filename?: string) => {
  const doc = generateLoanSchedule(data);
  const defaultFilename = `LoanSchedule_${data.loanReference}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename || defaultFilename);
};