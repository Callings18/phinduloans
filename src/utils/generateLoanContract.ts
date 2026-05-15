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

// ─── Multi-borrower (Collateral only) helpers ───────────────────────────────
interface LoanBorrowerRow {
  id: string;
  full_name: string;
  nrc_number: string;
  phone: string | null;
  address: string | null;
  role: 'PRIMARY_BORROWER' | 'CO_BORROWER' | 'ABSOLUTE_OWNER' | 'GUARANTOR';
  is_signatory: boolean;
}

interface CollateralPartiesContext {
  isCollateral: boolean;
  borrowers: LoanBorrowerRow[];
  signatories: LoanBorrowerRow[];
  absoluteOwners: LoanBorrowerRow[];
  jointBorrowers: LoanBorrowerRow[]; // primary + co
}

const fetchCollateralParties = async (loan: LoanData): Promise<CollateralPartiesContext> => {
  const empty: CollateralPartiesContext = {
    isCollateral: false,
    borrowers: [],
    signatories: [],
    absoluteOwners: [],
    jointBorrowers: [],
  };
  if (!loan.loan_product_id) return empty;
  try {
    const { data: product } = await supabase
      .from('loan_products')
      .select('product_code')
      .eq('id', loan.loan_product_id)
      .maybeSingle();
    if ((product as any)?.product_code !== 'COLLATERAL') return empty;

    const { data: rows } = await supabase
      .from('loan_borrowers')
      .select('id, full_name, nrc_number, phone, address, role, is_signatory')
      .eq('loan_application_id', loan.id);

    const borrowers = (rows || []) as LoanBorrowerRow[];
    return {
      isCollateral: true,
      borrowers,
      signatories: borrowers.filter((b) => b.is_signatory),
      absoluteOwners: borrowers.filter((b) => b.role === 'ABSOLUTE_OWNER'),
      jointBorrowers: borrowers.filter((b) => b.role === 'PRIMARY_BORROWER' || b.role === 'CO_BORROWER'),
    };
  } catch (e) {
    console.warn('fetchCollateralParties failed:', e);
    return empty;
  }
};

const formatBorrowersBlock = (rows: LoanBorrowerRow[]): string => {
  if (!rows.length) return '';
  return rows
    .map((b, i) => {
      const roleLabel =
        b.role === 'PRIMARY_BORROWER'
          ? 'Primary Borrower'
          : b.role === 'CO_BORROWER'
          ? 'Co-Borrower'
          : b.role === 'ABSOLUTE_OWNER'
          ? 'Absolute Owner'
          : 'Guarantor';
      return `${i + 1}. ${b.full_name} | NRC: ${b.nrc_number} | ${roleLabel}${b.phone ? ` | Phone: ${b.phone}` : ''}`;
    })
    .join('\n');
};

const JOINT_LIABILITY_CLAUSE =
  'All Borrowers and Co-Borrowers named in this Agreement are jointly and severally liable for the full repayment of the loan, including principal, interest, fees, and any penalties. The Lender may pursue any one or more of them for the entire outstanding amount.';

// ─── Repayment cadence (daily / bullet / monthly) ──────────────────────────
type Cadence = 'daily' | 'bullet' | 'monthly';

interface CadenceContext {
  cadence: Cadence;
  installmentLabel: string;       // e.g. "Daily Installment"
  installmentAmount: number;      // K value of one installment (or full bullet)
  termLabel: string;              // e.g. "26 days", "30 days", "12 months"
  interestLabel: string;          // e.g. "30% flat for the cycle"
  repaymentSummary: string;       // sentence used in REPAYMENT section
  firstPaymentDate: Date;         // sensible default first due date
}

const resolveCadence = async (loan: LoanData): Promise<CadenceContext> => {
  let productCode: string | null = null;
  let repaymentFrequency: string | null = null;
  let termUnit: string | null = null;
  if (loan.loan_product_id) {
    const { data } = await supabase
      .from('loan_products')
      .select('product_code, repayment_frequency, term_unit')
      .eq('id', loan.loan_product_id)
      .maybeSingle();
    productCode = (data as any)?.product_code ?? null;
    repaymentFrequency = (data as any)?.repayment_frequency ?? null;
    termUnit = (data as any)?.term_unit ?? null;
  }

  const dailyish = repaymentFrequency === 'daily' || productCode === 'MARKETEER';
  const bulletish =
    repaymentFrequency === 'bullet' ||
    productCode === 'PAYDAY_SOFT' ||
    (loan.loan_term_months === 30 && termUnit === 'days');

  const cadence: Cadence = dailyish ? 'daily' : bulletish ? 'bullet' : 'monthly';

  const installmentAmount =
    Number(loan.monthly_payment) ||
    (cadence === 'bullet' ? Number(loan.total_repayment) : 0);

  if (cadence === 'daily') {
    const days = loan.loan_term_months || 26;
    const first = new Date();
    first.setDate(first.getDate() + 1); // next collection day
    return {
      cadence,
      installmentLabel: 'Daily Installment',
      installmentAmount,
      termLabel: `${days} days`,
      interestLabel: `${loan.interest_rate}% flat for the cycle`,
      repaymentSummary: `The Borrower agrees to repay the loan in ${days} equal daily installments (Monday–Saturday) of K${installmentAmount.toLocaleString()} starting ${first.toLocaleDateString('en-GB')}.`,
      firstPaymentDate: first,
    };
  }

  if (cadence === 'bullet') {
    const days = termUnit === 'days' ? loan.loan_term_months || 30 : 30;
    const due = new Date();
    due.setDate(due.getDate() + days);
    return {
      cadence,
      installmentLabel: 'Single Bullet Payment',
      installmentAmount: Number(loan.total_repayment),
      termLabel: `${days} days`,
      interestLabel: `${loan.interest_rate}% for the period`,
      repaymentSummary: `The Borrower agrees to repay the full amount of K${Number(loan.total_repayment).toLocaleString()} as a single bullet payment on ${due.toLocaleDateString('en-GB')}.`,
      firstPaymentDate: due,
    };
  }

  const first = new Date();
  first.setMonth(first.getMonth() + 1);
  return {
    cadence,
    installmentLabel: 'Monthly Payment',
    installmentAmount,
    termLabel: `${loan.loan_term_months} months`,
    interestLabel: `${loan.interest_rate}% per month`,
    repaymentSummary: `The Borrower agrees to repay the loan in ${loan.loan_term_months} equal monthly installments of K${installmentAmount.toLocaleString()} starting ${first.toLocaleDateString('en-GB')}.`,
    firstPaymentDate: first,
  };
};

// Replace placeholders in template content with actual loan data
const replacePlaceholders = async (content: string, loan: LoanData): Promise<string> => {
  const disbursementDate = new Date();
  const cadenceCtx = await resolveCadence(loan);
  const firstPaymentDate = cadenceCtx.firstPaymentDate;

  // Fetch product fees
  let processingFeePercent = 0;
  let latePenalty = 5;
  let processingFeeAmount = 0;
  let totalFeesAmount = 0;
  let disbursementNetAmount = loan.loan_amount;
  if (loan.loan_product_id) {
    const { data: product } = await supabase
      .from('loan_products')
      .select('processing_fee_percent, late_payment_penalty_percent, enforcement_fee_percent, insurance_percent, vat_percent, platform_fee_percent')
      .eq('id', loan.loan_product_id)
      .single();
    if (product) {
      processingFeePercent = product.processing_fee_percent || 0;
      latePenalty = product.late_payment_penalty_percent || 5;
      processingFeeAmount = loan.loan_amount * (processingFeePercent / 100);
      const enforcementFee = loan.loan_amount * ((product.enforcement_fee_percent || 0) / 100);
      const insuranceFee = loan.loan_amount * ((product.insurance_percent || 0) / 100);
      const platformFee = loan.loan_amount * ((product.platform_fee_percent || 0) / 100);
      const vatableAmount = processingFeeAmount + enforcementFee + platformFee;
      const vatAmount = vatableAmount * ((product.vat_percent || 0) / 100);
      totalFeesAmount = processingFeeAmount + enforcementFee + insuranceFee + platformFee + vatAmount;
      disbursementNetAmount = loan.loan_amount - totalFeesAmount;
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
    '{{monthly_payment}}': cadenceCtx.installmentAmount.toLocaleString(),
    '{{installment_amount}}': cadenceCtx.installmentAmount.toLocaleString(),
    '{{installment_label}}': cadenceCtx.installmentLabel,
    '{{term_label}}': cadenceCtx.termLabel,
    '{{interest_label}}': cadenceCtx.interestLabel,
    '{{repayment_schedule_summary}}': cadenceCtx.repaymentSummary,
    '{{total_repayment}}': loan.total_repayment.toLocaleString(),
    '{{disbursement_date}}': disbursementDate.toLocaleDateString('en-GB'),
    '{{first_payment_date}}': firstPaymentDate.toLocaleDateString('en-GB'),
    '{{company_name}}': 'Phindu Credit Solutions Limited',
    '{{company_address}}': 'Lusaka, Zambia',
    '{{current_date}}': new Date().toLocaleDateString('en-GB'),
    '{{loan_purpose}}': loan.loan_purpose?.replace('_', ' ').toUpperCase() || 'Personal',
    '{{processing_fee}}': `K${Math.round(processingFeeAmount).toLocaleString()} (${processingFeePercent}%)`,
    '{{total_fees}}': `K${Math.round(totalFeesAmount).toLocaleString()}`,
    '{{disbursement_net}}': `K${Math.round(disbursementNetAmount).toLocaleString()}`,
    '{{late_penalty}}': latePenalty.toString(),
    '{{collateral_description}}': loan.collateral_description || 'N/A',
    '{{collateral_value}}': (loan.collateral_value || 0).toLocaleString(),
    '{{employer_name}}': loan.employer_name || 'N/A',
    '{{job_title}}': loan.job_title || 'N/A',
    '{{monthly_income}}': loan.monthly_income.toLocaleString(),
    '{{contract_number}}': `PCS-${loan.id.slice(0, 8).toUpperCase()}`,
  };

  // Collateral-only multi-borrower placeholders
  const parties = await fetchCollateralParties(loan);
  if (parties.isCollateral) {
    replacements['{{borrowers_block}}'] = formatBorrowersBlock(parties.jointBorrowers) || loan.full_name;
    replacements['{{absolute_owners_block}}'] =
      parties.absoluteOwners.length > 0
        ? formatBorrowersBlock(parties.absoluteOwners)
        : 'N/A';
    replacements['{{joint_liability_clause}}'] = JOINT_LIABILITY_CLAUSE;
  } else {
    replacements['{{borrowers_block}}'] = `${loan.full_name} | NRC: ${loan.nrc_number}`;
    replacements['{{absolute_owners_block}}'] = 'N/A';
    replacements['{{joint_liability_clause}}'] = '';
  }

  // (placeholders ready)

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

  // Fetch multi-borrower context (collateral only) and repayment cadence
  const parties = await fetchCollateralParties(loan);
  const cadenceCtx = await resolveCadence(loan);
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

  if (parties.isCollateral && parties.borrowers.length > 0) {
    const partyLines: string[] = [
      'This Loan Agreement ("Agreement") is entered into as of the date stated above between:',
      '',
      'LENDER: Phindu Credit Solutions Limited',
      'Address: Lusaka, Zambia',
      '',
      'BORROWERS (jointly and severally liable):',
    ];
    parties.jointBorrowers.forEach((b, i) => {
      const roleLabel = b.role === 'PRIMARY_BORROWER' ? 'Primary Borrower' : 'Co-Borrower';
      partyLines.push('');
      partyLines.push(`${i + 1}. ${roleLabel}: ${b.full_name}`);
      partyLines.push(`   NRC: ${b.nrc_number}${b.phone ? ` | Phone: ${b.phone}` : ''}`);
      if (b.address) partyLines.push(`   Address: ${b.address}`);
    });
    if (parties.absoluteOwners.length > 0) {
      partyLines.push('');
      partyLines.push('ABSOLUTE OWNER(S) OF COLLATERAL:');
      parties.absoluteOwners.forEach((b, i) => {
        partyLines.push('');
        partyLines.push(`${i + 1}. ${b.full_name}`);
        partyLines.push(`   NRC: ${b.nrc_number}${b.phone ? ` | Phone: ${b.phone}` : ''}`);
        if (b.address) partyLines.push(`   Address: ${b.address}`);
      });
    }
    addSection('1. PARTIES TO THIS AGREEMENT', partyLines);
  } else {
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
  }

  let sectionNum = 2;

  addSection(`${sectionNum}. LOAN DETAILS`, [
    `Principal Amount: K${loan.loan_amount.toLocaleString()}`,
    `Interest Rate: ${cadenceCtx.interestLabel}`,
    `Loan Term: ${cadenceCtx.termLabel}`,
    `${cadenceCtx.installmentLabel}: K${cadenceCtx.installmentAmount.toLocaleString()}`,
    `Total Repayment: K${loan.total_repayment.toLocaleString()}`,
    `Purpose: ${loan.loan_purpose?.replace('_', ' ').toUpperCase() || 'Personal'}`,
  ]);
  sectionNum++;

  addSection(`${sectionNum}. DISBURSEMENT`, [
    `The Lender agrees to disburse the loan amount on ${new Date().toLocaleDateString('en-GB')}.`,
  ]);
  sectionNum++;

  addSection(`${sectionNum}. REPAYMENT`, [cadenceCtx.repaymentSummary]);
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

  // Joint and several liability clause (collateral only)
  if (parties.isCollateral) {
    addSection(`${sectionNum}. JOINT AND SEVERAL LIABILITY`, [JOINT_LIABILITY_CLAUSE]);
    sectionNum++;
  }

  addSection('DECLARATION', [
    'By signing below, the undersigned hereby acknowledge that they have read and understood all the terms and conditions of this Loan Agreement, including the responsibilities, interest rates, fees, repayment schedule, and any other associated costs.',
  ]);

  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  // Build the list of signatories
  const signatories: Array<{ name: string; nrc: string; role: string; signatureDataUrl?: string }> =
    parties.isCollateral && parties.signatories.length > 0
      ? parties.signatories.map((b, i) => ({
          name: b.full_name,
          nrc: b.nrc_number,
          role:
            b.role === 'PRIMARY_BORROWER'
              ? 'Primary Borrower'
              : b.role === 'CO_BORROWER'
              ? 'Co-Borrower'
              : 'Absolute Owner',
          // Only embed the signature image for the first primary borrower (the user who signed in-app)
          signatureDataUrl: i === 0 && b.role === 'PRIMARY_BORROWER' ? options?.borrowerSignatureDataUrl : undefined,
        }))
      : [
          {
            name: loan.full_name,
            nrc: loan.nrc_number,
            role: 'Borrower',
            signatureDataUrl: options?.borrowerSignatureDataUrl,
          },
        ];

  signatories.forEach((s, idx) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`${idx + 1}. ${s.role.toUpperCase()}`, margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${s.name}`, margin, yPos);
    yPos += 5;
    doc.text(`NRC: ${s.nrc}`, margin, yPos);
    yPos += 8;
    doc.text('Signature: ____________________________   Date: ____/____/______', margin, yPos);
    if (s.signatureDataUrl) {
      try {
        doc.addImage(s.signatureDataUrl, 'PNG', margin + 25, yPos - 5, 60, 18);
      } catch {
        /* ignore */
      }
    }
    yPos += 14;
  });

  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }
  doc.text('I/We further surrender the authority to Phindu Credit Solutions to recover the loan amount by all means', margin, yPos);
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
    if (import.meta.env.DEV) console.log(`Using custom template: ${template.name}`);
    const processedContent = await replacePlaceholders(template.content, loan);
    return createContractPDFFromTemplate(processedContent, loan);
  } else {
    if (import.meta.env.DEV) console.log('No custom template found, using default template');
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
  
  const cadenceCtx = await resolveCadence(loan);
  const message = `Hello ${loan.full_name},\n\n` +
    `Please find your Loan Agreement Contract from Phindu Credit Solutions.\n\n` +
    `Loan Details:\n` +
    `- Contract No: PCS-${loan.id.slice(0, 8).toUpperCase()}\n` +
    `- Loan Amount: K${loan.loan_amount.toLocaleString()}\n` +
    `- ${cadenceCtx.installmentLabel}: K${cadenceCtx.installmentAmount.toLocaleString()}\n` +
    `- Term: ${cadenceCtx.termLabel}\n\n` +
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
  const cadenceCtx = await resolveCadence(loan);
  const message = 
    `Dear ${loan.full_name},\n\n` +
    `Please find your Loan Agreement Contract from Phindu Credit Solutions.\n\n` +
    `Loan Details:\n` +
    `- Contract No: PCS-${loan.id.slice(0, 8).toUpperCase()}\n` +
    `- Loan Amount: K${loan.loan_amount.toLocaleString()}\n` +
    `- Interest: ${cadenceCtx.interestLabel}\n` +
    `- ${cadenceCtx.installmentLabel}: K${cadenceCtx.installmentAmount.toLocaleString()}\n` +
    `- Term: ${cadenceCtx.termLabel}\n` +
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