/** Remaining due on an installment (Kwacha), after partial principal payments. */
export function repaymentRemainingKwacha(rep: {
  amount?: number | string | null;
  original_amount?: number | string | null;
  principal_paid?: number | string | null;
  status?: string | null;
}): number {
  const base = Number(rep.original_amount ?? rep.amount ?? 0);
  const paid = Number(rep.principal_paid ?? (rep.status === "paid" ? base : 0));
  return Math.max(0, Math.round((base - paid) * 100) / 100);
}
