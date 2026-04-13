-- Phindu loan product extensions + stable product_code catalog (six flagship products).

ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS home_verification_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS late_fee_fixed_amount numeric;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS pricing_tiers jsonb;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS repayment_anchor_rule text;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS physical_collateral_collection boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.loan_products.pricing_tiers IS 'Tiered bands, e.g. Marketeer: [{"minPrincipal":1000,"maxPrincipal":5000,"interestPercent":30,"durationDays":10},...]';
COMMENT ON COLUMN public.loan_products.repayment_anchor_rule IS 'Calendar rule, e.g. payday_dom_23 for salary-linked due dates';
COMMENT ON COLUMN public.loan_products.physical_collateral_collection IS 'When true, collateral is collected physically before disbursement';

-- 1) Salary Advance (civil servants, due 23rd)
UPDATE public.loan_products
SET
  product_code = 'SALARY_ADVANCE',
  repayment_anchor_rule = 'payday_dom_23',
  employer_whitelist_enabled = true,
  employment_types = ARRAY['employed']::text[],
  home_verification_required = false,
  physical_collateral_collection = false,
  repayment_frequency = COALESCE(repayment_frequency, 'monthly'),
  eligible_locations = NULL,
  description = COALESCE(NULLIF(trim(description), ''), 'Civil servants only. No collateral. Due on the 23rd of each month (payday). Countrywide.')
WHERE name = 'Salary Advance Loan';

-- 2) Business Loan
UPDATE public.loan_products
SET
  product_code = 'BUSINESS',
  collateral_required = true,
  physical_collateral_collection = false,
  home_verification_required = false,
  required_documents = '[
    {"document_type": "nrc_front", "document_name": "NRC Front", "is_mandatory": true, "display_order": 1},
    {"document_type": "nrc_back", "document_name": "NRC Back", "is_mandatory": true, "display_order": 2},
    {"document_type": "selfie_holding_nrc", "document_name": "Selfie Holding NRC", "is_mandatory": true, "display_order": 3},
    {"document_type": "financial_statement", "document_name": "Financial Statement (year-end)", "is_mandatory": true, "display_order": 4},
    {"document_type": "pacra_certificate", "document_name": "PACRA Certificate", "is_mandatory": true, "display_order": 5},
    {"document_type": "tax_clearance", "document_name": "Tax Clearance", "is_mandatory": true, "display_order": 6},
    {"document_type": "proof_of_business", "document_name": "Proof of Business Location", "is_mandatory": true, "display_order": 7}
  ]'::jsonb
WHERE name = 'Business Loan';

-- 3) Collateral-based
UPDATE public.loan_products
SET
  product_code = 'COLLATERAL',
  collateral_required = true,
  physical_collateral_collection = true,
  home_verification_required = false
WHERE name = 'Collateral Based Loan';

-- 4) Payday Soft — insert if missing
INSERT INTO public.loan_products (
  name, description, product_code, min_amount, max_amount, min_term_months, max_term_months,
  term_unit, interest_rate, interest_type, interest_period, processing_fee_percent, enforcement_fee_percent,
  penalty_frequency, is_active, status, requirements, employment_types, grace_period_days,
  late_payment_penalty_percent, insurance_required, insurance_percent, collateral_required,
  repayment_frequency, eligible_locations, home_verification_required, physical_collateral_collection,
  repayment_methods, channels
)
SELECT
  'Payday Soft Loan',
  'Non-civil servants resident in Lusaka. 30-day term. Home verification required. Collateral declared in contract; not collected unless default.',
  'PAYDAY_SOFT',
  500,
  25000,
  30,
  30,
  'days',
  18,
  'flat',
  'monthly',
  2,
  10,
  'monthly',
  true,
  'active',
  ARRAY['NRC', 'Proof of employment / latest payslip', 'Proof of residence', 'Sketch map to residence', 'Selfie holding NRC'],
  ARRAY['employed', 'contract', 'self_employed']::text[],
  0,
  5,
  false,
  0,
  true,
  'monthly',
  ARRAY['Lusaka']::text[],
  true,
  false,
  ARRAY['bank_transfer', 'mobile_money']::text[],
  ARRAY['website', 'admin']::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.loan_products WHERE product_code = 'PAYDAY_SOFT');

-- 5) Motor vehicle — insert if missing
INSERT INTO public.loan_products (
  name, description, product_code, min_amount, max_amount, min_term_months, max_term_months,
  term_unit, interest_rate, interest_type, interest_period, processing_fee_percent, enforcement_fee_percent,
  penalty_frequency, is_active, status, requirements, employment_types, grace_period_days,
  late_payment_penalty_percent, insurance_required, insurance_percent, collateral_required,
  repayment_frequency, home_verification_required, physical_collateral_collection,
  repayment_methods, channels, required_documents
)
SELECT
  'Motor Vehicle Loan',
  'Vehicle title held by lender until full repayment. Comprehensive insurance required. Term 3–24 months.',
  'MOTOR_VEHICLE',
  5000,
  500000,
  3,
  24,
  'months',
  15,
  'reducing_balance',
  'monthly',
  2,
  10,
  'monthly',
  true,
  'active',
  ARRAY['NRC', '3 months payslip', '3 months bank statements', 'Selfie holding NRC', 'Vehicle photos']::text[],
  ARRAY['employed', 'self_employed']::text[],
  3,
  5,
  true,
  2.5,
  true,
  'monthly',
  false,
  false,
  ARRAY['bank_transfer', 'mobile_money']::text[],
  ARRAY['website', 'admin']::text[],
  '[
    {"document_type": "nrc_front", "document_name": "NRC Front", "is_mandatory": true, "display_order": 1},
    {"document_type": "nrc_back", "document_name": "NRC Back", "is_mandatory": true, "display_order": 2},
    {"document_type": "selfie_holding_nrc", "document_name": "Selfie Holding NRC", "is_mandatory": true, "display_order": 3},
    {"document_type": "payslip_1", "document_name": "Payslip (latest)", "is_mandatory": true, "display_order": 4},
    {"document_type": "payslip_2", "document_name": "Payslip month 2", "is_mandatory": true, "display_order": 5},
    {"document_type": "payslip_3", "document_name": "Payslip month 3", "is_mandatory": true, "display_order": 6},
    {"document_type": "bank_statement_1", "document_name": "Bank statement month 1", "is_mandatory": true, "display_order": 7},
    {"document_type": "bank_statement_2", "document_name": "Bank statement month 2", "is_mandatory": true, "display_order": 8},
    {"document_type": "bank_statement_3", "document_name": "Bank statement month 3", "is_mandatory": true, "display_order": 9},
    {"document_type": "vehicle_photos", "document_name": "Pictures of the vehicle", "is_mandatory": true, "display_order": 10}
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.loan_products WHERE product_code = 'MOTOR_VEHICLE');

-- 6) Marketeer — tiered daily product
INSERT INTO public.loan_products (
  name, description, product_code, min_amount, max_amount, min_term_months, max_term_months,
  term_unit, interest_rate, interest_type, interest_period, processing_fee_percent, enforcement_fee_percent,
  penalty_frequency, is_active, status, requirements, employment_types, grace_period_days,
  late_payment_penalty_percent, insurance_required, insurance_percent, collateral_required,
  repayment_frequency, home_verification_required, physical_collateral_collection,
  late_fee_fixed_amount, pricing_tiers, repayment_methods, channels, required_documents
)
SELECT
  'Marketeer Loan',
  'Daily repayment tiers: K1,000–K5,000 at 30%/10 days; K5,001–K10,000 at 20%/15 days. K30 late charge per missed day (see ops policy).',
  'MARKETEER',
  1000,
  10000,
  10,
  15,
  'days',
  0,
  'flat',
  'daily',
  0,
  0,
  'daily',
  true,
  'active',
  ARRAY['NRC', 'Selfie holding NRC', 'Video of business with stock', 'Video of residence', 'Video signing contract', 'Sketch map to location']::text[],
  ARRAY['self_employed']::text[],
  0,
  0,
  false,
  0,
  false,
  'daily',
  false,
  false,
  30,
  '[
    {"minPrincipal": 1000, "maxPrincipal": 5000, "interestPercent": 30, "durationDays": 10},
    {"minPrincipal": 5001, "maxPrincipal": 10000, "interestPercent": 20, "durationDays": 15}
  ]'::jsonb,
  ARRAY['mobile_money', 'bank_transfer']::text[],
  ARRAY['website', 'admin']::text[],
  '[
    {"document_type": "nrc_front", "document_name": "NRC Front", "is_mandatory": true, "display_order": 1},
    {"document_type": "nrc_back", "document_name": "NRC Back", "is_mandatory": true, "display_order": 2},
    {"document_type": "selfie_holding_nrc", "document_name": "Selfie Holding NRC", "is_mandatory": true, "display_order": 3},
    {"document_type": "video_business_stock", "document_name": "Video of business with stock", "is_mandatory": true, "display_order": 4},
    {"document_type": "video_residence", "document_name": "Video of residence", "is_mandatory": true, "display_order": 5},
    {"document_type": "video_contract_signing", "document_name": "Video signing contract", "is_mandatory": true, "display_order": 6},
    {"document_type": "sketch_map_residence", "document_name": "Sketch map to location", "is_mandatory": true, "display_order": 7}
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.loan_products WHERE product_code = 'MARKETEER');
