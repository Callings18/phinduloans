# Fix Marketeer partial payments + product-aware contracts

Two unrelated bugs reported in one message. Both are frontend-only fixes — the database RPC and product config are already correct.

## 1. Marketeer "less than daily" payments appear not to record

**Root cause (UI, not DB):** the `record_loan_payment` RPC already supports partial payments — it sets the installment to `status = 'partial'`, stores `principal_paid`, and never marks the loan complete. But `MarketeerDailyCollectionTracker.tsx` only counts rows where `status === 'paid'` when computing `totalPaid` and the outstanding balance:

```ts
const paid = loanRepayments.filter((r) => r.status === "paid");
const totalPaid = paid.reduce((s, r) => s + Number(r.principal_paid || r.amount), 0);
```

So when a collector enters K20 against a K50 daily, the row goes to `partial` with `principal_paid = 20`, but Outstanding, Total Collected and "Paid / Total" all stay unchanged → looks like nothing happened. The "Today" badge also keeps showing the full K50 instead of the K30 still owed.

**Fix in `src/components/admin/marketeer/MarketeerDailyCollectionTracker.tsx`:**
- Compute `totalPaid` from `principal_paid` across **all** repayments (paid + partial), not only `paid`.
- Compute today's remaining as `amount - principal_paid` and display "K{remaining} due (K{paid} paid)" when partially paid.
- Treat a row as "Today" if `due_date === todayStr` and status is not `paid`/`cancelled` (already true — keep partial visible).
- For overdue rows that are `partial`, use the remaining (`amount - principal_paid`) for the bulk-pay total and per-row Pay button default.
- Pre-fill the per-row input placeholder with the remaining amount instead of the full daily.

No backend changes — the RPC already accepts partial amounts and chains overpayments to later installments.

## 2. Marketeer / Payday Soft contracts read like monthly loans

**Root cause:** `src/utils/generateLoanContract.ts` (the fallback when no product-specific template exists) hardcodes monthly language regardless of product:

- "Interest Rate: X% **per month**" (line 492)
- "Loan Term: X **months**" (line 493)
- "**Monthly Payment**: K…" (lines 494, 876, 908, 934, plus `{{monthly_payment}}` placeholder)
- "Repay … in X equal **monthly installments** on {first-payment + 1 month}" (lines 506-509)

For Marketeer (26 daily collections, Mon–Sat) and Payday Soft (single bullet at 30 days) this is wrong.

**Fix in `src/utils/generateLoanContract.ts`:**
- Accept the loan product's `product_code`, `repayment_frequency` and `term_unit` (already on `loan_products`); pass them through from the callers that have the product loaded, and look them up by `loan_product_id` when missing.
- Derive a `cadence` once: `daily` (Marketeer / any product with `repayment_frequency = 'daily'`), `bullet` (Payday Soft / `repayment_frequency = 'bullet'`), else `monthly`.
- Render LOAN DETAILS, REPAYMENT, the SMS notice, and the WhatsApp/email summary using cadence-appropriate wording:
  - daily → "X% flat for the cycle", "Loan Term: N days", "Daily Installment: K…", "repay in N equal daily installments (Mon–Sat) starting {disbursement+1 working day}"
  - bullet → "X% for the period", "Loan Term: 30 days", "Single Bullet Payment: K{total_repayment}", "repay the full amount on {due date}"
  - monthly → keep current wording
- Keep the `{{monthly_payment}}` placeholder working for back-compat, but also expose `{{installment_amount}}`, `{{installment_label}}` (e.g. "Daily Installment"), `{{term_label}}` (e.g. "26 days"), and `{{repayment_schedule_summary}}` so admin templates can be made cadence-neutral.
- The Marketeer `dailyInstallment` already lives on the application (`monthly_payment` column is reused for the daily figure, plus `product_specific_data.dailyRepayment`). Use the larger / non-zero value, fall back to `total_repayment / loan_term_months` only for true monthly.

## Technical notes

- Files touched:
  - `src/components/admin/marketeer/MarketeerDailyCollectionTracker.tsx` — partial-aware aggregation + UI labels.
  - `src/utils/generateLoanContract.ts` — cadence-aware rendering + new placeholders, plus the SMS/WhatsApp/email helpers further down the file.
  - Callers of `generateLoanContract` only need a tiny tweak if they don't already pass `loan_product_id` (they do — already on `LoanData`).
- No SQL migration. RPC `record_loan_payment` and product configs (`MARKETEER`, `PAYDAY_SOFT`) are already correct from previous turns.
- No change to receipt printing, schedule generation, or accounting — only the contract PDF/text and the Marketeer collection screen.

## Out of scope

- Re-issuing PDFs for already-printed contracts. Newly generated contracts will use the corrected wording; existing PDFs are not retroactively rewritten.
- Changing how "loan completed" is decided (already correct: only when full principal across all installments is reconciled).
