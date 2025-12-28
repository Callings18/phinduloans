-- Add enforcement/legal fee and penalty frequency to loan_products
ALTER TABLE public.loan_products 
ADD COLUMN IF NOT EXISTS enforcement_fee_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalty_frequency text DEFAULT 'monthly' CHECK (penalty_frequency IN ('daily', 'weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS interest_period text DEFAULT 'monthly' CHECK (interest_period IN ('daily', 'weekly', 'monthly', 'yearly'));

-- Add application source tag to loan_applications
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'website' CHECK (source IN ('website', 'internal', 'referral'));

-- Add blacklist flag to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_blacklisted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blacklist_reason text,
ADD COLUMN IF NOT EXISTS blacklisted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS blacklisted_by uuid;

-- Update comments
COMMENT ON COLUMN public.loan_products.enforcement_fee_percent IS 'Legal/enforcement fee percentage deducted before disbursement';
COMMENT ON COLUMN public.loan_products.penalty_frequency IS 'How often late penalty is applied: daily, weekly, or monthly';
COMMENT ON COLUMN public.loan_products.interest_period IS 'Period for interest rate: daily, weekly, monthly, yearly';
COMMENT ON COLUMN public.loan_applications.source IS 'Where the application originated from: website, internal, or referral';
COMMENT ON COLUMN public.profiles.is_blacklisted IS 'Whether borrower is blacklisted from future loans';