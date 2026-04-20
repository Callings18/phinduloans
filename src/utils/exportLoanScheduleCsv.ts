import { format } from "date-fns";

interface RepaymentRow {
  installment_number?: number | null;
  due_date: string;
  amount: number | string;
  original_amount?: number | string | null;
  principal_paid?: number | string | null;
  status: string;
  paid_date?: string | null;
  payment_method?: string | null;
  transaction_reference?: string | null;
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const downloadLoanScheduleCsv = (
  loanReference: string,
  borrowerName: string,
  repayments: RepaymentRow[],
) => {
  const header = [
    "Installment",
    "Due Date",
    "Amount (K)",
    "Paid (K)",
    "Status",
    "Paid Date",
    "Method",
    "Reference",
  ];
  const rows = repayments.map((r) => [
    r.installment_number ?? "",
    format(new Date(r.due_date), "yyyy-MM-dd"),
    Number(r.original_amount ?? r.amount ?? 0).toFixed(2),
    Number(r.principal_paid ?? 0).toFixed(2),
    r.status,
    r.paid_date ? format(new Date(r.paid_date), "yyyy-MM-dd") : "",
    r.payment_method ?? "",
    r.transaction_reference ?? "",
  ]);
  const meta = [
    [`Loan Statement`],
    [`Borrower`, borrowerName],
    [`Reference`, loanReference],
    [`Generated`, format(new Date(), "yyyy-MM-dd HH:mm")],
    [],
  ];
  const csv = [...meta, header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Statement_${loanReference}_${format(new Date(), "yyyyMMdd")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
