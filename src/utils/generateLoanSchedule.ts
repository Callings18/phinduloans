import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, addMonths } from 'date-fns';

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
  disbursementDate: string;
  firstRepaymentDate: string;
  /** e.g. "12 weeks" — defaults to "N months" from termMonths when omitted */
  termSummaryLabel?: string;
  /** PDF column above installment amount — defaults to MONTHLY PAYMENT */
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

  // Header - App theme color (pink/magenta: RGB 255, 51, 153)
  doc.setFillColor(255, 51, 153);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('LOAN REPAYMENT SCHEDULE', pageWidth / 2, 32, { align: 'center' });

  // Loan Info Section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy')}`, pageWidth - 15, 50, { align: 'right' });

  // Borrower & Loan Details
  doc.setFillColor(245, 245, 245);
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
  doc.text(`Phone: ${data.borrowerPhone}`, col1, y);
  doc.text(`Principal Amount: K${data.loanAmount.toLocaleString()}`, col2, y);

  y += 8;
  doc.text(`Email: ${data.borrowerEmail}`, col1, y);
  doc.text(`Interest Rate: ${data.interestRate}% (${data.interestPeriod})`, col2, y);

  // Summary Box - App theme color
  doc.setFillColor(255, 51, 153);
  doc.rect(15, 105, (pageWidth - 30) / 3, 25, 'F');
  doc.rect(15 + (pageWidth - 30) / 3, 105, (pageWidth - 30) / 3, 25, 'F');
  doc.rect(15 + 2 * (pageWidth - 30) / 3, 105, (pageWidth - 30) / 3, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const paymentCol = data.paymentColumnTitle || 'MONTHLY PAYMENT';
  doc.text('TERM', 15 + (pageWidth - 30) / 6, 113, { align: 'center' });
  doc.text(paymentCol, 15 + (pageWidth - 30) / 2, 113, { align: 'center' });
  doc.text('TOTAL REPAYMENT', 15 + 5 * (pageWidth - 30) / 6, 113, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const termSummary = data.termSummaryLabel || `${data.termMonths} Months`;
  doc.text(termSummary, 15 + (pageWidth - 30) / 6, 124, { align: 'center' });
  doc.text(`K${data.monthlyPayment.toLocaleString()}`, 15 + (pageWidth - 30) / 2, 124, { align: 'center' });
  doc.text(`K${data.totalRepayment.toLocaleString()}`, 15 + 5 * (pageWidth - 30) / 6, 124, { align: 'center' });

  // Repayment Schedule Table
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('REPAYMENT SCHEDULE', 20, 145);

  const tableData = data.repayments.map((rep, idx) => [
    rep.installmentNumber.toString(),
    format(new Date(rep.dueDate), 'MMM dd, yyyy'),
    `K${rep.amount.toLocaleString()}`,
    rep.status.charAt(0).toUpperCase() + rep.status.slice(1),
    rep.paidDate ? format(new Date(rep.paidDate), 'MMM dd, yyyy') : '-'
  ]);

  autoTable(doc, {
    startY: 150,
    head: [['#', 'Due Date', 'Amount', 'Status', 'Paid Date']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [255, 51, 153],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'center' },
      4: { halign: 'center' },
    },
  });

  // Footer (optional chaining in case lastAutoTable is missing)
  const finalY = ((doc as any).lastAutoTable?.finalY ?? 130) + 15;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('This is a computer-generated document and does not require a signature.', pageWidth / 2, finalY, { align: 'center' });
  doc.text(`${companyName} | ${companyAddress} | ${companyPhone}`, pageWidth / 2, finalY + 7, { align: 'center' });

  return doc;
};

export const downloadLoanSchedule = (data: LoanScheduleData, filename?: string) => {
  const doc = generateLoanSchedule(data);
  const defaultFilename = `LoanSchedule_${data.loanReference}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename || defaultFilename);
};
