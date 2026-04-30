## Three changes

### 1. Drop the imported Marketeer loans (clean slate)

Delete the 73 bulk-imported MARKETEER loans plus their dependent rows so staff can re-enter the next cycle from scratch. Scope is restricted to records created by `bulk-import-marketeer-loans` (identified by the `999XXX/26/9` NRC pattern, `+26097000XXX` phone, and `mkt.import.*@offline.phindu.zm` email — all stable sentinels from the importer).

Order of deletion (to respect FKs and triggers):
1. `account_transactions` where `reference_type IN ('repayment','disbursement')` and `reference_id` belongs to imported loans
2. `loan_repayments` for those loans
3. `disbursements` for those loans (this is the "disbursement history" the user wants gone)
4. `loan_events` / `loan_borrowers` / any other child rows
5. `loan_applications` themselves
6. `profiles` and `auth.users` for the sentinel borrowers
7. Reverse the one-time Zanaco pre-funding ledger entry (so account balance returns to its pre-import state)

Also reset the importer's idempotency keys so the same dataset cannot accidentally re-create them; staff will key in the next cycle's loans manually through the normal Marketeer flow.

A pre-flight `SELECT` will print the exact counts that will be removed; the migration runs only after those counts match expectations.

### 2. Marketeer first installment = day AFTER disbursement (or explicit start date)

Today's behavior: installment #1 is due on the disbursement date itself. Change so that for **MARKETEER product only**:

- If the loan officer enters a `repayment_start_date`, installment #1 is due on that date (current behavior preserved).
- If no `repayment_start_date` is entered, installment #1 defaults to **disbursement_date + 1 day**, then Sundays are skipped.

Files touched:
- `src/utils/createRepaymentSchedule.ts` — when `product_code = 'MARKETEER'` and no explicit start date, seed the cursor at `disbursement_date + 1`.
- The Marketeer create-loan form (`HouseLoanCreatePage` for MARKETEER) — default the visible "First Payment Date" picker to `disbursement_date + 1` (skipping Sunday) so officers see what will be used.
- DB-side `generate_repayment_schedule` trigger function — same +1 rule for MARKETEER so any path (UI, RPC, future imports) is consistent.

No change to other products. No change to interest, total, or daily installment math.

### 3. Allow advance / over-payments that auto-apply to future installments

Currently `record_loan_payment` rejects any amount greater than the single installment's outstanding balance. New behavior:

- Accept an amount up to the **loan's total remaining balance**.
- Apply it greedily: fill the targeted installment first, then cascade the leftover into the next pending installment, then the next, until the money is used up or the loan is fully paid.
- Each installment that is fully covered is marked `paid` with that day's `paid_date`; a partially covered tail installment is marked `partial` with its `principal_paid` advanced.
- One ledger entry is posted for the full incoming amount (against the chosen account), but one `loan_repayments_history` / receipt row is recorded per installment touched, so the audit trail stays granular.
- Existing safety rails kept: cannot pay more than total loan outstanding; cannot pay a cancelled loan; future-dated `paid_date` still blocked; permission checks unchanged.
- Loan auto-closes (`status = 'paid'`) the moment the cascade settles the last installment — uses the existing `cancel_repayments_on_loan_closure` / completion path.

Implementation: replace the current "exceeds outstanding" hard-reject in `record_loan_payment` with a loop that walks pending installments in `installment_number` order. The change is internal to that one RPC; UI keeps calling it the same way. The Repayments table will simply show multiple installments transitioning to `paid` from a single payment entry.

Applies to all products (the user's example was Marketeer but the request — "even pay 5 days ahead" — is universal and doesn't break monthly products).

### Technical notes

- All three pieces ship as one migration + one edge-function/RPC update + small frontend tweaks.
- After the deletion migration runs, I'll run a verification `SELECT` showing 0 imported loans / 0 sentinel profiles / disbursements removed and Zanaco balance reverted.
- Tests to add: `record_loan_payment` overpay-cascade unit test; Marketeer schedule "+1 day, skip Sunday" test.
- No impact on Salary Advance, Payday, Collateral, Business, Motor Vehicle, or Staff Salary Advance schedules.

### Confirm before I run

The deletion is destructive and irreversible. Please confirm:
1. Delete **all 73** imported Marketeer loans + their disbursements + repayment history + sentinel borrower accounts? (Yes / No)
2. Reverse the Zanaco pre-funding top-up that the importer posted? (Yes / No)
3. Apply the +1-day first-installment rule to **Marketeer only**, leaving all other products unchanged? (Yes / No)
4. Allow advance payments to cascade across future installments for **all products**, or Marketeer only?
