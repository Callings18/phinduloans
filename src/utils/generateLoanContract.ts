import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/utils/auditLog';

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
  loan_product_id?: string | null;
}

interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  placeholders: string[];
  is_active: boolean;
  loan_product_id: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch the active template for a loan product
const fetchActiveTemplate = async (loanProductId?: string | null): Promise<ContractTemplate | null> => {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'contract_templates')
      .maybeSingle();

    if (error || !data) return null;

    const templates = data.value as unknown as ContractTemplate[] | null;
    if (!templates || templates.length === 0) return null;

    // Priority 1: Find active template linked to the specific loan product
    if (loanProductId) {
      const productTemplate = templates.find(
        t => t.is_active && t.loan_product_id === loanProductId
      );
      if (productTemplate) return productTemplate;
    }

    // Priority 2: Find any active template for the loan product (even if not marked active but linked)
    if (loanProductId) {
      const linkedTemplate = templates.find(
        t => t.loan_product_id === loanProductId && t.is_active
      );
      if (linkedTemplate) return linkedTemplate;
    }

    // Priority 3: Find a generic active template (no loan product linked)
    const genericTemplate = templates.find(
      t => t.is_active && !t.loan_product_id
    );
    if (genericTemplate) return genericTemplate;

    // Priority 4: Return any active template
    const anyActiveTemplate = templates.find(t => t.is_active);
    if (anyActiveTemplate) return anyActiveTemplate;

    return null;
  } catch (error) {
    console.error('Error fetching contract template:', error);
    return null;
  }
};

// Replace placeholders in template content with actual loan data
const replacePlaceholders = (content: string, loan: LoanData): string => {
  const disbursementDate = new Date();
  const firstPaymentDate = new Date();
  firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);

  const replacements: Record<string, string> = {
    '{{borrower_name}}': loan.full_name,
    '{{borrower_address}}': `${loan.address || 'N/A'}, ${loan.city || ''}`.trim().replace(/,$/, ''),
    '{{borrower_nrc}}': loan.nrc_number,
    '{{borrower_phone}}': loan.phone,
    '{{borrower_email}}': loan.email,
    '{{loan_amount}}': loan.loan_amount.toLocaleString(),
    '{{loan_term}}': loan.loan_term_months.toString(),
    '{{interest_rate}}': loan.interest_rate.toString(),
    '{{monthly_payment}}': loan.monthly_payment.toLocaleString(),
    '{{total_repayment}}': loan.total_repayment.toLocaleString(),
    '{{disbursement_date}}': disbursementDate.toLocaleDateString('en-GB'),
    '{{first_payment_date}}': firstPaymentDate.toLocaleDateString('en-GB'),
    '{{company_name}}': 'Phindu Credit Solutions Limited',
    '{{company_address}}': 'Lusaka, Zambia',
    '{{current_date}}': new Date().toLocaleDateString('en-GB'),
    '{{loan_purpose}}': loan.loan_purpose?.replace('_', ' ').toUpperCase() || 'Personal',
    '{{processing_fee}}': '0', // Can be enhanced to pull from product settings
    '{{late_penalty}}': '5', // Can be enhanced to pull from product settings
    '{{collateral_description}}': loan.collateral_description || 'N/A',
    '{{collateral_value}}': (loan.collateral_value || 0).toLocaleString(),
    '{{employer_name}}': loan.employer_name || 'N/A',
    '{{job_title}}': loan.job_title || 'N/A',
    '{{monthly_income}}': loan.monthly_income.toLocaleString(),
    '{{contract_number}}': `PCS-${loan.id.slice(0, 8).toUpperCase()}`,
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
};

// Create PDF from template content
const createContractPDFFromTemplate = (content: string, loan: LoanData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  // Helper function for centered text
  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
    const x = (pageWidth - textWidth) / 2;
    doc.text(text, x, y);
  };

  // Header - App theme color (burgundy/maroon: RGB 107, 26, 58)
  doc.setFillColor(107, 26, 58);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  centerText('PHINDU CREDIT SOLUTIONS LIMITED', 18, 20);
  
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

  // Split content by lines and render
  const lines = content.split('\n');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  for (const line of lines) {
    // Check if we need a new page
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }

    // Handle section headers (lines that are ALL CAPS or numbered sections)
    const isSectionHeader = /^[0-9]+\.\s+[A-Z]/.test(line) || 
                           (line === line.toUpperCase() && line.length > 3 && line.trim() !== '');
    
    if (isSectionHeader) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      yPos += 3;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    }

    // Word wrap long lines
    const wrappedLines = doc.splitTextToSize(line, contentWidth);
    
    for (const wrappedLine of wrappedLines) {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(wrappedLine, margin, yPos);
      yPos += 5;
    }
  }

  // Footer
  const lastPage = doc.internal.pages.length;
  for (let i = 1; i <= lastPage; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(107, 26, 58);
    centerText('Phindu Credit Solutions Limited - Money When You Need It', 285, 8);
    centerText('Contact: info@phinducredit.co.zm | www.phinducredit.co.zm', 289, 8);
    doc.setTextColor(0, 0, 0);
  }

  return doc;
};

// Default template fallback (used when no custom template exists)
const createDefaultContractPDF = (loan: LoanData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

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

  // Header - App theme color (burgundy/maroon: RGB 107, 26, 58)
  doc.setFillColor(107, 26, 58);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  centerText('PHINDU CREDIT SOLUTIONS LIMITED', 18, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  centerText('LOAN AGREEMENT CONTRACT', 30, 12);
  
  doc.setTextColor(0, 0, 0);
  yPos = 50;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Contract No: PCS-${loan.id.slice(0, 8).toUpperCase()}`, margin, yPos);
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 50, yPos);
  yPos += 15;

  addSection('1. PARTIES TO THIS AGREEMENT', [
    'This Loan Agreement ("Agreement") is entered into as of the date stated above between:',
    '',
    'LENDER: Phindu Credit Solutions Limited',
    'Address: Lusaka, Zambia',
    '',
    `BORROWER: ${loan.full_name}`,
    `NRC Number: ${loan.nrc_number}`,
    `Phone: ${loan.phone}`,
    `Email: ${loan.email}`,
    `Address: ${loan.address || 'N/A'}, ${loan.city || ''}`,
  ]);

  addSection('2. LOAN DETAILS', [
    `Principal Amount: K${loan.loan_amount.toLocaleString()}`,
    `Interest Rate: ${loan.interest_rate}% per annum`,
    `Loan Term: ${loan.loan_term_months} months`,
    `Monthly Payment: K${loan.monthly_payment.toLocaleString()}`,
    `Total Repayment Amount: K${loan.total_repayment.toLocaleString()}`,
    `Loan Purpose: ${loan.loan_purpose?.replace('_', ' ').toUpperCase() || 'Personal'}`,
  ]);

  if (loan.employer_name) {
    addSection('3. BORROWER EMPLOYMENT DETAILS', [
      `Employer: ${loan.employer_name}`,
      `Job Title: ${loan.job_title || 'N/A'}`,
      `Monthly Income: K${loan.monthly_income.toLocaleString()}`,
    ]);
  }

  if (loan.collateral_description) {
    addSection('4. COLLATERAL/SECURITY', [
      `Description: ${loan.collateral_description}`,
      `Estimated Value: K${(loan.collateral_value || 0).toLocaleString()}`,
      '',
      'The Borrower pledges the above collateral as security for this loan.',
    ]);
  }

  addSection(`${loan.collateral_description ? '5' : '4'}. TERMS AND CONDITIONS`, [
    '• The Borrower agrees to repay the loan in monthly installments as specified above.',
    '• Payments are due on the same date each month, starting one month from the disbursement date.',
    '• Late payments may incur a penalty of 5% of the overdue amount per month.',
    '• The Borrower may prepay the loan without penalty.',
    '• In case of default, the Lender reserves the right to pursue legal remedies.',
    '• All disputes shall be resolved under the laws of Zambia.',
  ]);

  addSection(`${loan.collateral_description ? '6' : '5'}. BORROWER REPRESENTATIONS`, [
    'The Borrower represents and warrants that:',
    '• All information provided in this application is true and accurate.',
    '• The Borrower has the legal capacity to enter into this Agreement.',
    '• The Borrower is not in default of any other loan agreement.',
    '• The Borrower will notify the Lender of any change in employment or address.',
  ]);

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
  
  doc.text('BORROWER:', margin, yPos);
  yPos += 10;
  doc.line(margin, yPos, margin + 80, yPos);
  yPos += 5;
  doc.text(`Name: ${loan.full_name}`, margin, yPos);
  yPos += 5;
  doc.text('Date: ____________________', margin, yPos);
  
  yPos -= 20;
  doc.text('FOR PHINDU CREDIT SOLUTIONS LTD:', pageWidth - margin - 80, yPos);
  yPos += 10;
  doc.line(pageWidth - margin - 80, yPos, pageWidth - margin, yPos);
  yPos += 5;
  doc.text('Name: ____________________', pageWidth - margin - 80, yPos);
  yPos += 5;
  doc.text('Date: ____________________', pageWidth - margin - 80, yPos);

  yPos = 285;
  doc.setFontSize(8);
  doc.setTextColor(107, 26, 58);
  centerText('Phindu Credit Solutions Limited - Money When You Need It', yPos, 8);
  centerText('Contact: info@phinducredit.co.zm | www.phinducredit.co.zm', yPos + 4, 8);

  return doc;
};

// Main function to create contract PDF (async to fetch template)
const createContractPDF = async (loan: LoanData): Promise<jsPDF> => {
  const template = await fetchActiveTemplate(loan.loan_product_id);
  
  if (template) {
    console.log(`Using custom template: ${template.name} (ID: ${template.id})`);
    const processedContent = replacePlaceholders(template.content, loan);
    return createContractPDFFromTemplate(processedContent, loan);
  } else {
    console.log('No custom template found, using default template');
    return createDefaultContractPDF(loan);
  }
};

// Open in new window for printing (async version)
export const generateLoanContract = async (loan: LoanData) => {
  const doc = await createContractPDF(loan);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

// Download as PDF file (async version)
export const downloadLoanContract = async (loan: LoanData) => {
  const doc = await createContractPDF(loan);
  const fileName = `Loan_Contract_${loan.full_name.replace(/\s+/g, '_')}_${loan.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
};

// Get PDF as blob for email/sharing (async version)
export const getLoanContractBlob = async (loan: LoanData): Promise<Blob> => {
  const doc = await createContractPDF(loan);
  return doc.output('blob');
};

// Get PDF as base64 for email (async version)
export const getLoanContractBase64 = async (loan: LoanData): Promise<string> => {
  const doc = await createContractPDF(loan);
  return doc.output('datauristring');
};

// Upload PDF to storage and get public URL for WhatsApp media
export const uploadContractToStorage = async (loan: LoanData): Promise<string | null> => {
  try {
    const doc = await createContractPDF(loan);
    const pdfBlob = doc.output('blob');
    
    const fileName = `contracts/contract_${loan.id}_${Date.now()}.pdf`;
    
    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('loan-documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload contract to storage:', uploadError);
      return null;
    }

    // Get signed URL for access (valid for 1 hour)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('loan-documents')
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    if (signedError || !signedData?.signedUrl) {
      console.error('Failed to get signed URL:', signedError);
      return null;
    }

    return signedData.signedUrl;
  } catch (error) {
    console.error('Error uploading contract:', error);
    return null;
  }
};

/**
 * Upload contract PDF to storage and save path to loan_applications.contract_url.
 * Call when generating/sending contract so "Generated Contract" link is available.
 */
export const uploadContractAndSaveUrl = async (loan: LoanData): Promise<string | null> => {
  try {
    const doc = await createContractPDF(loan);
    const pdfBlob = doc.output('blob');
    const fileName = `contracts/contract_${loan.id}_${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('loan-documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload contract to storage:', uploadError);
      return null;
    }

    const { error: updateError } = await supabase
      .from('loan_applications')
      .update({ contract_url: fileName })
      .eq('id', loan.id);

    if (updateError) {
      console.error('Failed to save contract_url:', updateError);
      return null;
    }

    await logAudit({
      action: 'CONTRACT_GENERATED',
      entity_type: 'loan_application',
      entity_id: loan.id,
      details: { contract_url: fileName },
    });
    return fileName;
  } catch (error) {
    console.error('Error in uploadContractAndSaveUrl:', error);
    return null;
  }
};

// Share via WhatsApp (async version) - Sends PDF directly via Twilio
export const shareContractViaWhatsApp = async (loan: LoanData) => {
  const { sendWhatsAppDirect } = await import('@/utils/sendDirectNotification');
  const { toast } = await import('sonner');
  
  toast.info('Preparing contract PDF...');
  
  // Upload PDF to storage and get URL
  const pdfUrl = await uploadContractToStorage(loan);
  
  const message = `Hello ${loan.full_name},\n\n` +
    `Please find your Loan Agreement Contract from Phindu Credit Solutions.\n\n` +
    `Loan Details:\n` +
    `- Contract No: PCS-${loan.id.slice(0, 8).toUpperCase()}\n` +
    `- Loan Amount: K${loan.loan_amount.toLocaleString()}\n` +
    `- Monthly Payment: K${loan.monthly_payment.toLocaleString()}\n` +
    `- Term: ${loan.loan_term_months} months\n\n` +
    `Please review, sign and return the contract.\n\n` +
    `Phindu Credit Solutions Limited`;
  
  // Send WhatsApp message with PDF attachment if URL is available
  const result = await sendWhatsAppDirect(
    loan.phone,
    message,
    'Loan Contract',
    pdfUrl || undefined // Pass the PDF URL as media attachment
  );
  
  // Also download locally for admin reference
  await downloadLoanContract(loan);
  
  return result;
};

// Send contract via Email using SendGrid (through edge function)
export const emailContract = async (loan: LoanData) => {
  const { sendEmailDirect } = await import('@/utils/sendDirectNotification');
  const { toast } = await import('sonner');
  
  const subject = `Loan Agreement Contract - PCS-${loan.id.slice(0, 8).toUpperCase()}`;
  const message = 
    `Dear ${loan.full_name},\n\n` +
    `Please find your Loan Agreement Contract from Phindu Credit Solutions.\n\n` +
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
    `Phindu Credit Solutions Limited\n` +
    `info@phinducredit.co.zm`;
  
  // Download contract locally for admin reference
  await downloadLoanContract(loan);
  
  // Send email via SendGrid
  const result = await sendEmailDirect(
    loan.email,
    subject,
    message
  );
  
  return result;
};

// Send contract via SMS
export const smsContract = async (loan: LoanData, companyName?: string) => {
  const { sendSMSDirect } = await import('@/utils/sendDirectNotification');
  
  const message = `Dear ${loan.full_name}, your loan contract (Ref: PCS-${loan.id.slice(0, 8).toUpperCase()}) for K${loan.loan_amount.toLocaleString()} has been processed. Monthly payment: K${loan.monthly_payment.toLocaleString()}. Term: ${loan.loan_term_months} months. Please check your email/WhatsApp for the full contract. - ${companyName || 'Phindu Finance'}`;
  
  const result = await sendSMSDirect(
    loan.phone,
    message,
    'Loan Contract Notification'
  );
  
  return result;
};