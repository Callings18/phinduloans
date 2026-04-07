

# Fix: Loan Status Flow — Pending → Approved → Disbursed → Active

## Problem

When loans are approved (pending → approved), they remain in the Applications module with "approved" status. They don't appear in the Loans module because that module only queries for `active`, `disbursed`, `completed`, `defaulted` statuses. The loans haven't "disappeared" — they're waiting for disbursement in the Applications module.

## Your Desired Flow

```text
Pending → Approved → Disbursed → Active → Completed
         (approve)   (disburse)  (auto)    (all paid)
```

- **Pending**: New application submitted
- **Approved**: Admin approves the loan (ready for disbursement)
- **Disbursed**: Money has been sent to borrower
- **Active**: Loan is being repaid (set automatically after disbursement)
- **Completed**: All repayments cleared

## Changes

### 1. Add "Approved" loans to the Loans module
Update `AdminLoans.tsx` to include `approved` status in its query and add a new "Approved" tab so approved loans waiting for disbursement are visible in the Loans module alongside active ones.

### 2. Add disbursement action in Loans module
Add a "Disburse" button on approved loans in the Loans module so admins can disburse directly from there (instead of having to go back to Applications).

### 3. Update the database trigger
Update `enforce_loan_application_status_transition` to support:
- `approved` → `disbursed` (direct disbursement)
- `disbursed` → `active` (automatic on disbursement)

### 4. Update borrower dashboard
Update `BorrowerLoansTab.tsx` to include `approved` in the pending/in-progress category so borrowers can see their approved loan waiting for disbursement.

### 5. Update status labels and configs
Add `approved` status styling to the Loans module `statusConfig` and ensure consistent labeling across both modules.

## What Won't Change
- The Applications module continues to show all statuses (unchanged)
- The approval RPC (`transition_loan_status`) stays the same
- No database schema changes needed (the `approved` enum value already exists)

## Technical Details
- `AdminLoans.tsx` query: add `approved` to the `.in("status", [...])` filter
- Add a 4th tab "Approved" before "Active" in the Loans module tabs
- Add disburse action button for approved loans in the Loans table
- The trigger already allows `approved → disbursed` transition

