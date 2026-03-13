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

export interface SignatureOptions {
  borrowerSignatureDataUrl?: string;
  borrowerSignedAt?: string;
  adminSignedAt?: string;
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
const replacePlaceholders = async (content: string, loan: LoanData): Promise<string> => {
  const disbursementDate = new Date();
  const firstPaymentDate = new Date();
  firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);

  // Fetch product fees
  let processingFeePercent = 0;
  let latePenalty = 5;
  let processingFeeAmount = 0;
  if (loan.loan_product_id) {
    const { data: product } = await supabase
      .from('loan_products')
      .select('processing_fee_percent, late_payment_penalty_percent, enforcement_fee_percent, insurance_percent, vat_percent, platform_fee_percent')
      .eq('id', loan.loan_product_id)
      .single();
    if (product) {
      processingFeePercent = product.processing_fee_percent || 0;
      latePenalty = product.late_payment_penalty_percent || 5;
      const enforcementFee = loan.loan_amount * ((product.enforcement_fee_percent || 0) / 100);
      const insuranceFee = loan.loan_amount * ((product.insurance_percent || 0) / 100);
      const platformFee = loan.loan_amount * ((product.platform_fee_percent || 0) / 100);
      processingFeeAmount = loan.loan_amount * (processingFeePercent / 100);
      const vatableAmount = processingFeeAmount + enforcementFee + platformFee;
      const vatAmount = vatableAmount * ((product.vat_percent || 0) / 100);
      processingFeeAmount = processingFeeAmount + enforcementFee + insuranceFee + platformFee + vatAmount;
    }
  }

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
    '{{processing_fee}}': `K${Math.round(processingFeeAmount).toLocaleString()} (${processingFeePercent}%)`,
    '{{late_penalty}}': latePenalty.toString(),
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
const createDefaultContractPDF = async (loan: LoanData, options?: SignatureOptions): Promise<jsPDF> => {
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

  // Fetch product fees for default template
  let processingFeePercent = 0;
  let processingFeeAmount = 0;
  let enforcementFeePercent = 0;
  let enforcementFeeAmount = 0;
  let insurancePercent = 0;
  let insuranceFeeAmount = 0;
  let platformFeePercent = 0;
  let platformFeeAmount = 0;
  let vatPercent = 0;
  let vatAmount = 0;
  let latePenaltyPercent = 5;
  let totalFeesDeducted = 0;
  if (loan.loan_product_id) {
    const { data: product } = await supabase
      .from('loan_products')
      .select('processing_fee_percent, late_payment_penalty_percent, enforcement_fee_percent, insurance_percent, vat_percent, platform_fee_percent')
      .eq('id', loan.loan_product_id)
      .single();
    if (product) {
      processingFeePercent = product.processing_fee_percent || 0;
      latePenaltyPercent = product.late_payment_penalty_percent || 5;
      enforcementFeePercent = product.enforcement_fee_percent || 0;
      insurancePercent = product.insurance_percent || 0;
      platformFeePercent = product.platform_fee_percent || 0;
      vatPercent = product.vat_percent || 0;

      processingFeeAmount = loan.loan_amount * (processingFeePercent / 100);
      enforcementFeeAmount = loan.loan_amount * (enforcementFeePercent / 100);
      insuranceFeeAmount = loan.loan_amount * (insurancePercent / 100);
      platformFeeAmount = loan.loan_amount * (platformFeePercent / 100);
      const vatableAmount = processingFeeAmount + enforcementFeeAmount + platformFeeAmount;
      vatAmount = vatableAmount * (vatPercent / 100);
      totalFeesDeducted = processingFeeAmount + enforcementFeeAmount + insuranceFeeAmount + platformFeeAmount + vatAmount;
    }
  }
  const disbursementAmount = loan.loan_amount - totalFeesDeducted;

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

  let sectionNum = 2;

  addSection(`${sectionNum}. LOAN DETAILS`, [
    `Principal Amount: K${loan.loan_amount.toLocaleString()}`,
    `Interest Rate: ${loan.interest_rate}% per month`,
    `Loan Term: ${loan.loan_term_months} months`,
    `Monthly Payment: K${loan.monthly_payment.toLocaleString()}`,
    `Total Repayment: K${loan.total_repayment.toLocaleString()}`,
    `Purpose: ${loan.loan_purpose?.replace('_', ' ').toUpperCase() || 'Personal'}`,
  ]);
  sectionNum++;

  addSection(`${sectionNum}. DISBURSEMENT`, [
    `The Lender agrees to disburse the loan amount on ${new Date().toLocaleDateString('en-GB')}.`,
  ]);
  sectionNum++;

  const firstPaymentDate = new Date();
  firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
  addSection(`${sectionNum}. REPAYMENT`, [
    `The Borrower agrees to repay the loan in ${loan.loan_term_months} equal monthly installments`,
    `on ${firstPaymentDate.toLocaleDateString('en-GB')}.`,
  ]);
  sectionNum++;

  if (loan.employer_name) {
    addSection(`${sectionNum}. BORROWER EMPLOYMENT DETAILS`, [
      `Employer: ${loan.employer_name}`,
      `Job Title: ${loan.job_title || 'N/A'}`,
      `Monthly Income: K${loan.monthly_income.toLocaleString()}`,
    ]);
    sectionNum++;
  }

  addSection(`${sectionNum}. LATE PAYMENT`, [
    `A penalty of ${latePenaltyPercent}% will be charged on any overdue installments.`,
  ]);
  sectionNum++;

  // Build fee breakdown lines
  const feeLines: string[] = [];
  if (processingFeePercent > 0) {
    feeLines.push(`Processing Fee (${processingFeePercent}%): K${Math.round(processingFeeAmount).toLocaleString()}`);
  }
  if (enforcementFeePercent > 0) {
    feeLines.push(`Enforcement Fee (${enforcementFeePercent}%): K${Math.round(enforcementFeeAmount).toLocaleString()}`);
  }
  if (insurancePercent > 0) {
    feeLines.push(`Insurance Fee (${insurancePercent}%): K${Math.round(insuranceFeeAmount).toLocaleString()}`);
  }
  if (platformFeePercent > 0) {
    feeLines.push(`Platform Fee (${platformFeePercent}%): K${Math.round(platformFeeAmount).toLocaleString()}`);
  }
  if (vatPercent > 0) {
    feeLines.push(`VAT (${vatPercent}%): K${Math.round(vatAmount).toLocaleString()}`);
  }
  if (feeLines.length === 0) {
    feeLines.push('No fees applicable.');
  }
  feeLines.push('');
  feeLines.push(`Total Fees Deducted: K${Math.round(totalFeesDeducted).toLocaleString()}`);
  feeLines.push(`Net Amount Disbursed to Borrower: K${Math.round(disbursementAmount).toLocaleString()}`);

  addSection(`${sectionNum}. FEES & DEDUCTIONS`, feeLines);
  sectionNum++;

  if (loan.collateral_description) {
    addSection(`${sectionNum}. COLLATERAL/SECURITY`, [
      `Description: ${loan.collateral_description}`,
      `Estimated Value: K${(loan.collateral_value || 0).toLocaleString()}`,
      '',
      'The Borrower pledges the above collateral as security for this loan.',
    ]);
    sectionNum++;
  }

  addSection('DECLARATION', [
    'By signing below, I, the undersigned, hereby acknowledge that I have read and understood all the terms and conditions of this Loan Agreement. I understand the Responsibilities, interest rates, fees, repayment schedule and any other associated costs.',
  ]);

  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  doc.text('Borrower Signature: ......................   Date: ....../......./..........', margin, yPos);
  yPos += 10;
  
  // If borrower signature provided, embed it
  if (options?.borrowerSignatureDataUrl) {
    try {
      doc.addImage(options.borrowerSignatureDataUrl, 'PNG', margin, yPos - 5, 60, 20);
      yPos += 20;
    } catch (e) {
      yPos += 5;
    }
  }
  
  doc.text(`Name: ${loan.full_name}`, margin, yPos);
  yPos += 10;

  doc.text('I further surrender the authority to Phindu Credit Solutions to recover the loan amount by all means', margin, yPos);
  yPos += 5;
  doc.text('necessary: property grabbing/seizure, DDACC, next of kin, payslip deductions.', margin, yPos);
  yPos += 15;

  doc.text('FOR PHINDU CREDIT SOLUTIONS LTD:', margin, yPos);
  yPos += 10;
  doc.line(margin, yPos, margin + 80, yPos);
  yPos += 5;
  doc.text('Name: ____________________', margin, yPos);
  yPos += 5;
  doc.text('Date: ____________________', margin, yPos);

  // Footer on all pages
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

// Main function to create contract PDF (async to fetch template)
const createContractPDF = async (loan: LoanData, options?: SignatureOptions): Promise<jsPDF> => {
  const template = await fetchActiveTemplate(loan.loan_product_id);
  
  if (template) {
    console.log(`Using custom template: ${template.name} (ID: ${template.id})`);
    const processedContent = await replacePlaceholders(template.content, loan);
    return createContractPDFFromTemplate(processedContent, loan);
  } else {
    console.log('No custom template found, using default template');
    return createDefaultContractPDF(loan, options);
  }
};

/**
 * Generate a signed contract PDF with borrower signature embedded.
 * Upload to storage and return the file path.
 */
export const generateSignedContractPDF = async (
  loan: LoanData,
  signatureDataUrl: string,
  borrowerSignedAt?: string,
  adminSignedAt?: string,
): Promise<string | null> => {
  try {
    const doc = await createContractPDF(loan, {
      borrowerSignatureDataUrl: signatureDataUrl,
      borrowerSignedAt: borrowerSignedAt || new Date().toISOString(),
      adminSignedAt,
    });
    const pdfBlob = doc.output('blob');
    const fileName = `contracts/signed_contract_${loan.id}_${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('loan-documents')
      .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('Failed to upload signed contract PDF:', uploadError);
      return null;
    }
    return fileName;
  } catch (error) {
    console.error('Error generating signed contract PDF:', error);
    return null;
  }
};

// Open in new window for printing (async version)
// If the loan has a stored contract_url, open that version instead of regenerating.
export const generateLoanContract = async (loan: LoanData & { contract_url?: string | null }) => {
  // Prefer stored contract to ensure consistency
  if (loan.contract_url) {
    try {
      const { data, error } = await supabase.storage
        .from('loan-documents')
        .createSignedUrl(loan.contract_url, 300);
      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
        return;
      }
    } catch (e) {
      console.warn('Failed to open stored contract, falling back to generation:', e);
    }
  }
  const doc = await createContractPDF(loan);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

// Download as PDF file (async version)
// If the loan has a stored contract_url, download that version from storage.
// Otherwise, generate a fresh PDF from the current template.
export const downloadLoanContract = async (loan: LoanData & { contract_url?: string | null }) => {
  // Prefer stored contract to ensure all users see the same version
  if (loan.contract_url) {
    try {
      const { data, error } = await supabase.storage
        .from('loan-documents')
        .createSignedUrl(loan.contract_url, 300);
      if (!error && data?.signedUrl) {
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Loan_Contract_${loan.full_name.replace(/\s+/g, '_')}_${loan.id.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    } catch (e) {
      console.warn('Failed to download stored contract, falling back to generation:', e);
    }
  }
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