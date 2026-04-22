

## Cleanup pass: overdue visibility + de-duplicate payment receipt logic

Skipping the inline Pay button replacement on `HouseLoanDetailPage` (per your instruction — the "Credit to" selector flow is intentional). Focusing on the remaining issues from the review.

### 1. Show overdue clearly on the loan detail schedule

In `HouseLoanDetailPage.tsx`, the repayments table currently shows generic status badges with no indication of how late an installment is. Add:

- **Per-row overdue badge**: when `r.due_date < todayStr && status !== paid/cancelled`, render a red "Overdue" badge instead of "pending", plus a "X days late" hint next to the due date.
- **Top summary line** above the schedule: `N overdue · K{amount} · oldest M days late` so staff see the situation at a glance without scanning every row.
- **Light polish on the inline Pay row** (since we're keeping it): when an installment is overdue, highlight the row background subtly (`bg-destructive/5`) so the eye lands on it first.

### 2. De-duplicate receipt-download logic

Three near-identical copies of "generate receipt → download PDF → toast" exist in:
- `HouseLoanDetailPage.tsx`
- `HouseCollectionsPage.tsx`
- `LoanDetailsModal.tsx`

Extract into one shared helper `src/utils/handlePaymentReceipt.ts` that takes the receipt payload + system settings and handles PDF generation, filename, and download. All three call sites switch to it. No behavior change — just less code to drift.

### 3. Confirm Salary Advance "who is due" parity

The shared `HouseLoansPage` already renders the Overdue column and filter pill, so Salary Advance inherits it automatically. I'll verify the route wiring renders the same component (no Salary-Advance-specific override) and, if the Collections page for that house is missing the top overdue summary card that Loans has, add a matching one for consistency.

### 4. Small dead-code sweep inside the touched files

Only inside files we're already editing — no broad page deletions:
- Remove unused imports left over from prior refactors in `HouseLoanDetailPage.tsx`.
- Remove the duplicated inline receipt-generation block once the shared helper is wired in.

### Files touched

- `src/utils/handlePaymentReceipt.ts` — new shared helper
- `src/pages/admin/houses/HouseLoanDetailPage.tsx` — overdue badges + summary, row highlight, switch to shared receipt helper, drop unused imports
- `src/pages/admin/houses/HouseCollectionsPage.tsx` — switch to shared receipt helper; add top overdue summary card if missing
- `src/components/admin/LoanDetailsModal.tsx` — switch its receipt download to shared helper (no UX change)

### Out of scope

- No changes to the inline Pay button / "Credit to" selector flow on the detail page (per your instruction).
- No DB/RPC changes — `record_loan_payment` already supports everything.
- No route or page deletions.

