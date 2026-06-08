# Fix: replaced loan still shows as overdue

## What's happening

Cynthia has three loan cycles. The one you replaced (K9,689, dated 25 Apr) is correctly marked **completed**, and her new loan (K8,980.15) is **active**. The problem is the *completed* loan still has one leftover installment row (status `partial`, due 25 May, K12,595.70) that was never closed when the loan was completed.

The Loans page builds its "overdue" list purely from installment rows and **ignores the parent loan's status**. So:

- The new loan shows under **Active** (correct)
- The old completed loan gets flagged **"1 late · K12,595.7 · 14 days late"** (wrong)

That's why she appears in both Active and Late, and why the header reads "1 overdue".

I confirmed in the database that this is the **only** loan affected by the leftover row.

## The fix (two parts)

### 1. Data cleanup (one-off)
Close the orphaned installment on the completed loan so the stale "overdue" record disappears. This targets any loan already in a terminal state (`completed`, `rejected`, `defaulted`) that still has open installment rows (`pending`, `overdue`, `partial`) and marks those rows `cancelled` — exactly what the loan-closure trigger is supposed to do. Only Cynthia's one row matches today.

### 2. UI guard (prevents recurrence)
Update the overdue calculation on the house Loans page so it **only counts installments belonging to loans that are still active/disbursed**. Completed, rejected, defaulted and other terminal loans can never be flagged overdue again, even if a stray row survives. This keeps the overdue count, the late-bucket KPI cards, the late quick-filters, and the per-row "X late" badge all consistent with the loan's real status.

## Technical details

- **Migration**: `UPDATE public.loan_repayments SET status = 'cancelled' WHERE status IN ('pending','overdue','partial') AND loan_id IN (SELECT id FROM loan_applications WHERE status IN ('completed','rejected','defaulted'))`. The existing `cancel_repayments_on_loan_closure` trigger already covers `partial` going forward, so no trigger change is needed.

- **`src/pages/admin/houses/HouseLoansPage.tsx`** — in the `overdueByLoan` useMemo (lines ~117-140), build a set of active loan IDs from `loans` (status `active` or `disbursed`) and skip any repayment whose `loan_id` is not in that set. Everything downstream (`overdueCount`, `lateBuckets`, `onTrackCount`, badges, sort) already reads from this map, so this single change fixes all of them.

No changes to the reloan/completion logic itself are required — the trigger is already correct; this addresses the stale data plus a defensive display guard.
