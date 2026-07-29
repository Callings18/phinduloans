## Repair plan

### 1. Correct Marketeer report interest totals
- Update the house profit calculation so **Expected Interest** is based on each loan’s booked interest (`total_repayment - loan_amount`) instead of only the installments due inside the selected month.
- This makes the Marketeer report show the expected K2,850 for K9,500 disbursed at 30%, instead of the prorated K438 figure.
- Keep **Interest Made** based on actual payments received, so collected/profit still reflects real cash movement.

### 2. Keep report drill-down useful
- Add loan-level expected-interest rows to the monthly drill-down so staff can see which loans make up the expected interest total.
- Keep repayment-level “made” rows for payments received.

### 3. Change loan list date column from Created to Due Date
- In the house loan list, replace the visible **Created** column with **Due Date**.
- Show the earliest open repayment due date for each running loan.
- Keep date filtering/export aligned so staff can filter by due date when reviewing upcoming/late loans.

### 4. Stop fresh collateral reloans from becoming overdue immediately
- Fix backend repayment schedule generation so monthly/bullet loans are due **after** the disbursement/start date, not on the same day.
- This addresses Mwango Cynthia Ngosa’s latest collateral reloan: it was created/disbursed on 2026-07-28 and immediately received a 2026-07-28 due date, which made it appear overdue and eligible for overdue/default messaging.

### 5. Patch the currently affected Cynthia reloan data
- Move the current open due date for loan `63158762-ea71-4517-bff2-f2839667c01b` from 2026-07-28 to the proper next monthly due date.
- This is a data correction for the already-created loan; the function fix prevents repeats.

### 6. Validate with live data
- Recheck Marketeer totals: principal K9,500 should produce expected interest K2,850.
- Recheck Cynthia’s active collateral loan so its open due date is no longer same-day/overdue.
- Run the relevant house profit tests after code changes.

## Technical changes
- `apps/staff-web/src/utils/houseProfit.ts`
- `apps/staff-web/src/utils/__tests__/houseProfit.test.ts`
- `apps/staff-web/src/pages/admin/houses/HouseLoansPage.tsx`
- Database function: `public.generate_loan_schedule_for`
- Data correction: one repayment row for Cynthia’s current active collateral reloan