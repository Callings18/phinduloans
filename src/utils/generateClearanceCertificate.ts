import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface LoanData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  nrc_number: string;
  address?: string | null;
  city?: string | null;
  loan_amount: number;
  loan_term_months: number;
  interest_rate: number;
  total_repayment: number;
  created_at: string;
  settlement_date?: string | null;
  settlement_type?: string | null;
}

const createClearancePDF = (loan: LoanData, completionDate: Date): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
    const x = (pageWidth - textWidth) / 2;
    doc.text(text, x, y);
  };

  // Header - Brand magenta (RGB 244, 36, 140)
  doc.setFillColor(244, 36, 140);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  centerText('PHINDU CREDIT SOLUTIONS', 25, 24);
  
  doc.setFontSize(16);
  centerText('LOAN CLEARANCE CERTIFICATE', 40, 16);
  
  doc.setTextColor(0, 0, 0);
  yPos = 70;

  // Certificate Number and Date
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const certNumber = `CLR-${loan.id.slice(0, 8).toUpperCase()}-${format(completionDate, 'yyyyMMdd')}`;
  centerText(`Certificate No: ${certNumber}`, yPos, 11);
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  centerText(`Date of Issue: ${format(new Date(), 'MMMM dd, yyyy')}`, yPos, 10);
  yPos += 20;

  // Main Body
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  centerText('TO WHOM IT MAY CONCERN', yPos, 14);
  yPos += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  
  const bodyText = `This is to certify that the loan facility granted to the below-named individual has been fully repaid and closed in our records. The borrower has no outstanding obligations to Phindu Credit Solutions in respect of this loan.`;
  
  const lines = doc.splitTextToSize(bodyText, pageWidth - margin * 2);
  doc.text(lines, margin, yPos);
  yPos += lines.length * 6 + 15;

  // Borrower Details Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 70, 3, 3, 'FD');
  yPos += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('BORROWER DETAILS', margin + 10, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const details = [
    ['Full Name:', loan.full_name],
    ['NRC Number:', loan.nrc_number],
    ['Phone:', loan.phone],
    ['Address:', `${loan.address || 'N/A'}${loan.city ? `, ${loan.city}` : ''}`],
  ];

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), margin + 45, yPos);
    yPos += 7;
  });

  yPos += 25;

  // Loan Details Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 55, 3, 3, 'FD');
  yPos += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LOAN DETAILS', margin + 10, yPos);
  yPos += 10;

  doc.setFontSize(10);
  
  const loanDetails = [
    ['Contract Number:', `PCS-${loan.id.slice(0, 8).toUpperCase()}`],
    ['Principal Amount:', `K${loan.loan_amount.toLocaleString()}`],
    ['Total Repaid:', `K${loan.total_repayment.toLocaleString()}`],
    ['Loan Completion Date:', format(completionDate, 'MMMM dd, yyyy')],
  ];

  loanDetails.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 55, yPos);
    yPos += 7;
  });

  yPos += 20;

  // Confirmation statement
  doc.setFontSize(11);
  const confirmText = `This certificate is issued upon request and confirms that the above-named borrower has satisfactorily completed all loan repayment obligations. This clearance is valid only for the loan facility referenced above.`;
  const confirmLines = doc.splitTextToSize(confirmText, pageWidth - margin * 2);
  doc.text(confirmLines, margin, yPos);
  yPos += confirmLines.length * 6 + 20;

  // Signature Section
  if (yPos > 240) {
    doc.addPage();
    yPos = 30;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Authorized Signatory:', margin, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'normal');
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 5;
  doc.setFontSize(9);
  doc.text('Name: _______________________', margin, yPos);
  yPos += 7;
  doc.text('Title: Credit Manager', margin, yPos);
  yPos += 7;
  doc.text('Date: ' + format(new Date(), 'dd/MM/yyyy'), margin, yPos);

  // Company Stamp placeholder
  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([2, 2], 0);
  doc.circle(pageWidth - margin - 25, yPos - 15, 20);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Company', pageWidth - margin - 35, yPos - 17);
  doc.text('Stamp', pageWidth - margin - 31, yPos - 10);

  // Footer
  doc.setLineDashPattern([], 0);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  yPos = 285;
  centerText('Phindu Credit Solutions - Money When You Need It', yPos, 8);
  centerText('This document is computer-generated and valid without physical signature.', yPos + 5, 7);

  return doc;
};

export const generateClearanceCertificate = (loan: LoanData, completionDate?: Date) => {
  const date = completionDate || (loan.settlement_date ? new Date(loan.settlement_date) : new Date());
  const doc = createClearancePDF(loan, date);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

export const downloadClearanceCertificate = (loan: LoanData, completionDate?: Date) => {
  const date = completionDate || (loan.settlement_date ? new Date(loan.settlement_date) : new Date());
  const doc = createClearancePDF(loan, date);
  const fileName = `Clearance_Certificate_${loan.full_name.replace(/\s+/g, '_')}_${loan.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
};
