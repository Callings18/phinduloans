# Loan house audit — Phase 9 (legacy & borrower)

Code-review status for Phase 9. Live notification smoke remains an **operator** task on staging/production.

## Legacy admin parity

| Legacy page | Banner | House deep link |
|-------------|--------|-----------------|
| Applications | `LegacyAdminPathBanner` `applications` | `/admin/houses` |
| Loans | `loans` | Per-loan when `productCode` + `loanId` passed |
| Disbursements | `disbursements` | `houseDisbursementsPath` |
| Repayments | `repayments` | `houseCollectionsPath` |
| Collections | `collections` | `houseCollectionsPath` |

Canonical path helpers: [`src/utils/adminHousePaths.ts`](../src/utils/adminHousePaths.ts).

Cross-product legacy flows should use the same RPCs as houses (`houseWorkflowRepository`, `complete_disbursement`, `record_loan_payment`). See [`PHASE3_HANDOVER.md`](./PHASE3_HANDOVER.md).

## Borrower apply vs house-only

All seven products are **admin house create** first (`loanProductModules.ts` → `/admin/houses/{CODE}/loans/create`). Borrower self-serve routes depend on catalog `is_active` and product-specific apply pages in the borrower app.

**Operator UAT:** For each `product_code`, confirm whether borrowers can start an application from the dashboard or staff must create in the house. Document in the audit matrix Phase 9 row. Reference: [`FLOWS_AND_MODULES_AUDIT.md`](./FLOWS_AND_MODULES_AUDIT.md) (if present) and [`PHASE3_HANDOVER.md`](./PHASE3_HANDOVER.md).

Shared guards (both channels):

- Duplicate active loan: `block_duplicate_active_loan` + client checks
- Completion reconcile: migration `20260604100000`

## Notifications

One end-to-end path per house on staging:

1. Manager approval
2. Disbursement completed
3. Payment recorded (receipt)

Channels and templates: [`PHASE3_HANDOVER.md`](./PHASE3_HANDOVER.md). Requires configured SMS/email/push secrets in the target environment.
