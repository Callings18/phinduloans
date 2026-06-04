# Advance Loan House Reporting — Monthly Profit View

## Goal (from client's WhatsApp feedback)
On the Loan House **Reports** page she wants:
1. The monthly graph to show **how much interest/profit was made each month** (May, June, etc.) — not just the raw "Collected" amount.
2. A side-by-side view of **profit expected vs profit made** per month.
3. The broken **"Interest Made" card (currently K0)** fixed to show real interest, plus a **Net Profit** figure (interest earned minus expenses, per her choice "net of expenses").

This is a reporting/presentation enhancement. No database schema changes are needed — all numbers are derived on the frontend by combining the house's loans, repayments, and expenses that are already loaded.

## How the numbers are calculated

For each loan in the house we know `loan_amount`, `total_repayment`, and term. The interest baked into a loan is `total_repayment − loan_amount`. Each installment carries a proportional slice of that interest:

```text
interestRatio(loan)   = (total_repayment − loan_amount) / total_repayment
expected interest     = installment.amount      × interestRatio   (counted in DUE month)
interest made         = amount actually paid     × interestRatio   (counted in PAID month)
```

- **Expected line** = sum of expected interest for installments **due** in each month.
- **Made line** = sum of interest from amounts **actually paid** in each month (handles partials correctly).
- **Expenses** = expenses linked to this house's loans (via `loan_id`), summed by `expense_date` month. (Expense data is currently sparse and not all expenses link to a house, so where none exist the deduction is simply K0 and gross = net.)
- **Net profit (made)** = interest made − expenses for that month.

Showing both lines is exactly what she asked for ("profit expected or made in May, June").

## What changes

### 1. New pure utility `src/utils/houseProfit.ts`
- `computeMonthlyProfit(loans, repayments, expenses, monthsBack)` → returns an array of `{ monthKey, label, expectedInterest, interestMade, expenses, netProfit }` for the last N months (default 12).
- Also returns totals: total expected interest, total interest made, total expenses, total net profit.
- Fully unit-testable; covered with a small test file `src/utils/__tests__/houseProfit.test.ts`.

### 2. `src/pages/admin/houses/HouseReportsPage.tsx` (main work)
- Replace the single-series **"Monthly Collections"** bar chart with a **grouped bar chart: "Interest Expected" vs "Interest Made" per month**, titled **"Monthly Profit (Interest)"**. The tooltip for each month shows: Expected interest, Interest made, Expenses, and **Net profit** — so clicking/hovering a month answers "how much interest/profit was made in May/June".
- Fix the **"Interest Made"** summary card to use the interest-ratio calc (no longer K0).
- Add a **"Net Profit"** summary card (interest made − expenses).
- Add a **"Monthly Profit Breakdown"** table under the chart: one row per month with columns *Month · Expected · Made · Expenses · Net Profit*, with totals — this is the "summary of profit made in May, June etc." she described.
- Keep existing Total Disbursed / Total Collected / Outstanding / Overdue cards and the Loan Status Breakdown.

### 3. Export ("Export + Post")
- Add the monthly profit breakdown (expected, made, expenses, net) to the CSV so the posted report carries the same numbers shown on screen.

## Out of scope
- No DB migrations, no changes to how repayments/expenses are recorded.
- Expense-to-house attribution stays as-is (via `loan_id`); a future step could add a dedicated house/branch tag on expenses if she wants overhead costs included.

## Technical notes
- All styling uses existing semantic tokens (`hsl(var(--primary))`, `--border`, etc.) and the recharts setup already on the page; the second series uses a muted/secondary token so the two bars are clearly distinguishable.
- Calculations live in the pure util so the page stays presentation-only and the logic is tested.
