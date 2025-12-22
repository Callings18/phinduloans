import jsPDF from 'jspdf';

interface LoanData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  nrc_number: string;
  address?: string;
  city?: string;
  date_of_birth?: string;
  employer_name?: string;
  job_title?: string;
  monthly_income: number;
  loan_amount: number;
  loan_term_months: number;
  interest_rate: number;
  monthly_payment: number;
  total_repayment: number;
  loan_purpose: string;
  collateral_description?: string;
  collateral_value?: number;
  created_at: string;
}

export const generateLoanContract = (loan: LoanData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  // Helper functions
  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
    const x = (pageWidth - textWidth) / 2;
    doc.text(text, x, y);
  };

  const addSection = (title: string, content: string[]) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    content.forEach((line) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      const lines = doc.splitTextToSize(line, contentWidth);
      doc.text(lines, margin, yPos);
      yPos += lines.length * 5 + 2;
    });
    yPos += 5;
  };

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  centerText('PHINDU CREDIT SOLUTIONS', 18, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  centerText('LOAN AGREEMENT CONTRACT', 30, 12);
  
  doc.setTextColor(0, 0, 0);
  yPos = 50;

  // Contract Number & Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Contract No: PCS-${loan.id.slice(0, 8).toUpperCase()}`, margin, yPos);
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 50, yPos);
  yPos += 15;

  // Parties
  addSection('1. PARTIES TO THIS AGREEMENT', [
    'This Loan Agreement ("Agreement") is entered into as of the date stated above between:',
    '',
    'LENDER: Phindu Credit Solutions',
    'Address: Lusaka, Zambia',
    '',
    `BORROWER: ${loan.full_name}`,
    `NRC Number: ${loan.nrc_number}`,
    `Phone: ${loan.phone}`,
    `Email: ${loan.email}`,
    `Address: ${loan.address || 'N/A'}, ${loan.city || ''}`,
  ]);

  // Loan Details
  addSection('2. LOAN DETAILS', [
    `Principal Amount: K${loan.loan_amount.toLocaleString()}`,
    `Interest Rate: ${loan.interest_rate}% per annum`,
    `Loan Term: ${loan.loan_term_months} months`,
    `Monthly Payment: K${loan.monthly_payment.toLocaleString()}`,
    `Total Repayment Amount: K${loan.total_repayment.toLocaleString()}`,
    `Loan Purpose: ${loan.loan_purpose?.replace('_', ' ').toUpperCase() || 'Personal'}`,
  ]);

  // Employment Details
  if (loan.employer_name) {
    addSection('3. BORROWER EMPLOYMENT DETAILS', [
      `Employer: ${loan.employer_name}`,
      `Job Title: ${loan.job_title || 'N/A'}`,
      `Monthly Income: K${loan.monthly_income.toLocaleString()}`,
    ]);
  }

  // Collateral
  if (loan.collateral_description) {
    addSection('4. COLLATERAL/SECURITY', [
      `Description: ${loan.collateral_description}`,
      `Estimated Value: K${(loan.collateral_value || 0).toLocaleString()}`,
      '',
      'The Borrower pledges the above collateral as security for this loan.',
    ]);
  }

  // Terms and Conditions
  addSection(`${loan.collateral_description ? '5' : '4'}. TERMS AND CONDITIONS`, [
    '• The Borrower agrees to repay the loan in monthly installments as specified above.',
    '• Payments are due on the same date each month, starting one month from the disbursement date.',
    '• Late payments may incur a penalty of 5% of the overdue amount per month.',
    '• The Borrower may prepay the loan without penalty.',
    '• In case of default, the Lender reserves the right to pursue legal remedies.',
    '• All disputes shall be resolved under the laws of Zambia.',
  ]);

  // Representations
  addSection(`${loan.collateral_description ? '6' : '5'}. BORROWER REPRESENTATIONS`, [
    'The Borrower represents and warrants that:',
    '• All information provided in this application is true and accurate.',
    '• The Borrower has the legal capacity to enter into this Agreement.',
    '• The Borrower is not in default of any other loan agreement.',
    '• The Borrower will notify the Lender of any change in employment or address.',
  ]);

  // Signature Section
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SIGNATURES', margin, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Borrower signature
  doc.text('BORROWER:', margin, yPos);
  yPos += 10;
  doc.line(margin, yPos, margin + 80, yPos);
  yPos += 5;
  doc.text(`Name: ${loan.full_name}`, margin, yPos);
  yPos += 5;
  doc.text('Date: ____________________', margin, yPos);
  
  // Reset for Lender signature on same line
  yPos -= 20;
  doc.text('FOR PHINDU CREDIT SOLUTIONS:', pageWidth - margin - 80, yPos);
  yPos += 10;
  doc.line(pageWidth - margin - 80, yPos, pageWidth - margin, yPos);
  yPos += 5;
  doc.text('Name: ____________________', pageWidth - margin - 80, yPos);
  yPos += 5;
  doc.text('Date: ____________________', pageWidth - margin - 80, yPos);

  // Footer
  yPos = 285;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  centerText('Phindu Credit Solutions - Money When You Need It', yPos, 8);
  centerText('Contact: info@phinducredit.co.zm | www.phinducredit.co.zm', yPos + 4, 8);

  // Open in new window for printing
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};
