

# Fix: Awaiting Disbursement Loans — Remove Premature Schedules & Add Disburse Button in Detail View

## Problem

1. **One loan** (Sibeso Namataa) has a repayment schedule prematurely generated while still in `awaiting_disbursement` status — it shouldn't have one yet.
2. When you open a loan's detail view (LoanDetailsModal), there is **no "Disburse" button** for `awaiting_disbursement` loans — the Quick Actions section only shows actions for `active`/`disbursed` loans.
3. The modal's status display and summary cards don't clearly communicate the "awaiting disbursement" state or guide the admin toward disbursing.

## Fix Plan

### 1. Clean up premature repayment schedule (data fix)
Delete the repayment records for the one `awaiting_disbursement` loan that already has a schedule (Sibeso Namataa, loan `b8902b01-...`). Use the insert tool to run a DELETE.

### 2. Add "Disburse Funds" button in LoanDetailsModal
In `src/components/admin/LoanDetailsModal.tsx`, add a prominent "Disburse Funds" button in the Quick Actions card when the loan status is `awaiting_disbursement` or `approved`. This button will open the same disbursement dialog from AdminLoans — but since LoanDetailsModal doesn't have that dialog, we'll add a dedicated disbursement section inside the modal with:
- Source account selector
- Disbursement method selector
- Transaction reference field
- Net disbursement calculation (showing fee deductions)
- Confirm button that performs the same logic as `AdminLoans.tsx` disbursement

### 3. Show "Awaiting Disbursement" banner in loan detail view
Add a visible alert/banner at the top of the Overview tab when status is `awaiting_disbursement`, telling the admin "This loan is approved and waiting for disbursement. Click Disburse to proceed."

### 4. Hide repayment-related UI for pre-disbursement loans
In LoanDetailsModal, conditionally hide the repayment progress bar, "Record Payment", "Apply Penalties", "Early Settlement", "Restructure", "Reloan", "Top Up" buttons when the loan is in `awaiting_disbursement` status — these actions only make sense after disbursement.

## Files Changed

- `src/components/admin/LoanDetailsModal.tsx` — Add disburse button + dialog, add banner, hide post-disbursement actions
- Database: DELETE premature repayment records for the one affected loan

## Technical Details
- The disbursement logic mirrors `AdminLoans.tsx` `disburseLoanMutation`: balance check → deduct from account → create transaction record → create disbursement record → update loan status to `disbursed` (trigger auto-generates schedule and transitions to `active`)
- Need to fetch `accounts` and `loan_products` inside the modal (or reuse existing queries)
- The `ALLOWED_NEXT_STATUSES` map already has `awaiting_disbursement: []` which is correct — disbursement is a separate action, not a status "move"

