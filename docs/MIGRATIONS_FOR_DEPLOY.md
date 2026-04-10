# SQL migrations to apply (this push)

Apply these **in timestamp order** on your Supabase/Postgres environment (CLI: `supabase db push`, or SQL Editor in dashboard).

## New migration files in this changeset

| Order | File | Purpose |
|------:|------|---------|
| 1 | [`supabase/migrations/20260406091500_phase1_workflow_backbone.sql`](../supabase/migrations/20260406091500_phase1_workflow_backbone.sql) | Phase 1 workflow: `loan_status_transitions`, timeline/payment-claim fields, RLS. |
| 2 | [`supabase/migrations/20260408120000_admin_expense_status_rpc.sql`](../supabase/migrations/20260408120000_admin_expense_status_rpc.sql) | `admin_set_expense_status` RPC (approve/reject/paid + ledger). |
| 3 | [`supabase/migrations/20260408121000_admin_writeoff_rpcs.sql`](../supabase/migrations/20260408121000_admin_writeoff_rpcs.sql) | Write-off RPCs: approve, reject, record recovery. |
| 4 | [`supabase/migrations/20260408122000_admin_mark_loan_defaulted.sql`](../supabase/migrations/20260408122000_admin_mark_loan_defaulted.sql) | `admin_mark_loan_defaulted` RPC. |
| 5 | [`supabase/migrations/20260408123000_crb_requests_rls_tighten.sql`](../supabase/migrations/20260408123000_crb_requests_rls_tighten.sql) | Tighten `crb_requests` RLS to RBAC. |
| 6 | [`supabase/migrations/20260408124000_reports_query_indexes.sql`](../supabase/migrations/20260408124000_reports_query_indexes.sql) | Indexes for admin report date/filter queries. |

## Web Push (no new table migration)

Browser push subscriptions use the existing **`push_subscriptions`** table from  
[`supabase/migrations/20260108171013_68fb6947-6cc4-4eb3-8e58-7d2d0511db79.sql`](../supabase/migrations/20260108171013_68fb6947-6cc4-4eb3-8e58-7d2d0511db79.sql) (`p256dh_key`, `auth_key`, `endpoint`).  
Deploy the **`send-web-push`** Edge Function and set VAPID secrets (see [`supabase/functions/send-web-push/README.md`](../supabase/functions/send-web-push/README.md)).

## Optional: single concatenated script

To paste once in SQL Editor (review for duplicates if some objects already exist):

```bash
# Unix-like shell
cat supabase/migrations/20260406091500_phase1_workflow_backbone.sql \
    supabase/migrations/20260408120000_admin_expense_status_rpc.sql \
    supabase/migrations/20260408121000_admin_writeoff_rpcs.sql \
    supabase/migrations/20260408122000_admin_mark_loan_defaulted.sql \
    supabase/migrations/20260408123000_crb_requests_rls_tighten.sql \
    supabase/migrations/20260408124000_reports_query_indexes.sql \
  > /tmp/phindu_batch_migrations.sql
```

On Windows PowerShell:

```powershell
Get-Content `
  supabase/migrations/20260406091500_phase1_workflow_backbone.sql,
  supabase/migrations/20260408120000_admin_expense_status_rpc.sql,
  supabase/migrations/20260408121000_admin_writeoff_rpcs.sql,
  supabase/migrations/20260408122000_admin_mark_loan_defaulted.sql,
  supabase/migrations/20260408123000_crb_requests_rls_tighten.sql,
  supabase/migrations/20260408124000_reports_query_indexes.sql |
  Set-Content -Encoding utf8 .\docs\_batch_migrations_concat.sql
```
