

## Stabilization plan: one clear workflow, no dead ends

The system can do what the client needs — but the same action exists in 2-3 places with different rules, and several pages look interactive but are gated on hidden requirements. That's why "nothing works." Fix is **consolidation, not new features.**

### 1. Make every Pay button work the first time

**Problem:** On `HouseLoanDetailPage`, each repayment row has a Pay button that's silently disabled until the user picks "Credit to" + "Method" at the top. No tooltip, no inline error.

**Fix:**
- Keep the top "Method / Credit to" selectors (you said don't remove them).
- When "Credit to" is empty, show an inline orange notice **above the schedule**: *"Select a 'Credit to' account above to enable Pay buttons"* — with a button that scrolls/focuses the selector.
- On a disabled Pay button, add a tooltip: *"Choose a 'Credit to' account first."*
- When the Pay amount exceeds the installment, show the same red border + toast already used in the dialog.

Result: Pay always either works or tells you exactly why it can't.

### 2. Remove duplicate disbursement & status flows

**Problem:** Disbursement, approve/reject, default, and restructure exist in **three** places with subtle differences:
- `HouseLoanDetailPage` "Servicing Actions" card
- `HouseLoanActions` toolbar (also on detail page)
- `LoanDetailsModal` ("Open full loan details")

Three buttons that do almost-the-same-thing is the #1 source of "it's broken."

**Fix:** Pick `LoanDetailsModal` as the single source of truth (it's the most complete and the user already approved restoring it). On `HouseLoanDetailPage`:
- Keep ONE prominent **"Open full loan details"** button (already there).
- Keep the **Pay table** (collections workflow) and the **schedule download**.
- **Remove** the duplicated "Servicing Actions" card and the `HouseLoanActions` toolbar from this page.
- Top of page becomes a clean summary + "Open full loan details" + Pay table. Done.

### 3. Make "who is overdue" loud and obvious in every house

**Already done** on `HouseLoansPage` (red row, badge, days late) and `HouseCollectionsPage` (Overdue summary card, red badge per row). Verify Salary Advance + Marketeer routes use these same shared pages — confirmed from the routing they do.

**Add** on `HouseLoanDetailPage`: the existing per-row red "Overdue" badge + "X days late" hint is already in code (lines ~256-260) but I'll confirm it's actually rendered in the table body when I implement.

### 4. Hide houses you don't actually use

**Problem:** `AdminHousesIndex` shows every product in `LOAN_PRODUCT_MODULES`. If only Salary Advance and Marketeer are real, the others are noise that look like they should work but don't have full data.

**Fix:** Add a `enabled: true/false` flag per module in `loanProductModules.ts`. Default the unused ones to `false` so the houses index only shows the ones actually in use. You can flip them on later.

### 5. Dead-code sweep (only files we touch)

- Drop unused imports in `HouseLoanDetailPage.tsx` after removing the Servicing Actions card (`Select*`, `HouseLoanActions`, status mutation if no longer needed).
- Remove the `selectedDisbursementAccount` / `disbursementMutation` / `statusMutation` blocks from this page (they move to the modal).
- Net effect: ~120 lines of duplicate UI/logic removed from one file.

### Files touched

- `src/pages/admin/houses/HouseLoanDetailPage.tsx` — remove duplicate servicing actions, add inline "select Credit to" hint, tooltip on disabled Pay, confirm overdue badge in table body
- `src/pages/admin/houses/AdminHousesIndex.tsx` — filter modules by `enabled`
- `src/config/loanProductModules.ts` — add `enabled` flag per module
- (Verify only, no edit) `HouseCollectionsPage.tsx`, `HouseLoansPage.tsx`

### Out of scope

- No DB/RPC changes.
- No changes to `LoanDetailsModal` itself (it's the source of truth).
- No new pages, no new features. Pure consolidation.
- Keeping the "Credit to / Method" top selector exactly as you asked.

### Question before I start

Which product houses should stay visible on the houses index? My default: **Salary Advance + Marketeer enabled, the rest hidden.** If you want a different set, tell me and I'll set it accordingly.

