# Loan house — SQL apply checklist (staging → production)

Use this when moving to the next audit phase. Open each file in **Supabase SQL Editor**, paste the full contents, run once, then check the box.

**Skip** any migration already applied in your project (check `supabase_migrations.schema_migrations` or Lovable history).

---

## June 2026 (required for current `main`)

Apply in this order:

| Step | Apply | File in repo |
|:----:|:-----:|--------------|
| 1 | [ ] | `supabase/migrations/20260603185037_443ee6b5-5131-4ee1-9b54-a4a7e1a48593.sql` |
| 2 | [ ] | `supabase/migrations/20260603204500_collateral_term_1_12_everywhere.sql` |
| 3 | [ ] | `supabase/migrations/20260603213000_collateral_partial_payment_repair.sql` |
| 4 | [ ] | `supabase/migrations/20260604100000_reconcile_fully_paid_loan_statuses.sql` |
| 5 | [ ] | `supabase/migrations/20260604130000_collateral_per_loan_interest_catalog.sql` |

**Do not apply** `20260604101141_e278dd20-….sql` — duplicate of step 4 (removed from repo).

### After step 1

```sql
SELECT product_code, min_term_months, max_term_months
FROM public.loan_products WHERE product_code = 'COLLATERAL';
-- Expect: 1, 12
```

### After steps 2–3 (data repair)

Spot-check one collateral loan with payments and one without; pending installment amounts should match remaining balance.

### After step 4 (fully paid → completed)

```sql
-- Should return 0 rows when repair worked
SELECT la.id, la.full_name, lp.product_code, la.status, la.total_repayment
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE la.status::text IN ('active', 'disbursed')
  AND NOT EXISTS (
    SELECT 1 FROM public.loan_repayments lr
    WHERE lr.loan_id = la.id
      AND lr.status IN ('pending','overdue','partial')
      AND COALESCE(lr.is_reversed, false) = false
  )
  AND (
    SELECT COALESCE(SUM(COALESCE(lr.principal_paid,
      CASE WHEN lr.status = 'paid' THEN lr.amount ELSE 0 END)), 0)
    FROM public.loan_repayments lr
    WHERE lr.loan_id = la.id AND COALESCE(lr.is_reversed, false) = false
  ) >= la.total_repayment - 0.01;
```

**Single loan still blocking new application?** In admin loan details use **Mark completed**, or:

```sql
SELECT public.admin_reconcile_loan_completion('<loan_application_uuid>'::uuid);
```

### After step 5

```sql
SELECT product_code, interest_period FROM public.loan_products WHERE product_code = 'COLLATERAL';
-- Expect: per_loan
```

---

## House platform pack (only if houses/RLS not working yet)

If product houses or `house.*` permissions fail, apply the full pack in [`LOVABLE_MIGRATION_PACK.md`](./LOVABLE_MIGRATION_PACK.md) **before** June 2026 steps above.

---

## Full catalog + access (all seven houses)

```sql
SELECT product_code, name, is_active, interest_period, min_term_months, max_term_months, term_unit
FROM public.loan_products
WHERE product_code IS NOT NULL
ORDER BY product_code;

SELECT product_code, count(*) AS users_with_access
FROM public.user_product_access
WHERE is_active = true
GROUP BY product_code
ORDER BY product_code;
```

---

## Next after SQL

1. Deploy latest `main` to staging.
2. Run health SQL: [`LOAN_HOUSE_HEALTH_SQL.md`](./LOAN_HOUSE_HEALTH_SQL.md).
3. Golden path UAT: [`LOAN_HOUSE_UAT_RUNBOOK.md`](./LOAN_HOUSE_UAT_RUNBOOK.md).
4. Sign off: [`LOAN_HOUSE_AUDIT_MATRIX.md`](./LOAN_HOUSE_AUDIT_MATRIX.md).

**Operator / date:** _______________________ **Environment:** staging / production
