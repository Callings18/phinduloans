# RLS vs UI matrix (handover)

Use this during **staging sign-off** before client go-live. For each route, log in as a **non–super_admin** user with the listed role(s), open the screen, and perform the **spot-check action**. Mark **PASS** only if the UI matches permission (no misleading enabled buttons that always fail) and failures show a **clear message** (not a raw Postgres string).

**Related:** [CLIENT_READINESS_BACKLOG.md](./CLIENT_READINESS_BACKLOG.md) (M5) · [QA_SIGNOFF_CHECKLIST.md](./QA_SIGNOFF_CHECKLIST.md)

## Global guards

| Layer | Behaviour |
|-------|-----------|
| `/admin/*` | `AdminRoute` — requires authenticated **staff** (`isStaff`); otherwise redirect to `/dashboard` or `/auth`. |
| Nested admin pages | `PermissionRoute` — `adminOnly`, single `permission`, or `anyOf` per route in `src/App.tsx`. |
| `get_my_permissions` RPC failure | `PermissionRoute` shows an error panel (non–super_admin). |

## Admin routes (from `App.tsx` + `adminSidebarConfig.ts`)

| Route | Permission / guard | Suggested roles to test | Spot-check |
|-------|-------------------|-------------------------|------------|
| `/admin` | Staff only | loan_officer, finance_officer | Dashboard loads |
| `/admin/applications` | `loans:view` | loan_officer | Open one application |
| `/admin/borrowers` | `borrowers:view` | loan_officer | Search list |
| `/admin/employers` | `borrowers:view` | loan_officer | List loads |
| `/admin/disbursements` | `disbursement:view` | finance_officer | Open queue |
| `/admin/repayments` | `repayments:view` | finance_officer | List loads |
| `/admin/bulk-repayments` | `repayments:view` | finance_officer | Page opens |
| `/admin/accounts` | `disbursement:view` | finance_officer | List loads |
| `/admin/wallets` | `wallets:view` | finance_officer | List loads |
| `/admin/expenses` | `expenses:view` | finance_officer | List / actions per role |
| `/admin/collections` | `collections:view` | collections_officer | List loads |
| `/admin/write-offs` | `writeoffs:view` | finance_officer | List / approve if permitted |
| `/admin/court-cases` | `court:view` | credit_officer | List loads |
| `/admin/reports` | `reports:view` **or** `reports:export` | auditor | Tabs / export |
| `/admin/audit-logs` | `audit:view` | auditor | List loads |
| `/admin/loans` | `loans:view` | loan_officer | List loads |
| `/admin/houses` | `loans:view` | loan_officer | **Houses hub** heading |
| `/admin/houses/:productCode` | `house:dashboard_view` + product access | Scoped user | Dashboard + one sub-tab |
| `/admin/loan-product-dashboards` | `loans:view` | loan_officer | Hub loads |
| `/admin/loan-products` | **adminOnly** | admin vs loan_officer | Non-admin → redirect |
| `/admin/pmic` | `loans:view` | loan_officer | Page loads |
| `/admin/crb-queue` | `loans:view` or `loans:finance_approve` | loan_officer | Queue loads |
| `/admin/hr` | `hr:view` or `hr:manage` | HR / finance | Employees list |
| `/admin/payroll` | `payroll:view` / `manage` / `approve` | finance_officer | Runs list; generate if **manage** |
| `/admin/payroll-tax-config` | `payroll:view` or `payroll:manage` | finance_officer | Table; edit if **manage** |
| `/admin/contract-templates` | `loans:view` | admin | Templates |
| `/admin/staff` | `settings:manage` | admin only in practice | Non-admin → redirect |
| `/admin/settings` | `settings:manage` | admin | Save one safe setting |
| `/admin/email-log` | **adminOnly** | admin | List loads |
| `/admin/roles-permissions` | **adminOnly** | admin | Page loads |
| `/admin/user-guide` | Staff (no extra perm) | any staff | Page loads |

## Borrower / public

| Route | Guard | Spot-check |
|-------|-------|------------|
| `/dashboard` | Requires user; admins redirected to `/admin` | Borrower sees loans |
| `/profile` | Requires user | Tab loads |
| `/apply` | Submit requires auth | Start draft / submit |

## Sign-off block

| Tester | Date | Environment (URL) | Notes |
|--------|------|---------------------|-------|
| | | | |

Fill **PASS** / **LIMIT** / **FAIL** in your own copy (spreadsheet or GitHub issue checklist) per row and role.
