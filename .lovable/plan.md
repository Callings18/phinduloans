## Goal

Make collateral-based loans support a flexible term of **1 to 12 months**, where the interest rate the admin enters is the **total** interest over the whole loan, split equally into flat monthly installments. Also repair existing collateral loans that show wrong installment amounts (e.g. Manase's K1,840).

## What's already correct (no change needed)

The calculation engine already does exactly what you described. The collateral product is configured as `per_loan` flat interest, so:

```text
Enter 48% for 12 months  → total interest = 48% of principal, split into 12 equal flat installments (4%/month)
Enter 30% for 3 months   → total interest = 30% of principal, split 10/10/10
Enter 30% for 1 month    → 30% applies that single month
Enter 30% for 6 months   → 30% total, divided across 6 installments
```

The loan-creation form already lets the admin type a custom rate and term, and feeds them into this engine. The problem is purely the **"6 months only" locks** plus **stale saved data** on old loans.

## Changes

### 1. Remove the "fixed at 6 months" locks (allow 1–12)

- **Database trigger** `enforce_house_product_rules()`: change the COLLATERAL rule from "must equal 6 months" to "must be 1–12 months" (term_unit = months).
- **Frontend validation** `src/hooks/useProductLoanRules.ts` (COLLATERAL block): replace the `termValue !== 6` error with a 1–12 month range check.
- **Product config**: raise the collateral product's `max_term_months` from 6 to 12 (min stays 1) via migration, so the form's amount/term guards accept up to 12.

### 2. Keep the form usable

- `HouseLoanCreatePage` keeps a sensible default term (e.g. 6) but the term field stays fully editable from 1–12. No engine change — the entered rate continues to be treated as the total split across the chosen months.

### 3. Repair existing miscalculated collateral loans (data fix)

A migration that, for collateral loans whose stored installment was computed with the old 6-way split:
- Recompute `monthly_payment = total_repayment / loan_term_months`.
- For loans with **no payments yet**, rewrite the amount on each **pending/unpaid** installment so the schedule sums to `total_repayment` (Manase's active loan: single installment becomes K11,043.50 instead of K1,840.58; `total_repayment` of K11,043.50 is already correct).
- Loans with existing payments are handled conservatively — only unpaid installments are adjusted, and any loan where this can't be done cleanly is left untouched and reported.

### 4. Tests

- Extend `loanCalculations.collateral.test.ts` to assert the split across 1, 3, 6, 10, and 12-month terms (e.g. 48%/12 months → 4% interest portion per installment) so the "split across months" rule is locked in.

## Technical details

- DB trigger edit and product `max_term_months` update ship in one migration; the data-repair runs in a second migration after inspecting affected rows.
- No change to `loanCalculations.ts` or `createRepaymentSchedule.ts` logic — they already produce the correct split; the schedule helper reads the corrected `monthly_payment`.
- Verification: re-query Manase's loan + schedule to confirm the single installment equals K11,043.50, and run the collateral test file.
