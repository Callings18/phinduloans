-- Optional staging seed: one pending expense for Playwright deterministic smoke.
-- After running, set env: E2E_SEEDED_EXPENSE_VENDOR=PHINDU_SEED_EXPENSE_UAT
-- (must match vendor_payee exactly.)
--
-- Not a schema migration: run in Supabase SQL Editor on staging when needed.

begin;

insert into public.accounts (account_name, account_type, balance, currency, is_active)
select 'UAT Operating Account', 'bank', 1000000::numeric, 'ZMW', true
where not exists (
  select 1 from public.accounts a
  where a.account_name = 'UAT Operating Account' and a.is_active = true
);

with acc as (
  select id
  from public.accounts
  where account_name = 'UAT Operating Account' and is_active = true
  order by created_at asc
  limit 1
)
insert into public.expenses (
  expense_date,
  expense_category,
  amount,
  vendor_payee,
  description,
  loan_id,
  branch,
  payment_method,
  account_id,
  attachment_url,
  status,
  approved_by,
  approved_at,
  paid_at
)
select
  current_date,
  'overhead',
  1.00::numeric,
  'PHINDU_SEED_EXPENSE_UAT',
  'Seeded pending expense for automated smoke tests (safe to delete after runs).',
  null,
  'head_office',
  'bank_transfer',
  acc.id,
  null,
  'pending',
  null,
  null,
  null
from acc
where not exists (
  select 1 from public.expenses e where e.vendor_payee = 'PHINDU_SEED_EXPENSE_UAT'
);

commit;
