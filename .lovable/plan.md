# Fix urgent admin-side loan issues

Three confirmed problems across the loan houses, plus a guardrail so high interest rates work. Marketeer stays exactly as-is (30% / 26 days).

## 1. "Current date not recognized" — overdue/today logic

**Cause:** Due dates are stored as `YYYY-MM-DD` and read as UTC midnight, while "today" is the local clock (Zambia is UTC+2). The two don't line up, so:
- **Admin → Repayments**: installments due *today* flip to "overdue" from 02:00 AM on the due date.
- **Admin → Loans**: today's due installments never show as overdue all day.

**Fix:** Compare dates as plain `YYYY-MM-DD` strings (same approach already used correctly on the House pages), so "due today" is never wrongly treated as overdue or missed.
- `src/pages/admin/AdminRepayments.tsx` (the overdue check and overdue-count tally)
- `src/pages/admin/AdminLoans.tsx` (desktop table + mobile cards overdue badge)

## 2. Collateral single-bullet loan — record the remaining / full payment

**Cause:** On the full loan details **Repayments** tab, the per-row **Pay** button only renders for installments with status `pending`. A collateral loan is a single bullet installment; once a partial payment is recorded it becomes `partial`, so the row loses its Pay button and staff see "no way to record" the rest. Future-dated bullet installments also don't surface on the Collections page.

**Fix:**
- In `src/components/admin/LoanDetailsModal.tsx`, show the per-row **Pay** button for `partial` and `overdue` rows too (not just `pending`), pre-filled with the remaining balance. This lets staff record the rest of a bullet payment directly on the row.
- Confirm the existing "Record Payment" quick action + payment RPC correctly close the loan when the bullet is fully paid (it already flags `loan_completed`); surface the "Loan fully paid" confirmation.
- `src/pages/admin/houses/HouseCollectionsPage.tsx`: include the still-owing bullet installment so a collateral loan can be collected there even when its single due date isn't exactly today.

No schema change needed — payments still go through the existing `record_loan_payment` flow.

## 3. Business loan interest — remove any cap, keep math correct

**Decision:** Business loan model stays the same (one-time flat % of principal); just make sure any rate can be entered and is never silently mis-handled. Marketeer stays fixed at 30% / 26 days (no change).

**Fix:**
- Ensure the interest rate input in `src/pages/admin/AdminLoanProducts.tsx` accepts any positive value (no hidden cap).
- In `src/utils/loanCalculations.ts`, teach the rate normalizer to recognise the database's period aliases (`per_month`, `per_year`, `per_week`, `per_day`) instead of falling through to a default, so displayed/derived rates stay accurate for high rates and long terms.

## Verification
- Re-run unit tests for loan calculations (collateral, marketeer, payday soft) to confirm no regression.
- Spot-check: an installment due *today* shows as "due", not "overdue", on Admin → Repayments and Admin → Loans.
- Spot-check: a partially-paid collateral bullet shows a Pay button for the remaining balance and closes the loan when fully paid.

## Technical notes
- Date fixes use string `YYYY-MM-DD` comparison via `format(new Date(), "yyyy-MM-dd")` to match the pattern already proven on House pages.
- Pay-button condition changes from `status === "pending"` to the shared unpaid check (`pending | partial | overdue`) that the quick actions already use.
- Interest normalizer extends the existing `switch` in `normalizeToMonthlyRate`; per-loan flat business logic is unchanged.
