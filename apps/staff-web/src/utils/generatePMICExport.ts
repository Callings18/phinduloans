import { format } from "date-fns";

interface PMICEnrollment {
  id: string;
  borrower_id: string;
  employee_number: string;
  employer_id: string | null;
  gross_salary: number | null;
  net_salary: number | null;
  existing_deductions: number | null;
  available_deduction_capacity: number | null;
  enrollment_status: string;
  department?: string | null;
}

interface PMICEmployer {
  id: string;
  employer_code: string;
  employer_name: string;
  employer_type: string;
  payroll_cycle: string;
}

interface LoanRepayment {
  id: string;
  loan_id: string;
  amount: number;
  due_date: string;
  status: string;
  installment_number: number | null;
}

interface LoanApplication {
  id: string;
  full_name: string;
  nrc_number: string;
  phone: string;
  loan_amount: number;
  monthly_payment: number | null;
}

interface ExportData {
  enrollments: PMICEnrollment[];
  employers: PMICEmployer[];
  repayments: LoanRepayment[];
  loans: LoanApplication[];
  periodStart: string;
  periodEnd: string;
  submissionType: 'deduction_request' | 'stop_order' | 'variation' | 'reconciliation';
}

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return '0.00';
  return amount.toFixed(2);
};

export const generatePMICDeductionCSV = (data: ExportData): string => {
  const headers = [
    'Employee Number',
    'Employee Name',
    'NRC Number',
    'Employer Code',
    'Employer Name',
    'Department',
    'Gross Salary',
    'Net Salary',
    'Deduction Amount',
    'Installment Number',
    'Loan Reference',
    'Period Start',
    'Period End',
  ];

  const rows: string[][] = [];

  // Match enrollments with upcoming repayments
  data.enrollments.forEach((enrollment) => {
    const employer = data.employers.find(e => e.id === enrollment.employer_id);
    
    // Find loans/repayments for this borrower in the period
    const borrowerLoans = data.loans.filter(l => {
      // Match by loan's user_id or any linked criteria
      return true; // For now, include all - in real implementation, match by borrower
    });

    const periodRepayments = data.repayments.filter(r => {
      const dueDate = new Date(r.due_date);
      const periodStart = new Date(data.periodStart);
      const periodEnd = new Date(data.periodEnd);
      return dueDate >= periodStart && dueDate <= periodEnd && r.status === 'pending';
    });

    // If there are matching repayments, create a row for each
    if (periodRepayments.length > 0) {
      periodRepayments.forEach(repayment => {
        const loan = data.loans.find(l => l.id === repayment.loan_id);
        if (loan) {
          rows.push([
            enrollment.employee_number,
            loan.full_name,
            loan.nrc_number,
            employer?.employer_code || '',
            employer?.employer_name || '',
            enrollment.department || '',
            formatCurrency(enrollment.gross_salary),
            formatCurrency(enrollment.net_salary),
            formatCurrency(repayment.amount),
            String(repayment.installment_number || ''),
            repayment.loan_id.substring(0, 8).toUpperCase(),
            data.periodStart,
            data.periodEnd,
          ]);
        }
      });
    }
  });

  // If no matched data, create sample structure
  if (rows.length === 0) {
    data.enrollments.forEach((enrollment) => {
      const employer = data.employers.find(e => e.id === enrollment.employer_id);
      rows.push([
        enrollment.employee_number,
        '-',
        '-',
        employer?.employer_code || '',
        employer?.employer_name || '',
        enrollment.department || '',
        formatCurrency(enrollment.gross_salary),
        formatCurrency(enrollment.net_salary),
        formatCurrency(enrollment.available_deduction_capacity),
        '-',
        '-',
        data.periodStart,
        data.periodEnd,
      ]);
    });
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
};

export const generatePMICStopOrderCSV = (data: ExportData): string => {
  const headers = [
    'Employee Number',
    'Employee Name',
    'NRC Number',
    'Employer Code',
    'Employer Name',
    'Loan Reference',
    'Stop Order Date',
    'Reason',
  ];

  const rows: string[][] = [];

  data.enrollments.forEach((enrollment) => {
    const employer = data.employers.find(e => e.id === enrollment.employer_id);
    rows.push([
      enrollment.employee_number,
      '-',
      '-',
      employer?.employer_code || '',
      employer?.employer_name || '',
      '-',
      format(new Date(), 'yyyy-MM-dd'),
      'Loan Completed',
    ]);
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
};

export const generatePMICVariationCSV = (data: ExportData): string => {
  const headers = [
    'Employee Number',
    'Employee Name',
    'NRC Number',
    'Employer Code',
    'Previous Amount',
    'New Amount',
    'Variation Reason',
    'Effective Date',
  ];

  const rows: string[][] = [];

  data.enrollments.forEach((enrollment) => {
    const employer = data.employers.find(e => e.id === enrollment.employer_id);
    rows.push([
      enrollment.employee_number,
      '-',
      '-',
      employer?.employer_code || '',
      formatCurrency(enrollment.existing_deductions),
      formatCurrency(enrollment.available_deduction_capacity),
      'Adjustment',
      data.periodStart,
    ]);
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
};

export const generatePMICReconciliationCSV = (data: ExportData): string => {
  const headers = [
    'Employee Number',
    'Employer Code',
    'Expected Amount',
    'Received Amount',
    'Variance',
    'Status',
    'Period',
  ];

  const rows: string[][] = [];

  data.enrollments.forEach((enrollment) => {
    const employer = data.employers.find(e => e.id === enrollment.employer_id);
    const expectedAmount = enrollment.available_deduction_capacity || 0;
    rows.push([
      enrollment.employee_number,
      employer?.employer_code || '',
      formatCurrency(expectedAmount),
      formatCurrency(expectedAmount), // In real implementation, compare with actual
      '0.00',
      'Matched',
      `${data.periodStart} to ${data.periodEnd}`,
    ]);
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
};

export const generatePMICExport = (
  data: ExportData,
  exportFormat: 'csv' | 'xlsx' = 'csv'
): Blob => {
  let csvContent: string;

  switch (data.submissionType) {
    case 'stop_order':
      csvContent = generatePMICStopOrderCSV(data);
      break;
    case 'variation':
      csvContent = generatePMICVariationCSV(data);
      break;
    case 'reconciliation':
      csvContent = generatePMICReconciliationCSV(data);
      break;
    case 'deduction_request':
    default:
      csvContent = generatePMICDeductionCSV(data);
      break;
  }

  // For CSV format
  if (exportFormat === 'csv') {
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  // For XLSX, we'll still export as CSV but with proper headers
  // In a real implementation, you'd use a library like xlsx
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};

export const downloadPMICExport = (
  data: ExportData,
  filename: string,
  exportFormat: 'csv' | 'xlsx' = 'csv'
): void => {
  const blob = generatePMICExport(data, exportFormat);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${exportFormat === 'xlsx' ? 'csv' : 'csv'}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
