# Lovable Migration Pack (Main Branch)

Use this document whenever code is pushed to `main` and Lovable needs DB changes.

## 1) Execution order

Run these migrations in timestamp order:

1. `supabase/migrations/20260413130000_loan_products_extensions_and_phindu_catalog.sql`

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
```

## 4) Rollback guidance

- This migration is data + schema coupled and should be rolled back with a dedicated reverse migration, not ad-hoc deletes.
- If rollback is required, create a new migration to:
  - revert inserted rows by `product_code`
  - restore prior values for updated rows
  - optionally drop newly added columns only if no code depends on them.
