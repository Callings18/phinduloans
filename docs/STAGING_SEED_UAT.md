# Staging seed data for UAT (launch matrix)

This guide supports manual completion of [LAUNCH_MATRIX_UAT.md](./LAUNCH_MATRIX_UAT.md). **Schema changes** belong in `supabase/migrations/`; this doc describes **minimum data** to create (via SQL Editor, scripts, or CSV import) so testers are never blocked by an empty database.

## Principles

1. **One borrower user** (non-staff): sign-up through `/auth` or insert `auth.users` + `profiles` per your Supabase process.
2. **Two staff personas** (minimum): finance (`finance_officer` or equivalent with disbursements/repayments) and a **house** user with `house:*` permissions for at least one `loan_products.product_code`.
3. **Per house you launch**: tie sample rows to `loan_product_id` / `product_code` so `/admin/houses/:productCode` shows real KPIs and lists.

## Minimum entities (checklist)

Use this as a row-by-row checklist; adjust column names to match your live schema.

| Goal | Tables / notes |
|------|------------------|
| Active loan products | `loan_products` with `product_code`, `is_active = true` |
| Sample applications | `loan_applications` across statuses: `pending`, `approved`, `active`, `completed` as applicable |
| Active / disbursed loans | Rows linked to `loan_product_id`; `disbursed_at` set where needed for charts |
| Repayments | `loan_repayments` with mix of `pending` (future due), `pending` (overdue), `paid` |
| Payment claims (if in scope) | `payment_claims` with `pending_review` for staff queues |
| Disbursements | `disbursements` with `pending` / `completed` / `failed` for ops dashboards |
| KYC / vault | `borrower_document_vault` rows with `is_verified = false` for stale queues (optional) |
| House permissions | `user_roles` / `role_permissions` aligned with `get_my_permissions` for house routes |

## House-specific repeat

For **each** `product_code` in scope:

- At least **one** application and **one** loan in a “live” state for that product.
- Staff user can open `/admin/houses/<productCode>` without empty charts everywhere (seed amounts/dates in last 6 months if you test trends).

## Automation env (Playwright)

See [PHASE1_SMOKE_TESTS.md](./PHASE1_SMOKE_TESTS.md). After seeding:

- `E2E_BORROWER_*` — non-staff borrower.
- `E2E_FINANCE_*` — can reach `/admin/disbursements`, `/admin/repayments`, `/admin/reports`, `/admin/houses`.
- `E2E_HOUSE_PRODUCT_CODE` — must exist in `loan_products.product_code`; finance user needs `house:dashboard_view` for that product.
- `E2E_SEEDED_EXPENSE_VENDOR` — must match a **pending** row’s `vendor_payee` (seed with [smoke-seed-expense.sql](./smoke-seed-expense.sql) or your own insert).

## Data migrations

- **New tables/columns/policies:** add a file under `supabase/migrations/` and deploy with your usual process.
- **Seed content only:** not a migration; run SQL once per environment or add a **separate** seed script the team agrees to (this repo does not ship a canonical `seed.sql` yet—add one if you want repeatable staging resets).

**Related:** [MIGRATIONS_FOR_DEPLOY.md](./MIGRATIONS_FOR_DEPLOY.md) · [RLS_UI_MATRIX.md](./RLS_UI_MATRIX.md)
