-- Phase 1: Fix RLS Policies for loan_products
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view active loan products" ON loan_products;
DROP POLICY IF EXISTS "Admins can update loan products" ON loan_products;
DROP POLICY IF EXISTS "Admins can delete loan products" ON loan_products;
DROP POLICY IF EXISTS "Admins can insert loan products" ON loan_products;

-- Create corrected SELECT policy - admins see all, public sees active only
CREATE POLICY "View loan products" ON loan_products
FOR SELECT USING (
  is_active = true 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Create corrected INSERT policy
CREATE POLICY "Admins can insert loan products" ON loan_products
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Create corrected UPDATE policy with WITH CHECK clause
CREATE POLICY "Admins can update loan products" ON loan_products
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
) WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Create corrected DELETE policy
CREATE POLICY "Admins can delete loan products" ON loan_products
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Phase 2: Add new columns for comprehensive loan product configuration

-- Basic Info columns
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY['website', 'admin'];
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'; -- active, inactive, archived

-- Eligibility Rules columns
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS min_age INTEGER DEFAULT 18;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS max_age INTEGER DEFAULT 65;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS min_salary NUMERIC DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS max_salary_percent NUMERIC DEFAULT 50;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS max_concurrent_loans INTEGER DEFAULT 1;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS blacklist_check_required BOOLEAN DEFAULT true;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS mou_required BOOLEAN DEFAULT false;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS employer_whitelist_enabled BOOLEAN DEFAULT false;

-- Amount Logic columns
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS amount_logic TEXT DEFAULT 'fixed'; -- fixed, salary_based, vendor_based

-- Additional Fees columns
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS vat_percent NUMERIC DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS platform_fee_type TEXT DEFAULT 'percentage'; -- fixed, percentage

-- Repayment Rules columns
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS repayment_frequency TEXT DEFAULT 'monthly'; -- daily, weekly, monthly
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS repayment_methods TEXT[] DEFAULT ARRAY['bank_transfer', 'mobile_money', 'payroll_deduction'];
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS installment_structure TEXT DEFAULT 'equal'; -- equal, balloon

-- Disbursement Rules columns  
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS auto_disbursement BOOLEAN DEFAULT false;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS partial_disbursement BOOLEAN DEFAULT false;

-- Default & Legal columns
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS default_threshold_days INTEGER DEFAULT 90;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS legal_escalation_days INTEGER DEFAULT 120;

-- Documents & Contracts columns
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS contract_template_url TEXT;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS digital_signature_required BOOLEAN DEFAULT false;

-- Versioning columns
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES loan_products(id);
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add unique constraint for product_code (if not null)
CREATE UNIQUE INDEX IF NOT EXISTS loan_products_product_code_unique ON loan_products(product_code) WHERE product_code IS NOT NULL;