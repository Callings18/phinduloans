import jsPDF from 'jspdf';
import { format } from 'date-fns';

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

export const generateRepaymentReceipt = (data: RepaymentReceiptData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const companyName = data.companyName || 'PHINDU Finance';
  const companyAddress = data.companyAddress || 'Lusaka, Zambia';
  const companyPhone = data.companyPhone || '+260 967 713 001';

  // Header
  doc.setFillColor(244, 36, 140);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('PAYMENT RECEIPT', pageWidth / 2, 35, { align: 'center' });

  // Receipt Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  const receiptNo = `RCP-${Date.now().toString().slice(-8)}`;
  doc.text(`Receipt No: ${receiptNo}`, 15, 55);
  doc.text(`Date: ${format(new Date(data.paymentDate), 'MMMM dd, yyyy')}`, pageWidth - 15, 55, { align: 'right' });

  // Borrower Details Section
  doc.setFillColor(240, 240, 240);
  doc.rect(15, 65, pageWidth - 30, 35, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('BORROWER DETAILS', 20, 75);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${data.borrowerName}`, 20, 85);
  doc.text(`Phone: ${data.borrowerPhone}`, 20, 92);
  doc.text(`Loan Reference: ${data.loanReference}`, pageWidth / 2, 85);

  // Payment Details Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PAYMENT DETAILS', 20, 115);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const detailsY = 125;
  const col1X = 20;
  const col2X = pageWidth / 2;

  doc.text(`Payment Method:`, col1X, detailsY);
  doc.text(data.paymentMethod.replace(/_/g, ' ').toUpperCase(), col1X + 45, detailsY);

  doc.text(`Transaction Ref:`, col2X, detailsY);
  doc.text(data.transactionReference, col2X + 45, detailsY);

  doc.text(`Installment:`, col1X, detailsY + 10);
  doc.text(`${data.installmentNumber} of ${data.totalInstallments}`, col1X + 45, detailsY + 10);

  // Amount Box
  doc.setFillColor(244, 36, 140);
  doc.rect(15, detailsY + 25, pageWidth - 30, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT PAID', pageWidth / 2, detailsY + 38, { align: 'center' });
  doc.setFontSize(20);
  doc.text(`K${data.repaymentAmount.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}`, pageWidth / 2, detailsY + 52, { align: 'center' });

  // Summary Section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('LOAN SUMMARY', 20, detailsY + 75);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const summaryY = detailsY + 85;

  // Table-like summary
  const drawSummaryRow = (label: string, value: string, y: number, bold = false) => {
    if (bold) doc.setFont('helvetica', 'bold');
    doc.text(label, 25, y);
    doc.text(value, pageWidth - 25, y, { align: 'right' });
    if (bold) doc.setFont('helvetica', 'normal');
  };

  doc.setDrawColor(200, 200, 200);
  doc.line(20, summaryY - 5, pageWidth - 20, summaryY - 5);

  drawSummaryRow('Original Loan Amount:', `K${data.loanAmount.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}`, summaryY);
  doc.line(20, summaryY + 5, pageWidth - 20, summaryY + 5);

  drawSummaryRow('Total Paid to Date:', `K${data.totalPaid.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}`, summaryY + 15);
  doc.line(20, summaryY + 20, pageWidth - 20, summaryY + 20);

  doc.setFillColor(240, 255, 240);
  doc.rect(20, summaryY + 25, pageWidth - 40, 12, 'F');
  drawSummaryRow('Outstanding Balance:', `K${data.outstandingBalance.toLocaleString('en-ZM', { minimumFractionDigits: 2 })}`, summaryY + 33, true);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(244, 36, 140);
  doc.text('Thank you for your payment!', pageWidth / 2, 270, { align: 'center' });
  doc.text(`${companyName} | ${companyAddress} | ${companyPhone}`, pageWidth / 2, 277, { align: 'center' });
  doc.text(`Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, pageWidth / 2, 284, { align: 'center' });

  return doc;
};

export const downloadRepaymentReceipt = (data: RepaymentReceiptData, filename?: string) => {
  const doc = generateRepaymentReceipt(data);
  const defaultFilename = `Receipt_${data.loanReference}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename || defaultFilename);
};
