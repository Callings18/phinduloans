

# Plan: Enhance Loan Details Modal — Repayments Tab & Reloan Dialog

## Problems Identified

1. **Repayment table missing columns**: No "Outstanding/Balance" column showing remaining amount per installment. The screenshot shows minimal info.
2. **Reloan dialog is inaccurate**: Shows old text saying "Mark all pending repayments as paid" and displays full loan amount instead of outstanding principal. No eligibility check shown before confirming.
3. **Overview summary cards** don't show Total Paid vs Balance prominently.
4. **No loan financial summary strip** at the top of the Repayments tab.

## Changes

### 1. Add Loan Financial Summary to Repayments Tab (above the table)

Add a compact summary strip showing:
- **Principal**: K3,300 | **Total Due**: K4,455 | **Total Paid**: K0 | **Outstanding Balance**: K4,455 | **Penalties**: K0 | **Interest**: K1,155

This gives instant visibility into the loan's financial state.

**File**: `src/components/admin/LoanDetailsModal.tsx` — Insert summary cards between the "Repayment Schedule" header and the table (around line 1760).

### 2. Add "Outstanding" Column to Repayment Table

Add a column after "Paid" showing per-installment outstanding:
- `Outstanding = (original_amount || amount) - (principal_paid || 0)` for pending/overdue rows
- `K0` for paid rows
- Styled in amber/destructive when > 0

**File**: `src/components/admin/LoanDetailsModal.tsx` — Add `<TableHead>Outstanding</TableHead>` and corresponding `<TableCell>` in the repayment map (lines 1769-1940).

### 3. Enhance Reloan Dialog with Eligibility Summary

Replace the current generic text in the reloan `AlertDialog` (lines 2564-2594) with a detailed financial breakdown:

```
Loan Summary:
  Principal:           K3,300
  Total Paid:          K0
  Outstanding Principal: K3,300
  Outstanding Penalties:  K0
  Outstanding Interest:   K0

Eligibility:
  ✅ No outstanding penalties — eligible
  ✅ No outstanding interest — eligible
  ✅ Outstanding principal K3,300 — will carry forward

New Reloan Terms:
  Amount: K3,300 (outstanding only)
  Term: 1 month @ 35%
  No new disbursement
```

If penalties or interest are outstanding, show red ❌ blockers explaining what must be cleared first. The "Confirm Reloan" button is disabled when blocked.

**File**: `src/components/admin/LoanDetailsModal.tsx` — Rewrite the reloan `AlertDialog` content (lines 2564-2594) to compute and display these values using the same `totalPaid`, `totalPenalties`, and `outstandingPrincipal` variables already available.

### 4. Fix Reloan Dialog Text

Current text incorrectly says:
- "Mark all pending repayments as paid (interest settlement)" — WRONG, we removed this
- "Create a new loan with the same terms (K full amount)" — WRONG, should show outstanding principal only

Replace with accurate description matching the actual reloan logic.

## Files Modified

- `src/components/admin/LoanDetailsModal.tsx` — All changes in this single file

## Implementation Order

1. Add financial summary strip to Repayments tab
2. Add Outstanding column to repayment table
3. Rewrite reloan dialog with eligibility check and accurate figures
4. Verify computed values match existing variables

