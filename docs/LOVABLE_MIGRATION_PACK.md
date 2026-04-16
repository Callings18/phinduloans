# Lovable Migration Pack (Main Branch)

Use this document whenever code is pushed to `main` and Lovable needs DB changes.

## 1) Execution order

Run these migrations in timestamp order:

1. `supabase/migrations/20260413130000_loan_products_extensions_and_phindu_catalog.sql`
2. `supabase/migrations/20260414010000_product_house_access_core.sql`
3. `supabase/migrations/20260414020000_rbac_house_permissions.sql`
4. `supabase/migrations/20260414030000_has_product_access_function.sql`
5. `supabase/migrations/20260414040000_house_rls_policies.sql`
6. `supabase/migrations/20260414050000_house_indexes_and_views.sql`
7. `supabase/migrations/20260414060000_house_review_stage_defaults.sql`
8. `supabase/migrations/20260414070000_house_workflow_rpc_and_write_policies.sql`
9. `supabase/migrations/20260414080000_marketeer_fixed_terms.sql`
10. `supabase/migrations/20260416212000_auth_profile_trigger_hardening.sql` — see `docs/SUPABASE_LOVABLE_AUTH_HANDOFF.md`

## 2) Purpose summary

### `20260413130000_loan_products_extensions_and_phindu_catalog.sql`
- Adds loan product engine fields:
  - `home_verification_required`
  - `late_fee_fixed_amount`
  - `pricing_tiers`
  - `repayment_anchor_rule`
  - `physical_collateral_collection`
- Updates existing products with stable `product_code` and richer product rules.
- Inserts missing products including `PAYDAY_SOFT`, `MOTOR_VEHICLE`, and `MARKETEER`.

### `20260414010000_product_house_access_core.sql`
- Creates `user_product_access` and seeds admin/super_admin all-product access.

### `20260414020000_rbac_house_permissions.sql`
- Adds canonical `house.*` permissions and role mappings for product-house workflows.

### `20260414030000_has_product_access_function.sql`
- Adds `has_product_access(p_user, p_product_code)` used by frontend and RLS.

### `20260414040000_house_rls_policies.sql`
- Adds product-aware SELECT policies for house-scoped data tables.

### `20260414050000_house_indexes_and_views.sql`
- Adds house query indexes and report view `v_house_report_summary`.

### `20260414060000_house_review_stage_defaults.sql`
- Backfills staged approval defaults for stable house review queue behavior.

### `20260414070000_house_workflow_rpc_and_write_policies.sql`
- Adds house RPC endpoints for review/disbursement/collections/status updates and product-scoped write policies.

### `20260414080000_marketeer_fixed_terms.sql`
- Enforces fixed Marketeer defaults: 30% interest, 26 collection days, Sundays excluded via repayment anchor rule.

### `20260416212000_auth_profile_trigger_hardening.sql`
- Hardens `handle_new_user` (profiles + default `user` role), recreates `on_auth_user_created`, backfills missing profiles/roles. Full notes: `docs/SUPABASE_LOVABLE_AUTH_HANDOFF.md`.

## 3) Validation SQL (post-migration)

```sql
-- Columns exist
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'loan_products'
  and column_name in (
    'home_verification_required',
    'late_fee_fixed_amount',
    'pricing_tiers',
    'repayment_anchor_rule',
    'physical_collateral_collection'
  )
order by column_name;

-- Product codes present
select product_code, name, is_active, status
from public.loan_products
where product_code in (
  'SALARY_ADVANCE',
  'PAYDAY_SOFT',
  'COLLATERAL',
  'BUSINESS',
  'MOTOR_VEHICLE',
  'MARKETEER'
)
order by product_code;

-- Marketeer pricing tiers + late fee
select
  product_code,
  late_fee_fixed_amount,
  pricing_tiers
from public.loan_products
where product_code = 'MARKETEER';

-- Product access mappings exist
select product_code, count(*) as assigned_users
from public.user_product_access
where is_active = true
group by product_code
order by product_code;

-- House permissions seeded
select module, action
from public.permissions
where module = 'house'
order by action;

-- Product report view returns rows
select *
from public.v_house_report_summary
order by product_code;

-- House workflow RPCs available
select proname
from pg_proc
where proname in (
  'house_stage_review',
  'house_set_loan_status',
  'house_mark_disbursement_completed',
  'house_mark_repayment_paid'
)
order by proname;

-- Marketeer fixed defaults (30% over 26 days, Sundays excluded)
select
  product_code,
  interest_rate,
  term_unit,
  repayment_anchor_rule,
  pricing_tiers
from public.loan_products
where product_code = 'MARKETEER';
```

## 4) Rollback guidance

- This migration is data + schema coupled and should be rolled back with a dedicated reverse migration, not ad-hoc deletes.
- If rollback is required, create a new migration to:
  - revert inserted rows by `product_code`
  - restore prior values for updated rows
  - optionally drop newly added columns only if no code depends on them.
