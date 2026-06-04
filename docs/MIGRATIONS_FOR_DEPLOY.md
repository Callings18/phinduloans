# SQL migrations to apply (Phases 1–3 handover)

Apply these **in timestamp order** on your Supabase/Postgres environment (CLI: `supabase db push`, or SQL Editor in Lovable/dashboard).

**Operator checklist (June 2026 + verify SQL):** [`LOAN_HOUSE_SQL_APPLY_CHECKLIST.md`](./LOAN_HOUSE_SQL_APPLY_CHECKLIST.md).

## June 2026 — collateral interest catalog (per_loan total %)

| Order | File | Purpose |
|------:|------|---------|
| 1 | [`supabase/migrations/20260604130000_collateral_per_loan_interest_catalog.sql`](../supabase/migrations/20260604130000_collateral_per_loan_interest_catalog.sql) | Sets `COLLATERAL` product to `interest_period = per_loan` so entered % is **total** over the term (fixes inflated interest when catalog was `monthly`). |

Run after deploy of the matching frontend (collateral form locks to per_loan and shows net borrower receivable including legal fees).

## June 2026 — fully paid loans stuck as active (blocks new applications)

| Order | File | Purpose |
|------:|------|---------|
| 1 | [`supabase/migrations/20260604100000_reconcile_fully_paid_loan_statuses.sql`](../supabase/migrations/20260604100000_reconcile_fully_paid_loan_statuses.sql) | **Data repair + guard:** sets `completed` when all installments are cleared and principal paid ≥ `total_repayment`; backfills stuck `active`/`disbursed` loans; trigger on `loan_repayments` for future payments. |

**Symptom:** “Borrower already has an active loan” after they paid off in full. **After applying:** retry the new loan; use **Mark completed** on the old loan in loan details if needed.

**Note:** Do not apply `20260604101141_…sql` (Lovable duplicate of this file — removed from repo).

## June 2026 — collateral term + installment repair (3 migrations)

All three files are dated **2026-06-03**. Run them sequentially; skip any step already applied in your environment.

| Order | File | Purpose |
|------:|------|---------|
| 1 | [`supabase/migrations/20260603185037_443ee6b5-5131-4ee1-9b54-a4a7e1a48593.sql`](../supabase/migrations/20260603185037_443ee6b5-5131-4ee1-9b54-a4a7e1a48593.sql) | Collateral catalog bounds (1–12 months) + `enforce_house_product_rules()` guard. |
| 2 | [`supabase/migrations/20260603204500_collateral_term_1_12_everywhere.sql`](../supabase/migrations/20260603204500_collateral_term_1_12_everywhere.sql) | **Data repair**: recompute `monthly_payment` and pending/overdue installments for collateral loans with **no paid installments** (fixes old 6-way split artifacts). |
| 3 | [`supabase/migrations/20260603213000_collateral_partial_payment_repair.sql`](../supabase/migrations/20260603213000_collateral_partial_payment_repair.sql) | **Data repair (Phase 2)**: collateral loans **with** paid/partial installments — fix `monthly_payment`, redistribute remaining balance across untouched pending/overdue rows. Skips rows with `principal_paid > 0`. |

If migration (1) is already applied in Lovable, run **only** (2) then (3) in the SQL editor.

See also [`PHASE3_HANDOVER.md`](./PHASE3_HANDOVER.md) for admin consolidation, notification checklist, and sign-off. Phase 2 CI/UAT: [`PHASE2_HANDOVER.md`](./PHASE2_HANDOVER.md).

## Lovable / hosted Supabase — paste checklist

1. Open **SQL Editor** in the Supabase project linked to Lovable.
2. Run `20260603185037_…sql` if collateral term edits still fail with “must equal 6 months” or product max term is still 6.
3. Run `20260603204500_collateral_term_1_12_everywhere.sql` to fix stored installment amounts on collateral loans with no payments yet.
4. Run `20260603213000_collateral_partial_payment_repair.sql` for collateral loans that already have paid or partial installments.
5. Verify: `SELECT product_code, min_term_months, max_term_months FROM loan_products WHERE product_code = 'COLLATERAL';` → `1`, `12`.
6. Spot-check: loans with partial installments — confirm untouched pending rows sum to remaining balance; manually review any `partial` rows with `principal_paid > 0`.

CLI (when linked): from repo root, `supabase db push`.

## Earlier workflow migrations (reference)

| Order | File | Purpose |
|------:|------|---------|
| — | [`supabase/migrations/20260406091500_phase1_workflow_backbone.sql`](../supabase/migrations/20260406091500_phase1_workflow_backbone.sql) | Phase 1 workflow: `loan_status_transitions`, timeline/payment-claim fields, RLS. |
| — | [`supabase/migrations/20260408120000_admin_expense_status_rpc.sql`](../supabase/migrations/20260408120000_admin_expense_status_rpc.sql) | `admin_set_expense_status` RPC. |
| — | [`supabase/migrations/20260408121000_admin_writeoff_rpcs.sql`](../supabase/migrations/20260408121000_admin_writeoff_rpcs.sql) | Write-off RPCs. |
| — | [`supabase/migrations/20260408122000_admin_mark_loan_defaulted.sql`](../supabase/migrations/20260408122000_admin_mark_loan_defaulted.sql) | `admin_mark_loan_defaulted` RPC. |
| — | [`supabase/migrations/20260408123000_crb_requests_rls_tighten.sql`](../supabase/migrations/20260408123000_crb_requests_rls_tighten.sql) | Tighten `crb_requests` RLS. |
| — | [`supabase/migrations/20260408124000_reports_query_indexes.sql`](../supabase/migrations/20260408124000_reports_query_indexes.sql) | Report query indexes. |

## Web Push (no new table migration)

Browser push subscriptions use the existing **`push_subscriptions`** table from  
[`supabase/migrations/20260108171013_68fb6947-6cc4-4eb3-8e58-7d2d0511db79.sql`](../supabase/migrations/20260108171013_68fb6947-6cc4-4eb3-8e58-7d2d0511db79.sql).  
Deploy the **`send-web-push`** Edge Function and set VAPID secrets (see [`supabase/functions/send-web-push/README.md`](../supabase/functions/send-web-push/README.md)).

## Loan house audit

After applying migrations above, use [`LOAN_HOUSE_STAGING_BASELINE.md`](./LOAN_HOUSE_STAGING_BASELINE.md) and [`LOAN_HOUSE_PRODUCTION_ROLLOUT.md`](./LOAN_HOUSE_PRODUCTION_ROLLOUT.md) for seven-house sign-off.
