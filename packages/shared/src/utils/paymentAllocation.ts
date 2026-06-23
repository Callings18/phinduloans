/**
 * Pure client-side preview of how a lump-sum payment is allocated across a
 * loan's installments. Mirrors the server-side `record_loan_payment` cascade:
 *  1. Penalty is applied first, earliest installment → latest.
 *  2. Remaining principal is applied next, earliest installment → latest.
 *
 * This lets the guided payment flow show — in real time, as the operator types —
 * which installments become "partial"/"paid", the resulting outstanding balance,
 * and whether the loan will complete. It is preview-only; the RPC remains the
 * single source of truth when the payment is actually recorded.
 */

export interface AllocationInstallment {
  id: string;
  installment_number: number;
  amount?: number | string | null;
  original_amount?: number | string | null;
  principal_paid?: number | string | null;
  penalty_amount?: number | string | null;
  penalty_paid?: number | string | null;
  status?: string | null;
}

export interface AllocationLine {
  id: string;
  installmentNumber: number;
  principalApplied: number;
  penaltyApplied: number;
  /** Status this installment will have after the payment is applied. */
  newStatus: "paid" | "partial" | "pending";
  principalRemainingAfter: number;
  penaltyRemainingAfter: number;
}

export interface AllocationPreview {
  lines: AllocationLine[];
  principalApplied: number;
  penaltyApplied: number;
  /** Portion of the entered amount that could not be allocated (overpayment). */
  unapplied: number;
  outstandingBefore: number;
  outstandingAfter: number;
  willComplete: boolean;
}

const n = (v: number | string | null | undefined): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * @param installments  All schedule rows for the loan (any status).
 * @param amount        Total payment being recorded.
 * @param penaltyAllocation  Portion of `amount` to put toward penalties.
 *                           Defaults to covering as much outstanding penalty as possible.
 */
export function previewAllocation(
  installments: AllocationInstallment[],
  amount: number,
  penaltyAllocation?: number,
): AllocationPreview {
  const payable = installments
    .filter((r) => {
      const s = (r.status ?? "pending").toLowerCase();
      return s === "pending" || s === "overdue" || s === "partial";
    })
    .sort((a, b) => n(a.installment_number) - n(b.installment_number));

  const principalDue = (r: AllocationInstallment) =>
    Math.max(n(r.original_amount ?? r.amount) - n(r.principal_paid), 0);
  const penaltyDue = (r: AllocationInstallment) =>
    Math.max(n(r.penalty_amount) - n(r.penalty_paid), 0);

  const totalPenaltyDue = payable.reduce((s, r) => s + penaltyDue(r), 0);
  const totalPrincipalDue = payable.reduce((s, r) => s + principalDue(r), 0);
  const outstandingBefore = round2(totalPrincipalDue + totalPenaltyDue);

  const amt = Math.max(0, n(amount));
  let penaltyBudget =
    penaltyAllocation === undefined
      ? Math.min(amt, totalPenaltyDue)
      : Math.min(Math.max(0, n(penaltyAllocation)), amt, totalPenaltyDue);
  let principalBudget = round2(amt - penaltyBudget);

  const state = new Map<string, { principalApplied: number; penaltyApplied: number }>();
  payable.forEach((r) => state.set(r.id, { principalApplied: 0, penaltyApplied: 0 }));

  // Pass 1: penalties, earliest first.
  for (const r of payable) {
    if (penaltyBudget <= 0.005) break;
    const due = penaltyDue(r);
    if (due <= 0) continue;
    const apply = Math.min(penaltyBudget, due);
    state.get(r.id)!.penaltyApplied = round2(apply);
    penaltyBudget = round2(penaltyBudget - apply);
  }

  // Pass 2: principal, earliest first.
  for (const r of payable) {
    if (principalBudget <= 0.005) break;
    const due = principalDue(r);
    if (due <= 0) continue;
    const apply = Math.min(principalBudget, due);
    state.get(r.id)!.principalApplied = round2(apply);
    principalBudget = round2(principalBudget - apply);
  }

  const unapplied = round2(Math.max(penaltyBudget, 0) + Math.max(principalBudget, 0));

  let principalApplied = 0;
  let penaltyApplied = 0;
  const lines: AllocationLine[] = payable.map((r) => {
    const st = state.get(r.id)!;
    principalApplied = round2(principalApplied + st.principalApplied);
    penaltyApplied = round2(penaltyApplied + st.penaltyApplied);
    const principalRemainingAfter = round2(principalDue(r) - st.principalApplied);
    const penaltyRemainingAfter = round2(penaltyDue(r) - st.penaltyApplied);
    const touched = st.principalApplied > 0 || st.penaltyApplied > 0;
    let newStatus: AllocationLine["newStatus"];
    if (principalRemainingAfter <= 0.01 && penaltyRemainingAfter <= 0.01) {
      newStatus = "paid";
    } else if (touched || n(r.principal_paid) > 0 || n(r.penalty_paid) > 0) {
      newStatus = "partial";
    } else {
      newStatus = "pending";
    }
    return {
      id: r.id,
      installmentNumber: n(r.installment_number),
      principalApplied: st.principalApplied,
      penaltyApplied: st.penaltyApplied,
      newStatus,
      principalRemainingAfter,
      penaltyRemainingAfter,
    };
  });

  const outstandingAfter = round2(outstandingBefore - principalApplied - penaltyApplied);
  const willComplete = outstandingAfter <= 0.01 && outstandingBefore > 0;

  return {
    lines,
    principalApplied,
    penaltyApplied,
    unapplied,
    outstandingBefore,
    outstandingAfter,
    willComplete,
  };
}
