# Loan house audit — staging baseline (Phase 0)

Complete this **once** on the staging / Lovable preview Supabase project before per-house UAT.

## 1. Deploy application

- [ ] `main` branch deployed to staging (Lovable preview or Vercel preview).
- [ ] Confirm build includes latest collateral + completion fixes (`20260604130000`, `20260604100000`).

## 2. SQL migrations (timestamp order)

Apply via `supabase db push` (linked CLI) or Lovable **SQL Editor**. Skip files already applied.

**Step-by-step:** [`LOAN_HOUSE_SQL_APPLY_CHECKLIST.md`](./LOAN_HOUSE_SQL_APPLY_CHECKLIST.md).

### House platform pack (if not on DB yet)

See [`LOVABLE_MIGRATION_PACK.md`](./LOVABLE_MIGRATION_PACK.md):

| File |
|------|
| `20260413130000_loan_products_extensions_and_phindu_catalog.sql` |
| `20260414010000_product_house_access_core.sql` |
| `20260414020000_rbac_house_permissions.sql` |
| `20260414030000_has_product_access_function.sql` |
| `20260414040000_house_rls_policies.sql` |
| `20260414050000_house_indexes_and_views.sql` |
| `20260414060000_house_review_stage_defaults.sql` |
| `20260414070000_house_workflow_rpc_and_write_policies.sql` |
| `20260414080000_marketeer_fixed_terms.sql` |
| `20260416212000_auth_profile_trigger_hardening.sql` |
| `20260417090000_salary_advance_staff_rules_and_access.sql` |

### June 2026 repairs (collateral + completion)

See [`MIGRATIONS_FOR_DEPLOY.md`](./MIGRATIONS_FOR_DEPLOY.md):

| File |
|------|
| `20260603185037_443ee6b5-5131-4ee1-9b54-a4a7e1a48593.sql` |
| `20260603204500_collateral_term_1_12_everywhere.sql` |
| `20260603213000_collateral_partial_payment_repair.sql` |
| `20260604100000_reconcile_fully_paid_loan_statuses.sql` |
| `20260604130000_collateral_per_loan_interest_catalog.sql` |
| `20260604150000_collateral_processing_fee_5_percent.sql` |
| `20260604160000_restore_house_product_enforce_rules.sql` |
| `20260604170000_payday_per_loan_interest_catalog.sql` |

**Operator / date applied:** _______________________

## 3. Catalog verification

```sql
SELECT product_code, name, is_active, interest_period, interest_rate,
       min_term_months, max_term_months, term_unit,
       processing_fee_percent, legal_fee_percent, legal_fee_deduction_mode
FROM public.loan_products
WHERE product_code IS NOT NULL
ORDER BY product_code;
```

**Expected highlights:**

| product_code | interest_period | term bounds |
|--------------|-----------------|-------------|
| COLLATERAL | `per_loan` | 1–12 months |
| MARKETEER | (catalog) | 26 days collection |
| PAYDAY_SOFT | monthly | 30 days |
| MOTOR_VEHICLE | monthly | 3–24 months |

## 4. Staff access seeds

```sql
SELECT product_code, count(*) AS users_with_access
FROM public.user_product_access
WHERE is_active = true
GROUP BY product_code
ORDER BY product_code;
```

UAT staff user must have rows for all seven codes in [`loanProductModules.ts`](../src/config/loanProductModules.ts).

**Test staff user UUID:** _______________________

**Funding account UUID (disbursement):** _______________________

## 5. Audit artifacts

- [x] [`LOAN_HOUSE_AUDIT_MATRIX.md`](./LOAN_HOUSE_AUDIT_MATRIX.md) — module sign-off grid
- [x] [`LOAN_HOUSE_HEALTH_SQL.md`](./LOAN_HOUSE_HEALTH_SQL.md) — data health queries per house
- [x] [`LOAN_HOUSE_UAT_RUNBOOK.md`](./LOAN_HOUSE_UAT_RUNBOOK.md) — golden path steps
- [x] [`LOAN_HOUSE_INTEGRATION.md`](./LOAN_HOUSE_INTEGRATION.md) — RPC integration per house
- [x] [`LOAN_HOUSE_PRODUCTION_ROLLOUT.md`](./LOAN_HOUSE_PRODUCTION_ROLLOUT.md) — production checklist

## 6. Automated baseline (local / CI)

```bash
npm test
npm run typecheck
# Optional with Supabase secrets:
# E2E_PRODUCT_CODE=COLLATERAL npm run test:integration:loan-flow
```
