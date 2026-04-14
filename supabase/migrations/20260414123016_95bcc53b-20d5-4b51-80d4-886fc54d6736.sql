
ALTER TABLE public.loan_products
  ADD COLUMN IF NOT EXISTS repayment_frequency text,
  ADD COLUMN IF NOT EXISTS interest_period text,
  ADD COLUMN IF NOT EXISTS pricing_tiers jsonb,
  ADD COLUMN IF NOT EXISTS home_verification_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_fee_fixed_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repayment_anchor_rule text,
  ADD COLUMN IF NOT EXISTS physical_collateral_collection boolean DEFAULT false;
