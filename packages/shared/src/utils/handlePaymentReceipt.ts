import { downloadRepaymentReceipt } from "@phinduloans/shared/utils/generateRepaymentReceipt";

/**
 * Shape of the receipt payload returned by the record_loan_payment RPC.
 * Defined locally here so the shared helper has no dependency on app-level repositories.
 */
export interface PaymentReceiptData {
  success?: boolean;
  error?: string;
  receipt_no?: string;
  transaction_reference?: string;
  borrower_name?: string;
  borrower_phone?: string;
  borrower_email?: string;
  loan_id?: string;
  loan_amount?: number | string;
  repayment_amount?: number | string;
  amount?: number | string;
  payment_method?: string;
  paid_date?: string;
  installment_number?: number | string;
  total_installments?: number | string;
  total_paid?: number | string;
  outstanding_balance?: number | string;
  remaining_balance?: number | string;
  loan_completed?: boolean;
}

interface CompanyInfo {
  name?: string;
  address?: string;
  support_phone?: string;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ""): string {
  if (value == null || value === "") return fallback;
  return String(value);
}

/** Normalise a record_loan_payment RPC JSON envelope into receipt fields. */
export function mapRpcToReceiptData(
  rpc: Record<string, unknown> | PaymentReceiptData | null | undefined,
): PaymentReceiptData | null {
  if (!rpc || typeof rpc !== "object") return null;
  if (rpc.success !== true) return null;

  const receiptNo =
    asString(rpc.receipt_no) ||
    asString(rpc.transaction_reference) ||
    `RCP-${Date.now().toString().slice(-8)}`;

  return {
    success: true,
    receipt_no: receiptNo,
    borrower_name: asString(rpc.borrower_name),
    borrower_phone: asString(rpc.borrower_phone),
    borrower_email: asString(rpc.borrower_email),
    loan_id: asString(rpc.loan_id),
    loan_amount: asNumber(rpc.loan_amount),
    repayment_amount: asNumber(rpc.repayment_amount ?? rpc.amount),
    payment_method: asString(rpc.payment_method, "cash"),
    paid_date: asString(rpc.paid_date) || new Date().toISOString().split("T")[0],
    installment_number: asNumber(rpc.installment_number),
    total_installments: asNumber(rpc.total_installments),
    total_paid: asNumber(rpc.total_paid),
    outstanding_balance: asNumber(rpc.outstanding_balance ?? rpc.remaining_balance),
    loan_completed: Boolean(rpc.loan_completed),
  };
}

/**
 * Download a payment receipt PDF from a record_loan_payment RPC response.
 * Centralizes mapping logic used across House pages, Admin Repayments, and LoanDetailsModal.
 */
export function downloadReceiptFromRpc(
  receipt: PaymentReceiptData | Record<string, unknown> | null | undefined,
  options?: {
    loanReferenceFallback?: string;
    company?: CompanyInfo;
  },
) {
  const mapped = mapRpcToReceiptData(receipt);
  if (!mapped) return;

  const loanReference =
    (mapped.loan_id ? mapped.loan_id.slice(0, 8).toUpperCase() : "") ||
    options?.loanReferenceFallback?.slice(0, 8).toUpperCase() ||
    "LOAN";

  downloadRepaymentReceipt({
    borrowerName: mapped.borrower_name || "Borrower",
    borrowerPhone: mapped.borrower_phone || "",
    borrowerEmail: mapped.borrower_email || "",
    loanReference: loanReference.startsWith("LOAN-") ? loanReference : `LOAN-${loanReference}`,
    loanAmount: asNumber(mapped.loan_amount),
    repaymentAmount: asNumber(mapped.repayment_amount),
    paymentDate: mapped.paid_date || new Date().toISOString(),
    paymentMethod: mapped.payment_method || "cash",
    transactionReference: mapped.receipt_no || "",
    installmentNumber: asNumber(mapped.installment_number, 1),
    totalInstallments: asNumber(mapped.total_installments, 1),
    totalPaid: asNumber(mapped.total_paid),
    outstandingBalance: asNumber(mapped.outstanding_balance),
    companyName: options?.company?.name,
    companyAddress: options?.company?.address,
    companyPhone: options?.company?.support_phone,
  });
}
