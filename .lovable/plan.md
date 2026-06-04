# Loan House Reports — House + Period Filters

## Goal
Add a filter bar to the Loan House **Reports** page so the user can view **expected vs made profit**:
- for a **specific house** or **All houses** she has access to (with a quick switcher), and
- across a chosen **sub-period** — quick presets (This month, Last month, This quarter, This year, All time) **plus a custom date range**.

The selected house **and** period drive both the **summary cards** and the **monthly chart/breakdown table**, and the CSV export reflects the active filter.

## UX
A compact filter row at the top of the Reports page:

```text
[ House: ▼ All houses / Marketeer / Collateral / … ]   [ This month | Last month | Quarter | Year | All time | Custom ▼ ]
```

- **House selector** — lists every house the user can access plus an **"All houses"** option.
  - Picking a specific house **navigates** to `/admin/houses/<code>/reports` (keeps the header/tabs in sync and deep-linkable).
  - Picking **All houses** keeps the current route but switches the report content to an aggregated view, with a clear "Showing all houses you can access" label.
- **Period control** — preset buttons + a "Custom" popover with a start/end date range calendar (shadcn `Calendar` range mode, `pointer-events-auto`). Default = **This year** (covers May/June etc. she referenced).

## What changes

### 1. `src/utils/houseProfit.ts` — add period support
- Extend `computeMonthlyProfit(loans, repayments, expenses, options)` to accept `{ from?: Date; to?: Date }` instead of a fixed 12-month lookback.
  - Seed one bucket per month between `from` and `to` (for "All time", derive `from` from the earliest due/paid/expense date).
  - Count **expected** interest by **due month**, **made** interest by **paid month**, **expenses** by **expense month** — all clamped to the range.
  - Totals already aggregate from the in-range buckets, so cards stay in sync.
- Keep the existing 12-month default when no range is passed (back-compat for any other caller).
- Add `collected` (sum of paid amounts in range) to the returned totals so the "Total Collected" card can be period-aware.
- Extend the unit tests to cover range filtering and "all time" bounds.

### 2. Data fetching — support one house or many
- `src/hooks/useHouseData.ts`: add **`useAccessibleHouses()`** — returns the `{ productCode, name }[]` the user can open (admin/officer roles → all active houses from `useLoanProductModules`; otherwise filtered by `user_product_access`).
- `src/services/repositories/houseRepository.ts`: add **`fetchHousesReportBundle(productCodes[])`** that fetches loans, repayments, expenses and disbursements for the given codes in parallel and returns combined arrays (single code = that house; multiple = aggregate).
- `src/hooks/useHouseData.ts`: add **`useHousesReportBundle(productCodes[])`** wrapping it (query key includes the sorted codes).

### 3. `src/pages/admin/houses/HouseReportsPage.tsx`
- Add local state for **scope** (`"ALL"` vs current `productCode`) and **period** (`preset` + custom `from`/`to`).
- Resolve the active code list (`[code]` or all accessible codes) and load data via `useHousesReportBundle`.
- Render the **filter bar** (house Select + period presets + custom range popover).
- Compute `computeMonthlyProfit(..., { from, to })` and drive:
  - **Cards**: Interest Made, Expected, Net Profit, Expenses, Total Collected → all period-scoped. Total Disbursed → scoped to disbursements in the period. **Outstanding** and **Overdue** remain a live "as of today" snapshot with a small caption (they're point-in-time by nature).
  - **Chart**: Expected vs Made bars across the period's months, with a heading that names the scope ("All houses" or the house) and the period.
  - **Breakdown table**: one row per month in range, with totals.
- Update **Export + Post** CSV/payload to include the active scope (house or "all"), the period label, and the filtered monthly rows.

## Out of scope
- No DB schema changes. Aggregation respects existing RLS; expense→house attribution stays via `loan_id` as today.

## Technical notes
- Profit math is unchanged: `interestRatio = (total_repayment − loan_amount) / total_repayment`, applied per installment; net profit = interest made − expenses.
- "All houses" reuses the same pure util — it just receives the concatenated loans/repayments/expenses across accessible codes.
- All styling via existing semantic tokens and the current recharts setup; date pickers use the shadcn `Calendar`/`Popover` already in the project.
