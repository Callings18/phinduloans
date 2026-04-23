

## Admin module audit — keep what works, delete the rest

After mapping every admin route, sidebar entry, and page file, the system is doing **everything 2-3 times**. That's the bug source. The fix isn't more code — it's deleting overlap and making each module have **one clear path**.

### What I found (module by module)

| Module | Status | Issue |
|---|---|---|
| Dashboard | ✅ Keep | Single source — fine |
| Applications (`AdminApplications`, **2,786 lines**) | ⚠ Bloated | Same file does intake + approval + disbursement + contract — overlaps with `AdminDisbursements` and `LoanDetailsModal` |
| Loans (`AdminLoans` 1,456 lines) | ✅ Keep | Primary portfolio view — keep as source of truth |
| Loan Product Dashboards (`/admin/loan-product-dashboards`) | ❌ Delete | Duplicate of "Product Houses". Behind a beta flag, never finished. `AdminLoanProductScopedDashboard` is a stub showing 2 metrics — both already on Houses |
| Product Houses index | ✅ Keep | Already cleaned to Salary Advance + Marketeer |
| `MarketeerHouseDashboard` page | ❌ Delete | Orphan — imported in `App.tsx` but **not routed anywhere**. Dead code |
| House Review (`/admin/houses/:code/review`) | ⚠ Verify | Only useful if multi-stage approval is on. Currently empty for most houses → hide tab if unused |
| Borrowers / Employers | ✅ Keep | Clean |
| PMIC / CRB queue | ✅ Keep | Real flows |
| Disbursements (`AdminDisbursements` 939 lines) | ⚠ Overlaps | Disburse action exists in 3 places: this page, `LoanDetailsModal`, `AdminApplications`. Pick this page as the **single disbursement surface**, leave only "view" links elsewhere |
| Repayments / Bulk repayments / Collections | ⚠ Overlap | `AdminRepayments` (1,423 lines) and `AdminCollections` (1,236) cover same pay-recording flow. Keep both pages but route every "record payment" call through the **same dialog + RPC** (already mostly true via `record_loan_payment`) |
| Accounts | ✅ Keep | Working |
| **Wallets (`/admin/wallets`)** | ❌ Delete | Sidebar entry already commented out as "Coming Soon", but the route + 249-line stub still exists. Page does nothing |
| Expenses | ✅ Keep | |
| Write-offs / Court cases | ✅ Keep | |
| HR / Payroll / Payroll tax config | ✅ Keep | |
| Reports | ✅ Keep | |
| Audit logs | ✅ Keep | |
| Contract templates | ✅ Keep | |
| Staff / Roles & permissions | ✅ Keep | |
| Email log | ✅ Keep | |
| User guide | ✅ Keep | |
| Settings | ✅ Keep | |
| **Production readiness (345 lines)** | ❌ Delete | Internal dev self-check page. Confusing for the client, never used in production workflow |
| **UAT checklist (231 lines)** | ❌ Delete | Internal sign-off tool. Belongs in docs, not in client's nav |
| Feature flags | ✅ Keep | Admin-only, useful |

### What I'll do

**1. Delete dead pages and routes (no UI change for the user, just less to break)**
- Remove route + import + file: `AdminWallets`, `AdminProductionReadiness`, `AdminUatChecklist`, `AdminLoanProductDashboards`, `AdminLoanProductScopedDashboard`, `MarketeerHouseDashboard`.
- Remove the matching sidebar group **"Launch & operations"** (Production readiness + UAT checklist) — pure internal noise.
- Remove the `Loan Product Dashboards` child entry under Loans (duplicate of Houses).

**2. Remove dead route paths from `App.tsx`**
- `/admin/wallets`, `/admin/production-readiness`, `/admin/uat-checklist`, `/admin/loan-product-dashboards`, `/admin/loans/products/:productId/dashboard` — all gone.

**3. Hide House `Review` tab when no multi-stage approval is configured**
- In `HouseLayout.tsx`, only show the Review tab if the product's workflow has `requires_review` (or always-hide for Salary Advance + Marketeer for now).

**4. Verify (no edits) — confirm one-path-per-action**
- Disbursement → only `AdminDisbursements` + `LoanDetailsModal` (read in modal, action on page). Confirm `AdminApplications` no longer has a duplicate "Complete disbursement" button; if it does, replace with "Open disbursements".
- Payment recording → confirm every entry calls `record_loan_payment` RPC (already standardised via `handlePaymentReceipt`).

**5. Light cleanup inside touched files only**
- Drop unused imports left over after route removal in `App.tsx`.
- Drop `AdminWallets` + production-readiness comments / sidebar entries.

### Files touched

- `src/App.tsx` — remove 6 imports + 6 route blocks (~110 lines)
- `src/components/admin/adminSidebarConfig.ts` — remove "Launch & operations" group + Loan Product Dashboards child + commented Wallets line
- `src/components/admin/house/HouseLayout.tsx` — hide Review tab when not applicable
- **Delete**: `src/pages/admin/AdminWallets.tsx`, `src/pages/admin/AdminProductionReadiness.tsx`, `src/pages/admin/AdminUatChecklist.tsx`, `src/pages/admin/AdminLoanProductDashboards.tsx`, `src/pages/admin/AdminLoanProductScopedDashboard.tsx`, `src/pages/admin/houses/MarketeerHouseDashboard.tsx`

### Net result

- **~1,650 lines of dead code removed**
- **6 fewer pages** for the client to stumble into
- **3 fewer sidebar entries** ("Launch & operations" group + Loan Product Dashboards)
- Every remaining module has **one obvious page** where the action lives

### Out of scope (separate passes if you want them)

- Splitting the 2,786-line `AdminApplications` — risky, needs its own focused pass
- Merging `AdminRepayments` + `AdminCollections` into one page — they serve different teams (finance vs collections officer); keeping both
- DB / RPC changes — none needed
- Borrower-side changes — none

### Confirm before I delete

These 6 pages get deleted permanently. Confirm none of them are something you actively use:

1. `/admin/wallets` (Coming Soon stub)
2. `/admin/production-readiness` (internal dev self-check)
3. `/admin/uat-checklist` (internal sign-off tracker)
4. `/admin/loan-product-dashboards` (duplicate of Product Houses)
5. `/admin/loans/products/:id/dashboard` (2-metric stub)
6. `MarketeerHouseDashboard.tsx` (orphan, not routed)

Reply "go" and I delete + clean up. If you want to **keep** any of them, tell me which and I'll leave those.

