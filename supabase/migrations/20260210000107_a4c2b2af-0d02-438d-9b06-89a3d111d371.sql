
-- Borrower payment claims table
create table if not exists public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loan_applications(id) on delete cascade,
  repayment_id uuid not null references public.loan_repayments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  reference text not null,
  receipt_url text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references auth.users(id)
);

create index if not exists idx_payment_claims_loan_id on public.payment_claims(loan_id);
create index if not exists idx_payment_claims_repayment_id on public.payment_claims(repayment_id);
create index if not exists idx_payment_claims_status on public.payment_claims(status);

alter table public.payment_claims enable row level security;

DROP POLICY IF EXISTS "Borrowers can insert own payment claims" ON public.payment_claims;
create policy "Borrowers can insert own payment claims"
  on public.payment_claims for insert
  with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Borrowers can read own payment claims" ON public.payment_claims;
create policy "Borrowers can read own payment claims"
  on public.payment_claims for select
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can read all payment claims" ON public.payment_claims;
create policy "Staff can read all payment claims"
  on public.payment_claims for select
  using (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'loan_officer'::app_role)
    or public.has_role(auth.uid(), 'finance_officer'::app_role)
    or public.has_role(auth.uid(), 'collections_officer'::app_role)
  );

DROP POLICY IF EXISTS "Staff can update payment claims" ON public.payment_claims;
create policy "Staff can update payment claims"
  on public.payment_claims for update
  using (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'loan_officer'::app_role)
    or public.has_role(auth.uid(), 'finance_officer'::app_role)
    or public.has_role(auth.uid(), 'collections_officer'::app_role)
  );

comment on table public.payment_claims is 'Borrower-reported payments (reference + optional receipt) for admin verification before recording in loan_repayments.';

-- Add permissions for repayments, collections, writeoffs, court
INSERT INTO public.permissions (module, action, description) VALUES
  ('repayments', 'view', 'View repayment records'),
  ('repayments', 'record', 'Record and verify payments'),
  ('collections', 'view', 'View collections and overdue loans'),
  ('collections', 'manage', 'Manage collection activities and demand letters'),
  ('writeoffs', 'view', 'View write-off requests'),
  ('writeoffs', 'manage', 'Approve, reject, and manage write-offs'),
  ('court', 'view', 'View court cases'),
  ('court', 'manage', 'Create and manage court cases')
ON CONFLICT (module, action) DO NOTHING;

-- super_admin and admin: all new permissions
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id FROM public.roles r JOIN public.permissions p
ON (p.module IN ('repayments', 'collections', 'writeoffs', 'court') AND p.action IN ('view', 'manage', 'record'))
WHERE r.name IN ('super_admin', 'admin')
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- finance_officer and collections_officer: repayments view + record
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'repayments' AND p.action IN ('view', 'record'))
WHERE r.name IN ('finance_officer', 'collections_officer')
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- collections_officer: collections view + manage
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'collections' AND p.action IN ('view', 'manage'))
WHERE r.name = 'collections_officer'
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- loan_officer: repayments view + record
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'repayments' AND p.action IN ('view', 'record'))
WHERE r.name = 'loan_officer'
ON CONFLICT (role_name, permission_id) DO NOTHING;
