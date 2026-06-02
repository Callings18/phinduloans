## Goal

Fix four related problems reported on the lending platform:
1. "Add Borrower" to a Marketeer house fails with an Edge Function non-2xx error.
2. Reloan / Restructure / Top-Up disappear on loans that are marked Defaulted (client paid in full + excess and needs a reloan).
3. The Loan Schedule and Account Statement PDFs use bright pink instead of the brand magenta/burgundy, and lack a reliable Outstanding Balance.
4. Collateral loans (which are 30-day single-payment loans) are wrongly shown with a monthly installment (e.g. K1,840), caused by a hardcoded 6-month split.

## Root Causes Found

- **Write failures (reloan/restructure/record payment + likely borrower link):** `audit_logs` has row-level security enabled but **no INSERT policy**. The audit triggers (`log_loan_changes` on `loan_applications`, `log_repayment_activity` on `loan_repayments`) try to insert an audit row and are denied, which rolls back the entire loan/repayment write. This silently breaks reloan, restructure, top-up and payment recording.
- **Collateral miscalculation:** `src/utils/loanCalculations.ts` has a hardcoded branch forcing collateral to `fixedTermMonths = 6`, so total repayment is divided by 6 → wrong "monthly" figure. Collateral is meant to be a single 30-day payment at 30% flat.
- **Reloan hidden on defaulted:** In `LoanDetailsModal.tsx`, Reloan/Restructure/Top-Up are only shown for active/disbursed/completed status, so Defaulted loans show nothing.
- **PDF colors:** `generateStatement.ts` still uses hot pink `RGB(255,51,153)`; `generateLoanSchedule.ts` is mostly themed but should share the same brand palette and always show outstanding balance.

## Plan

### 1. Database: allow audit log inserts (migration)
Add an INSERT policy on `public.audit_logs` so the SECURITY DEFINER audit triggers can write. Allow inserts when there is an authenticated user (the trigger records `auth.uid()`), and keep the existing admin/auditor read policy. This unblocks reloan, restructure, top-up, and payment recording.

### 2. Fix the Marketeer "Add Borrower" error
Reproduce by calling the `create-borrower` function with a Marketeer-style payload (phone only, synthetic email) to capture the exact failure, then fix the specific cause. Likely candidates: the synthetic `@phone.phindu.local` email being rejected, or the phone-duplicate resolution path. Harden the function to:
- Return the precise upstream auth error message (not a generic 4xx).
- Use a valid synthetic email domain and tolerate auth phone validation.
- Confirm the existing duplicate-resolution path returns 200.

### 3. Collateral calculation = single 30-day payment
In `src/utils/loanCalculations.ts`, remove the hardcoded 6-month collateral branch and let collateral be driven by its product config (`interest_period = per_loan`, 30% flat) as a **single** 30-day payment, so total repayment is not split into 6. Align `generateRepaymentSchedule` (UI preview) and `src/utils/createRepaymentSchedule.ts` (authoritative schedule) so collateral creates **one** installment due 30 days after disbursement (bullet behaviour), matching the correctly-rendered example loans. Verify with the reported figure (balance K8,495 → +30% = K11,043.5 due once, not K1,840 × 6).

### 4. Enable Reloan/Restructure/Top-Up on Defaulted loans
In `LoanDetailsModal.tsx`, add `"defaulted"` to the status conditions that show Reloan, Restructure and Top-Up (matching the user's confirmation that defaulted-but-paid clients must be able to reloan). With the audit_logs fix in place, these actions will complete successfully.

### 5. Re-theme both PDFs + accurate Outstanding Balance
- `src/utils/generateStatement.ts`: replace hot-pink `RGB(255,51,153)` with the brand palette used in `generateLoanSchedule.ts` (primary magenta `RGB(244,36,140)` / dark burgundy `RGB(108,26,58)` header). Ensure the Outstanding Balance is computed from principal remaining + unpaid penalties (not just total − paid).
- `src/utils/generateLoanSchedule.ts`: keep the shared brand palette and always render the Outstanding Balance row; confirm term/installment labels reflect the corrected collateral math.

## Verification
- Run the loan-calculation unit tests; add/adjust a collateral case (single 30-day payment).
- Manually confirm a Defaulted loan now shows Reloan/Restructure/Top-Up and that performing a Reloan succeeds (no audit_logs RLS error in logs).
- Re-create a Marketeer borrower and confirm success.
- Regenerate both PDFs and visually QA: magenta/burgundy theme, correct outstanding balance, correct collateral installment.

## Technical Notes (for reference)
- Migration target: `public.audit_logs` — add `FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)` (read policy unchanged).
- Files: `supabase/functions/create-borrower/index.ts`, `src/utils/loanCalculations.ts`, `src/utils/createRepaymentSchedule.ts`, `src/components/admin/LoanDetailsModal.tsx`, `src/utils/generateStatement.ts`, `src/utils/generateLoanSchedule.ts`.
- Brand palette already defined as `BRAND` in `generateLoanSchedule.ts`; reuse the same values in `generateStatement.ts`.