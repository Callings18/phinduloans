# Launch matrix — House × Role × Flow UAT

This document turns the **House × Role × Flow** grid into an executable sign-off checklist. Use it per **loan product house** (`product_code` / URL `/admin/houses/:productCode`) plus **global admin** routes where noted.

## How to read the matrix

| Symbol | Meaning |
|--------|--------|
| **✓** | **In scope for UAT** — this role must verify the flow works (correct UI, permissions, no silent failures). |
| **—** | **Not applicable** — this role is not expected to perform this flow in the product (by design). *Do not treat “—” as unfinished engineering work.* |

Example: **Write-offs** are **—** for Borrower and Loan officer because only **Finance** and **Admin** (with `writeoffs:view`) use `/admin/write-offs`. Borrowers do not get write-off screens.

Repeat the **✓** checks for **each house you launch** (same routes under `/admin/houses/:productCode` with house permissions), unless two houses share one **archetype** and you document “verified on House A, representative for House B.”

---

## Master matrix (roles × flows)

| Flow | Borrower | Loan officer / house staff | Finance | Admin |
|------|:--------:|:--------------------------:|:-------:|:-----:|
| Apply / pre-qual | ✓ | — | — | — |
| KYC upload / verify | ✓ | ✓ | — | ✓ |
| Application review → approve/reject | — | ✓ | — | ✓ |
| Loan create / terms | — | ✓ | — | ✓ |
| Disbursement request → complete/fail | — | ✓ | ✓ | ✓ |
| Repayment schedule / manual payment / claims | ✓ | ✓ | ✓ | ✓ |
| Collections / comms (if used) | — | ✓ | ✓ | ✓ |
| Write-offs / expenses approvals | — | — | ✓ | ✓ |
| Reports / exports | — | ✓ | ✓ | ✓ |

---

## Route map (where to verify)

**Borrower (no `/admin`)**

| Flow | Primary routes | Pass criteria (summary) |
|------|----------------|-------------------------|
| Apply / pre-qual | `/apply`, Quick apply on `/dashboard` | Submit or save draft; no unexplained 403/500; lands on dashboard or clear success. |
| KYC upload / verify | `/dashboard` (KYC sheet), `/profile` | Documents visible; upload or status clear. |
| Repayment / claims | `/dashboard` → Payments tab | Schedule or claims list loads; submit claim shows feedback. |

**Global admin (`/admin/*`, `PermissionRoute` modules)**

| Flow | Primary routes | Module / notes |
|------|----------------|----------------|
| KYC / applications | `/admin/applications` | `loans:view`; documents + approval workflow tabs |
| Loan create / terms | `/admin/loans`, `/admin/applications` | `loans:view` |
| Disbursement | `/admin/disbursements` | `disbursement:view` |
| Repayments | `/admin/repayments` | `repayments:view` |
| Collections | `/admin/collections` | `collections:view` |
| Write-offs | `/admin/write-offs` | `writeoffs:view` |
| Expenses | `/admin/expenses` | finance role typically |
| Reports | `/admin/reports` | `reports:view` or `reports:export` |

**House (`/admin/houses/:productCode/...`, `house` module actions)**

| Flow | Primary routes | Typical permission |
|------|----------------|---------------------|
| Dashboard | `/admin/houses/:code` | `house:dashboard_view` |
| Borrowers | `.../borrowers`, `.../borrowers/:id` | `house:borrowers_view` |
| Loans | `.../loans`, `.../loans/create`, `.../loans/:loanId` | `house:loans_view`, `house:loans_create`, … |
| Review | `.../review` | `review_*` |
| Disbursements | `.../disbursements` | `disbursement_view` / `disbursement_disburse` |
| Collections | `.../collections` | `collections_view` / `collections_manage` |
| Reports | `.../reports` | `reports_view` / `reports_export` |

Source: [`src/App.tsx`](../src/App.tsx) nested routes under `houses/:productCode`.

---

## Sign-off template (copy per house)

**House:** `<product_code>`  
**Environment:** staging / prod  
**Build / commit:**  
**Tester:**  
**Date:**

| Flow | Borrower | House staff | Finance | Admin | Notes |
|------|----------|-------------|---------|-------|-------|
| Apply / pre-qual | ☐ | — | — | — | |
| KYC | ☐ | ☐ | — | ☐ | |
| Application review | — | ☐ | — | ☐ | |
| Loan create / terms | — | ☐ | — | ☐ | |
| Disbursement | — | ☐ | ☐ | ☐ | |
| Repayment / claims | ☐ | ☐ | ☐ | ☐ | |
| Collections | — | ☐ | ☐ | ☐ | |
| Write-offs / expenses | — | — | ☐ | ☐ | |
| Reports | — | ☐ | ☐ | ☐ | |

---

## Automated smoke (partial coverage)

Playwright tests in [`tests/e2e/smoke.spec.ts`](../tests/e2e/smoke.spec.ts) cover **some** cells when credentials are set. They **do not** replace full UAT. See that file for `E2E_*` env vars.

**Related docs:** [`CLIENT_UAT_CHECKLIST_10.md`](./CLIENT_UAT_CHECKLIST_10.md) · [`RLS_UI_MATRIX.md`](./RLS_UI_MATRIX.md) · [`FLOWS_AND_MODULES_AUDIT.md`](./FLOWS_AND_MODULES_AUDIT.md)
