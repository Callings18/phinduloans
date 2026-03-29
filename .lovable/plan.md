

# Plan: Fix Repayment Gaps, Reloan Logic & Set Up Native Mobile App

## Summary

Three workstreams: (A) fix all repayment recording/display bugs across every admin payment entry point, (B) tighten reloan rules to keep installments unchanged, (C) set up Capacitor for true native iOS/Android borrower app.

---

## A. Repayment Engine Fixes (All Payment Entry Points)

### Identified Bugs

1. **LoanDetailsModal `recordPaymentMutation`** (line 449): Sets `principal_paid: principalPaid` where `principalPaid = remainingAfterPenalty` -- this overwrites any previous partial `principal_paid` instead of incrementing it. Should be `(Number(selectedRepayment.principal_paid) || 0) + principalPaid`.

2. **LoanDetailsModal partial overpayment cascade** (lines 422-429): When overpayment cascades to next installments with a partial amount, it does NOT set `principal_paid` on that installment -- only `amount` is reduced. The partial cascade installment is missing `principal_paid` tracking.

3. **AdminRepayments receipt** (line 383): `repaymentAmount: Number(repayment.amount)` -- after a partial payment, `amount` has been reduced to the remainder. Should use `repayment.principal_paid || repayment.amount` for paid installments to show what was actually paid.

4. **AdminRepayments totalPaid for SMS** (line 307): Uses `r.amount` for paid records instead of `r.principal_paid || r.amount`, leading to inaccurate remaining balance in confirmation SMS.

5. **AdminBulkRepayments** (line 225): On full payment, sets `principal_paid: allocation.allocatedAmount` but does NOT restore `original_amount` or `amount` to the original value. Also does NOT set `paid_date` consistently for partial payments.

6. **LoanDetailsModal `totalPaid`** (line 1278): Uses `r.principal_paid || r.amount` which is correct for paid rows, but for installments paid via `reloan_settlement` or `early_settlement`, `principal_paid` may be 0/null, causing undercount.

7. **AdminRepayments `handleDownloadReceipt`** (line 362): Queries `select('amount, status')` -- missing `principal_paid` and `original_amount` fields needed for accurate totalPaid calculation.

### Fixes

**File: `src/components/admin/LoanDetailsModal.tsx`**
- Line 449: Change `principal_paid: principalPaid` to `principal_paid: (Number(selectedRepayment.principal_paid) || 0) + principalPaid` for the main installment update.
- Lines 422-429: Add `principal_paid: (Number(np.principal_paid) || 0) + applied` to the partial cascade update.
- Line 1278: For `totalPaid`, fall back to `r.original_amount || r.amount` when `principal_paid` is 0/null on paid rows (handles settlement and reloan payment methods).

**File: `src/pages/admin/AdminRepayments.tsx`**
- Line 307: Change `sum + Number(r.amount)` to `sum + Number(r.principal_paid || r.amount)` in SMS balance calculation.
- Line 362: Add `principal_paid, original_amount` to the receipt query's select.
- Line 373: Use `principal_paid || amount` for paid rows in `totalPaid` calculation.
- Line 383: Use `Number(repayment.principal_paid || repayment.amount)` for `repaymentAmount` in receipt.

**File: `src/pages/admin/AdminBulkRepayments.tsx`**
- Lines 218-227: Add `original_amount: allocation.originalAmount` and `amount: allocation.originalAmount` (restore original) on full payment.
- Lines 242-250: Ensure `transaction_reference` is set on partial payments too.

**File: `src/pages/admin/AdminLoans.tsx`**
- Already handles cascading correctly. No changes needed.

---

## B. Reloan Logic Fix

### Current Problem
- Line 734-743: Reloan mutation marks ALL pending repayments as `paid` with `payment_method: "reloan_settlement"`. This contradicts the client rule: **keep installments unchanged** and only reloan outstanding principal.
- The reloan blocks correctly on penalties/interest -- that logic is fine.

### Fix
**File: `src/components/admin/LoanDetailsModal.tsx`**
- **Remove lines 734-743** (the bulk update that marks pending repayments as paid).
- Instead, **cancel** pending/overdue repayments on the old loan: update status to `cancelled` (not `paid`), so they don't inflate "paid" totals.
- The old loan still gets marked `completed` (line 727-731) -- change this to status `cancelled` or keep as `completed` with a note. Since the DB trigger `cancel_repayments_on_loan_closure` already cancels pending repayments when status goes to `completed`, we can simply remove the manual bulk update and let the trigger handle it.
- **Verify**: The `cancel_repayments_on_loan_closure` trigger fires on `completed` status and sets pending/overdue to `cancelled` -- this is the correct behavior for reloans.

### Result
- Remove lines 734-743 entirely. The DB trigger handles cancellation automatically when status changes to `completed`.
- Old loan installments stay as-is (paid ones remain paid, pending ones get cancelled by trigger).
- New reloan gets fresh schedule with only the outstanding principal.

---

## C. Native Mobile App (Capacitor)

### Setup Steps
1. Install Capacitor dependencies: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`.
2. Initialize with `npx cap init` using:
   - appID: `app.lovable.3b99a541bce94eef8bae953aa680f471`
   - appName: `loan-kindly-flow`
3. Configure `capacitor.config.ts` with server URL pointing to sandbox for hot-reload during development.
4. Provide instructions for the client to:
   - Export to GitHub, clone locally
   - `npm install` then `npx cap add ios` / `npx cap add android`
   - `npm run build` then `npx cap sync`
   - `npx cap run ios` (requires Mac + Xcode) / `npx cap run android` (requires Android Studio)

### Files
- `package.json`: Add Capacitor dependencies
- `capacitor.config.ts`: New config file

---

## Implementation Order

1. Fix repayment `principal_paid` accumulation bug in LoanDetailsModal (highest impact -- this is why payments aren't showing correctly)
2. Fix receipt and totalPaid calculations in AdminRepayments
3. Fix BulkRepayments missing fields
4. Fix reloan: remove manual bulk-paid update, rely on DB trigger
5. Set up Capacitor for native mobile

---

## Technical Notes

- The core bug is that `principal_paid` gets overwritten instead of incremented on subsequent payments to the same installment. This causes "K0 paid" to show after partial payments.
- The `cancel_repayments_on_loan_closure` DB trigger already handles the exact behavior needed for reloans -- the manual `UPDATE...SET status='paid'` was redundant and incorrect.
- Capacitor setup is additive -- no existing code changes required, only new config files and dependencies.

