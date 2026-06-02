## Plan

1. Fix Marketeer borrower creation failure
- Trace the create-borrower flow from the Marketeer add-borrower dialog into the backend function.
- Patch the failure path so phone-only borrower creation succeeds reliably for Marketeer borrowers.
- Improve the returned error handling so admins see the actual reason instead of the generic non-2xx function message.

2. Correct the loan statement and detail summary
- Update the statement/loan schedule styling to use the current landing-page theme color tokens instead of the old hardcoded pink.
- Add a clear outstanding balance figure to the generated loan statement/PDF and align the on-screen loan summary with the same numbers.
- Review the collateral loan summary math so totals shown for principal, repayment, paid, and balance reflect the real repayment state.

3. Restore servicing actions for reloan and restructure
- Inspect the current visibility rules for reloan, restructure, and related servicing options in the full loan details screen.
- Restore those actions where they should be available based on the loan state and existing workflow rules, without reintroducing invalid states.
- Ensure the quick actions shown in the modal and house views are consistent.

4. Validate the affected flows
- Re-check Marketeer borrower add flow.
- Re-check collateral/business loan detail totals and outstanding balance display.
- Re-check that reloan/restructure actions appear for eligible loans and remain hidden for ineligible ones.

## Technical notes
- Likely touchpoints: `supabase/functions/create-borrower/index.ts`, `src/pages/admin/houses/HouseBorrowersPage.tsx`, `src/utils/generateLoanSchedule.ts`, `src/pages/admin/houses/HouseLoanDetailPage.tsx`, and `src/components/admin/LoanDetailsModal.tsx`.
- I already confirmed the app theme still uses magenta-based primary tokens, while the PDF is using old hardcoded RGB values.
- I also confirmed the reloan/restructure logic still exists in the modal code, so this is likely a visibility/gating issue rather than missing functionality.