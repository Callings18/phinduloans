-- Normalize Marketeer product to fixed Phindu terms.
-- Business rule: 30% flat interest, 26 collection days, Sundays excluded.

UPDATE public.loan_products
SET
  interest_rate = 30,
  interest_period = 'monthly',
  interest_type = 'flat',
  term_unit = 'days',
  pricing_tiers = jsonb_build_array(
    jsonb_build_object(
      'minPrincipal', 1000,
      'maxPrincipal', 1000000000,
      'interestPercent', 30,
      'durationDays', 26
    )
  ),
  repayment_anchor_rule = 'daily_excluding_sunday',
  updated_at = now()
WHERE product_code = 'MARKETEER';
