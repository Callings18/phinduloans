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

const createContractPDF = (loan: LoanData): jsPDF => {
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

  // Header - Gold/Amber color (RGB: 234, 179, 8 - matching warning/gold color)
  doc.setFillColor(234, 179, 8);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(0, 0, 0);
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

  return doc;
};

// Open in new window for printing
export const generateLoanContract = (loan: LoanData) => {
  const doc = createContractPDF(loan);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

// Download as PDF file
export const downloadLoanContract = (loan: LoanData) => {
  const doc = createContractPDF(loan);
  const fileName = `Loan_Contract_${loan.full_name.replace(/\s+/g, '_')}_${loan.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
};

// Get PDF as blob for email/sharing
export const getLoanContractBlob = (loan: LoanData): Blob => {
  const doc = createContractPDF(loan);
  return doc.output('blob');
};

// Get PDF as base64 for email
export const getLoanContractBase64 = (loan: LoanData): string => {
  const doc = createContractPDF(loan);
  return doc.output('datauristring');
};

// Share via WhatsApp (opens WhatsApp with message - user needs to manually attach the downloaded PDF)
export const shareContractViaWhatsApp = (loan: LoanData) => {
  const message = encodeURIComponent(
    `Hello ${loan.full_name},\n\n` +
    `Please find attached your Loan Agreement Contract from Phindu Credit Solutions.\n\n` +
    `Loan Details:\n` +
    `- Contract No: PCS-${loan.id.slice(0, 8).toUpperCase()}\n` +
    `- Loan Amount: K${loan.loan_amount.toLocaleString()}\n` +
    `- Monthly Payment: K${loan.monthly_payment.toLocaleString()}\n` +
    `- Term: ${loan.loan_term_months} months\n\n` +
    `Please sign and return the contract.\n\n` +
    `Phindu Credit Solutions`
  );
  
  // Format phone for WhatsApp (remove spaces and ensure international format)
  const phone = loan.phone.replace(/\s+/g, '').replace(/^0/, '260');
  const whatsappUrl = `https://wa.me/${phone}?text=${message}`;
  
  // First download the PDF so user can attach it
  downloadLoanContract(loan);
  
  // Then open WhatsApp
  window.open(whatsappUrl, '_blank');
};

// Prepare mailto link with contract info
export const emailContract = (loan: LoanData) => {
  const subject = encodeURIComponent(`Loan Agreement Contract - PCS-${loan.id.slice(0, 8).toUpperCase()}`);
  const body = encodeURIComponent(
    `Dear ${loan.full_name},\n\n` +
    `Please find attached your Loan Agreement Contract from Phindu Credit Solutions.\n\n` +
    `Loan Details:\n` +
    `- Contract No: PCS-${loan.id.slice(0, 8).toUpperCase()}\n` +
    `- Loan Amount: K${loan.loan_amount.toLocaleString()}\n` +
    `- Interest Rate: ${loan.interest_rate}%\n` +
    `- Monthly Payment: K${loan.monthly_payment.toLocaleString()}\n` +
    `- Term: ${loan.loan_term_months} months\n` +
    `- Total Repayment: K${loan.total_repayment.toLocaleString()}\n\n` +
    `Please review, sign, and return the contract at your earliest convenience.\n\n` +
    `If you have any questions, please don't hesitate to contact us.\n\n` +
    `Best regards,\n` +
    `Phindu Credit Solutions\n` +
    `info@phinducredit.co.zm`
  );
  
  // First download the PDF so user can attach it to email
  downloadLoanContract(loan);
  
  // Then open email client
  const mailtoUrl = `mailto:${loan.email}?subject=${subject}&body=${body}`;
  window.location.href = mailtoUrl;
};
