# Loan house UAT runbook (staging / production)

Use with [`LOAN_HOUSE_AUDIT_MATRIX.md`](./LOAN_HOUSE_AUDIT_MATRIX.md). One pass per `product_code` at `/admin/houses/{CODE}`.

## Prerequisites

- Phase 0 complete: [`LOAN_HOUSE_STAGING_BASELINE.md`](./LOAN_HOUSE_STAGING_BASELINE.md)
- Staff user with `user_product_access` for the house
- Active funding account for disbursement

## Golden path (every house)

| Step | Module | Action | Pass criteria |
|------|--------|--------|---------------|
| 1 | Borrowers | Create or select borrower | Appears in house borrower list |
| 2 | Create | New loan with valid product fields | Preview totals match saved application (±0.01) |
| 3 | Review | Officer → Finance → Manager | Status advances; reject reasons work |
| 4 | Disbursements | Complete disbursement | Pending amount = principal − fees; schedule rows created |
| 5 | Collections | Record payment(s) until paid | Receipt; loan `completed` when fully paid |
| 6 | Reports | Export + Post to Admin Reports | File downloads; post succeeds |

Record **loan ID** in the audit matrix for that house.

## House-specific checks

| Code | Extra verification |
|------|-------------------|
| `COLLATERAL` | `interest_period` = `per_loan`; “Borrower receives (net)” includes legal fees; term 1–12 |
| `MARKETEER` | 26-day term; compliance + 6+ mo business; daily schedule |
| `PAYDAY_SOFT` | Lusaka only; 30-day bullet |
| `SALARY_ADVANCE` | Civil servant; 1 month; amount bounds |
| `SALARY_ADVANCE_STAFF` | Staff max amount; dedicated house access |
| `BUSINESS` | Self-employed/contract only |
| `MOTOR_VEHICLE` | Term 3–24; vehicle docs on detail |

## Data health (after UAT)

Run [`LOAN_HOUSE_HEALTH_SQL.md`](./LOAN_HOUSE_HEALTH_SQL.md) for the house. Document repairs in the matrix defect log.

## Phase 9 (after all houses)

| Track | Reference |
|-------|-----------|
| Legacy admin map | [`PHASE3_HANDOVER.md`](./PHASE3_HANDOVER.md) |
| Borrower self-serve vs house-only | [`FLOWS_AND_MODULES_AUDIT.md`](./FLOWS_AND_MODULES_AUDIT.md) |
| Notifications | [`PHASE3_HANDOVER.md`](./PHASE3_HANDOVER.md) channel table |
