import { downloadRepaymentReceipt } from "@phinduloans/shared/utils/generateRepaymentReceipt";
import type { PaymentReceiptData } from "@phinduloans/shared/services/repositories/houseWorkflowRepository";

interface CompanyInfo {
  name?: string;
  address?: string;
  support_phone?: string;
}

/**
 * Shared helper to download a payment receipt PDF from a record_loan_payment RPC response.
 * Centralizes mapping logic that was previously duplicated across House pages and the LoanDetailsModal.
 */
export function downloadReceiptFromRpc(
  receipt: PaymentReceiptData | null | undefined,
  options?: {
    loanReferenceFallback?: string;
    company?: CompanyInfo;
  },
) {
  if (!receipt || !receipt.receipt_no) return;
  const loanReference =
    (receipt.loan_id ? receipt.loan_id.slice(0, 8) : "") ||
    options?.loanReferenceFallback ||
    "";

  downloadRepaymentReceipt({
    borrowerName: receipt.borrower_name || "",
    borrowerPhone: receipt.borrower_phone || "",
    borrowerEmail: receipt.borrower_email || "",
    loanReference,
    loanAmount: receipt.loan_amount || 0,
    repaymentAmount: receipt.repayment_amount || 0,
    paymentDate: receipt.paid_date
      ? new Date(receipt.paid_date).toISOString()
      : new Date().toISOString(),
    paymentMethod: receipt.payment_method || "cash",
    transactionReference: receipt.receipt_no,
    installmentNumber: receipt.installment_number || 0,
    totalInstallments: receipt.total_installments || 0,
    totalPaid: receipt.total_paid || 0,
    outstandingBalance: receipt.outstanding_balance || 0,
    companyName: options?.company?.name,
    companyAddress: options?.company?.address,
    companyPhone: options?.company?.support_phone,
  });
}
