

## Bring loan houses to full LMS parity + accounts reporting

Goal: every house behaves like the legacy admin loan flow (reloan, top-up, restructure, penalties, early settlement, schedule PDF), every disbursement and collection is tied to a funding account, and the Accounts module shows a true P&L with expenses and other income.

### 1. Funding account is mandatory on every money movement

**House Disbursements page** (`HouseDisbursementsPage.tsx`)
- Add an inline **"Funding account"** Select on every pending row (defaulting to the disbursement's `source_account_id` if one was set at loan creation).
- "Disburse now" button is disabled until an account is picked.
- Submit calls `complete_disbursement` RPC with `p_account_id` so the account is debited atomically and `account_transactions` gets a `disbursement` ledger row.

**House Loan Detail page** (`HouseLoanDetailPage.tsx`)
- Already enforces a funding account on disburse — keep.
- Repayment "Pay" button: hard-disable until a "Credit to" account is selected (currently just warns). Show an inline error if user tries.

**House Collections page** (`HouseCollectionsPage.tsx`)
- Same enforcement: "Pay" disabled and account selector highlighted in red until chosen.

**Marketeer collections** (`MarketeerDailyCollectionTracker.tsx`) — same enforcement pattern.

### 2. Restore the full legacy loan-actions toolbar inside each house

`HouseLoanDetailPage.tsx` will gain the same actions the original `LoanDetailsModal` exposes, all routed through existing RPCs:

| Action | Backend used | When shown |
|---|---|---|
| Apply penalties | `apply_loan_penalties(p_loan_id)` | active / disbursed with overdue installments |
| Early settlement quote + record | `calculate_early_settlement` then `record_loan_payment` per remaining row, debiting selected account | active |
| Restructure (term, interest, frequency) | update `loan_applications` then regenerate via `createRepaymentScheduleForLoan` | active / disbursed |
| Top-up (increase principal) | new disbursement against funding account using `complete_disbursement`, schedule regen | active |
| Re-loan (new loan from completed) | duplicate `loan_applications` row, link `parent_loan_id`, route to disburse flow | completed |
| Reverse last payment | flip latest paid `loan_repayments` back to `pending`, debit account back | admin-only |
| Mark defaulted | `admin_mark_loan_defaulted(p_loan_id, p_reason)` | active / disbursed |
| Download PDF schedule | `downloadLoanSchedule` (already added) | any with installments |
| Loan history / events | read `loan_events` + `loan_status_transitions` | always |
| Send borrower message | reuse staff messaging path | always |

Each money-moving action requires an account selection in its dialog (top-up funding account, reversal target account, early settlement crediting account).

### 3. Accounts module = single source of financial truth

`AdminAccounts.tsx` and a new `AccountsReportTab`:

- Existing tabs (Accounts, Transaction History) stay.
- New **"Profit & Loss"** tab built purely from `account_transactions` + `expenses`:
  ```text
  Income
    Repayments (interest + principal split via loan_repayments.principal_paid)
    Other income (account_transactions.transaction_type = 'other_income')
  Expenses
    Operating expenses (expenses table, status = paid)
    Loan write-offs (loan_writeoffs.status = approved)
  = Net Profit (period)
  ```
  Filters: date range + account.
- New **"Other Income"** quick-action button: opens dialog → pick account → enter amount, source, note → inserts an `account_transactions` row of type `other_income` and credits the account balance (mirrors the existing "Add funds" path but tagged so P&L treats it as income, not capital injection).
- Expenses (`AdminExpenses.tsx`) already debits accounts when marked paid via `admin_set_expense_status` — confirm and surface them in the new P&L report.

### 4. Cross-house consistency

- All four houses (`SALARY_ADVANCE`, `COLLATERAL`, `BUSINESS`, `MOTOR_VEHICLE`, `MARKETEER`, `PAYDAY_SOFT`, `SALARY_ADVANCE_STAFF`) use the same `HouseLoanDetailPage` shell — adding actions there propagates to every house automatically.
- House Reports page gains the same P&L block scoped to the house's loans (income from that house's repayments minus allocated expenses if `expenses.module = product_code`).

### Technical details

- New file: `src/components/admin/houses/HouseLoanActions.tsx` — collapsible toolbar of the actions above, reused from `HouseLoanDetailPage`.
- New file: `src/components/admin/AccountsPnLReport.tsx` — date-range driven P&L using `account_transactions`, `expenses`, `loan_repayments`, `loan_writeoffs`.
- New file: `src/components/admin/AddOtherIncomeDialog.tsx`.
- Repository additions in `houseWorkflowRepository.ts`: `houseApplyPenalties`, `houseRestructureLoan`, `houseTopUpLoan`, `houseReloanFromCompleted`, `houseReversePayment`, `houseEarlySettlement`.
- DB: no schema change needed — all RPCs already exist (`apply_loan_penalties`, `calculate_early_settlement`, `complete_disbursement`, `record_loan_payment`, `admin_mark_loan_defaulted`). One small migration to add a CHECK-tolerant `'other_income'` value to `account_transactions.transaction_type` if it's currently constrained, plus an index on `account_transactions(created_at, account_id)` for the P&L query.
- Account selectors everywhere read from the same `accounts-active` query already cached, so balances refresh in real time after each transaction.

### Out of scope (ask before doing)

- Auto-allocating expenses to a specific loan house unless `expenses.module` already carries the product code.
- Multi-currency P&L.

