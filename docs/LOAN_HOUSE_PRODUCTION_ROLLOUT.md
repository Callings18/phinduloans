# Loan house audit — production rollout

Apply after **staging sign-off** in [`LOAN_HOUSE_AUDIT_MATRIX.md`](./LOAN_HOUSE_AUDIT_MATRIX.md).

## 1. Pre-flight

- [ ] Staging golden path recorded (loan IDs per house in audit matrix).
- [ ] P0/P1 defects in matrix defect log are closed or explicitly deferred with owner.
- [ ] Finance approves any data-repair SQL from [`LOAN_HOUSE_HEALTH_SQL.md`](./LOAN_HOUSE_HEALTH_SQL.md).

## 2. Migrations (production Supabase)

Apply in **timestamp order** from [`MIGRATIONS_FOR_DEPLOY.md`](./MIGRATIONS_FOR_DEPLOY.md). Same set as [`LOAN_HOUSE_STAGING_BASELINE.md`](./LOAN_HOUSE_STAGING_BASELINE.md) §2.

**Operator / date:** _______________________

**Migration head (last file applied):** _______________________

## 3. Read-only health SQL

Run house-filtered queries in [`LOAN_HOUSE_HEALTH_SQL.md`](./LOAN_HOUSE_HEALTH_SQL.md). Do **not** run broad `UPDATE` without finance sign-off.

| House | Stuck active | Schedule vs total_repayment | Wrong interest_period |
|-------|:------------:|:-------------------------:|:---------------------:|
| COLLATERAL | | | |
| MARKETEER | | | |
| PAYDAY_SOFT | | | |
| SALARY_ADVANCE | | | |
| SALARY_ADVANCE_STAFF | | | |
| BUSINESS | | | |
| MOTOR_VEHICLE | | | |

## 4. Production smoke (one golden path per house)

Follow [`PRODUCT_ACCEPTANCE_CHECKLIST.md`](./PRODUCT_ACCEPTANCE_CHECKLIST.md) and per-house tables in [`PHASE2_HANDOVER.md`](./PHASE2_HANDOVER.md):

Create → Review (3-stage) → Disburse → Collect (full payment) → Reports post.

Record production loan IDs in the audit matrix **Prod** column.

## 5. Client sign-off

- [ ] [`PRODUCT_ACCEPTANCE_CHECKLIST.md`](./PRODUCT_ACCEPTANCE_CHECKLIST.md) signed.
- [ ] [`PHASE2_HANDOVER.md`](./PHASE2_HANDOVER.md) house UAT tables complete.

## 6. Ops monitoring

Enable daily checks from [`LAUNCH_OPS_RUNBOOK.md`](./LAUNCH_OPS_RUNBOOK.md):

- Duplicate active loans per borrower/product
- Completed loans with outstanding balance
- Notification backlog

## 7. Integration verification (optional)

With production-like secrets (read-only staff user recommended for first run):

```bash
E2E_PRODUCT_CODE=COLLATERAL npm run test:integration:loan-flow
# … repeat for each code, or:
npm run test:integration:houses
```

See [`LOAN_HOUSE_INTEGRATION.md`](./LOAN_HOUSE_INTEGRATION.md).
