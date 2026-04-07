-- PHINDU LOANS - ALL SQL MIGRATIONS (paste into Lovable / Supabase SQL Editor)
-- Run in order. Some migrations may conflict if DB already has objects; adjust or skip as needed.


-- ========== 20251220150928_836f93ae-56b3-4efc-ae04-556bee0ea696.sql ==========

-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'employer');

-- Create loan status enum
CREATE TYPE public.loan_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'disbursed', 'active', 'completed', 'defaulted');

-- Create employment type enum
CREATE TYPE public.employment_type AS ENUM ('employed', 'self_employed', 'contract', 'other');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  nrc_number TEXT,
  address TEXT,
  city TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create employers table
CREATE TABLE public.employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  contact_person TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create loan_applications table
CREATE TABLE public.loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES public.employers(id),
  
  -- Personal info
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  nrc_number TEXT NOT NULL,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  
  -- Employment info
  employment_type employment_type NOT NULL,
  employer_name TEXT,
  job_title TEXT,
  monthly_income DECIMAL(12,2) NOT NULL,
  employment_duration TEXT,
  
  -- Loan details
  loan_amount DECIMAL(12,2) NOT NULL,
  loan_purpose TEXT NOT NULL,
  loan_term_months INTEGER NOT NULL,
  interest_rate DECIMAL(5,2) DEFAULT 15.00,
  monthly_payment DECIMAL(12,2),
  total_repayment DECIMAL(12,2),
  
  -- Status
  status loan_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Documents
  nrc_front_url TEXT,
  nrc_back_url TEXT,
  payslip_url TEXT,
  selfie_url TEXT,
  employer_letter_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create loan_repayments table
CREATE TABLE public.loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_method TEXT,
  transaction_reference TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create disbursements table
CREATE TABLE public.disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  disbursement_method TEXT NOT NULL,
  account_number TEXT,
  mobile_money_number TEXT,
  transaction_reference TEXT,
  status TEXT DEFAULT 'pending',
  disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Employers policies
CREATE POLICY "Anyone can view verified employers"
  ON public.employers FOR SELECT
  USING (is_verified = true);

CREATE POLICY "Admins can manage employers"
  ON public.employers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Loan applications policies
CREATE POLICY "Users can view their own applications"
  ON public.loan_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create applications"
  ON public.loan_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending applications"
  ON public.loan_applications FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all applications"
  ON public.loan_applications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all applications"
  ON public.loan_applications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Loan repayments policies
CREATE POLICY "Users can view their own repayments"
  ON public.loan_repayments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage repayments"
  ON public.loan_repayments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Disbursements policies
CREATE POLICY "Users can view their loan disbursements"
  ON public.disbursements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications la 
    WHERE la.id = loan_id AND la.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage disbursements"
  ON public.disbursements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_applications_updated_at
  BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_repayments_updated_at
  BEFORE UPDATE ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employers_updated_at
  BEFORE UPDATE ON public.employers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== 20251220152035_a5e88813-725e-4fc7-887c-c58f82da2462.sql ==========

-- Fix RLS policies - change RESTRICTIVE to PERMISSIVE

-- Drop existing policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

DROP POLICY IF EXISTS "Anyone can view verified employers" ON public.employers;
DROP POLICY IF EXISTS "Admins can manage employers" ON public.employers;

DROP POLICY IF EXISTS "Users can view their own applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Users can create applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Users can update their pending applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Admins can update all applications" ON public.loan_applications;

DROP POLICY IF EXISTS "Users can view their own repayments" ON public.loan_repayments;
DROP POLICY IF EXISTS "Admins can manage repayments" ON public.loan_repayments;

DROP POLICY IF EXISTS "Users can view their loan disbursements" ON public.disbursements;
DROP POLICY IF EXISTS "Admins can manage disbursements" ON public.disbursements;

-- Recreate profiles policies as PERMISSIVE
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Recreate user_roles policies as PERMISSIVE
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Recreate employers policies as PERMISSIVE
CREATE POLICY "Anyone can view verified employers"
  ON public.employers FOR SELECT
  USING (is_verified = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert employers"
  ON public.employers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update employers"
  ON public.employers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete employers"
  ON public.employers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Recreate loan_applications policies as PERMISSIVE
CREATE POLICY "Users can view their own applications"
  ON public.loan_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create applications"
  ON public.loan_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending applications"
  ON public.loan_applications FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id AND status = 'pending') OR public.has_role(auth.uid(), 'admin'));

-- Recreate loan_repayments policies as PERMISSIVE
CREATE POLICY "Users can view their own repayments"
  ON public.loan_repayments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert repayments"
  ON public.loan_repayments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update repayments"
  ON public.loan_repayments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete repayments"
  ON public.loan_repayments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Recreate disbursements policies as PERMISSIVE
CREATE POLICY "Users can view their loan disbursements"
  ON public.disbursements FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications la 
    WHERE la.id = loan_id AND la.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert disbursements"
  ON public.disbursements FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update disbursements"
  ON public.disbursements FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete disbursements"
  ON public.disbursements FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ========== 20251220153807_b889731f-36a5-4b5e-8e8e-0315c2442c14.sql ==========

-- Create settings table for storing payment gateway configuration
CREATE TABLE public.payment_gateway_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway_name TEXT NOT NULL UNIQUE,
  api_key TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT false,
  environment TEXT DEFAULT 'sandbox',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can access payment settings
CREATE POLICY "Admins can view payment settings"
  ON public.payment_gateway_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert payment settings"
  ON public.payment_gateway_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payment settings"
  ON public.payment_gateway_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payment settings"
  ON public.payment_gateway_settings
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_payment_gateway_settings_updated_at
  BEFORE UPDATE ON public.payment_gateway_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default LENCO entry
INSERT INTO public.payment_gateway_settings (gateway_name, environment)
VALUES ('lenco', 'sandbox');

-- ========== 20251221165218_6129b5da-98bd-4f26-859d-04f6acfbda31.sql ==========

-- Create loan_products table
CREATE TABLE public.loan_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  min_amount numeric NOT NULL DEFAULT 500,
  max_amount numeric NOT NULL DEFAULT 50000,
  min_term_months integer NOT NULL DEFAULT 1,
  max_term_months integer NOT NULL DEFAULT 24,
  interest_rate numeric NOT NULL DEFAULT 15.00,
  processing_fee_percent numeric DEFAULT 2.00,
  is_active boolean DEFAULT true,
  employment_types text[] DEFAULT ARRAY['employed', 'self_employed', 'contract'],
  requirements text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;

-- Everyone can view active loan products
CREATE POLICY "Anyone can view active loan products"
ON public.loan_products
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage loan products
CREATE POLICY "Admins can insert loan products"
ON public.loan_products
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update loan products"
ON public.loan_products
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete loan products"
ON public.loan_products
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add loan_product_id to loan_applications
ALTER TABLE public.loan_applications 
ADD COLUMN loan_product_id uuid REFERENCES public.loan_products(id);

-- Create trigger for updated_at
CREATE TRIGGER update_loan_products_updated_at
BEFORE UPDATE ON public.loan_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default loan products
INSERT INTO public.loan_products (name, description, min_amount, max_amount, min_term_months, max_term_months, interest_rate, processing_fee_percent, requirements) VALUES
('Personal Loan', 'Quick personal loans for your immediate needs', 500, 20000, 1, 12, 15.00, 2.00, ARRAY['Valid NRC', 'Proof of income', 'Bank statement']),
('Salary Advance', 'Get an advance on your upcoming salary', 200, 5000, 1, 3, 10.00, 1.50, ARRAY['Valid NRC', 'Employment letter', 'Recent payslip']),
('Business Loan', 'Grow your business with flexible financing', 5000, 100000, 6, 36, 18.00, 3.00, ARRAY['Valid NRC', 'Business registration', 'Financial statements', 'Business plan']),
('Emergency Loan', 'Fast emergency funding when you need it most', 100, 3000, 1, 6, 12.00, 1.00, ARRAY['Valid NRC', 'Proof of income']);

-- ========== 20251222202105_a532f447-4014-4582-82aa-f888c4d2eda2.sql ==========

-- Update RLS policy to allow anyone to view active loan products (truly public)
DROP POLICY IF EXISTS "Anyone can view active loan products" ON public.loan_products;

CREATE POLICY "Anyone can view active loan products" 
ON public.loan_products 
FOR SELECT 
USING (is_active = true);

-- ========== 20251222203242_aa899278-2162-4ede-827f-12de8581a665.sql ==========

-- Add installment_number column to loan_repayments table
ALTER TABLE public.loan_repayments 
ADD COLUMN IF NOT EXISTS installment_number integer;

-- Add active status to loan_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'active' AND enumtypid = 'public.loan_status'::regtype) THEN
    ALTER TYPE public.loan_status ADD VALUE 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = 'public.loan_status'::regtype) THEN
    ALTER TYPE public.loan_status ADD VALUE 'completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'defaulted' AND enumtypid = 'public.loan_status'::regtype) THEN
    ALTER TYPE public.loan_status ADD VALUE 'defaulted';
  END IF;
END$$;

-- Create function to generate repayment schedule when disbursement is completed
CREATE OR REPLACE FUNCTION public.generate_repayment_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  loan_record RECORD;
  monthly_payment NUMERIC;
  due_date DATE;
  i INTEGER;
BEGIN
  -- Only run when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get loan details
    SELECT * INTO loan_record FROM loan_applications WHERE id = NEW.loan_id;
    
    IF loan_record IS NOT NULL THEN
      -- Calculate monthly payment
      monthly_payment := loan_record.monthly_payment;
      IF monthly_payment IS NULL OR monthly_payment = 0 THEN
        monthly_payment := loan_record.total_repayment / loan_record.loan_term_months;
      END IF;
      
      -- Generate repayment schedule
      FOR i IN 1..loan_record.loan_term_months LOOP
        due_date := (CURRENT_DATE + (i * INTERVAL '1 month'))::DATE;
        
        INSERT INTO loan_repayments (
          loan_id,
          user_id,
          amount,
          due_date,
          status,
          installment_number
        ) VALUES (
          NEW.loan_id,
          loan_record.user_id,
          monthly_payment,
          due_date,
          'pending',
          i
        );
      END LOOP;
      
      -- Update loan status to active
      UPDATE loan_applications 
      SET status = 'active' 
      WHERE id = NEW.loan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating repayment schedule
DROP TRIGGER IF EXISTS trigger_generate_repayment_schedule ON public.disbursements;
CREATE TRIGGER trigger_generate_repayment_schedule
AFTER UPDATE ON public.disbursements
FOR EACH ROW
EXECUTE FUNCTION public.generate_repayment_schedule();

-- ========== 20251222204310_d1320c3d-5069-46fb-9232-c41d1e11e51c.sql ==========

-- Create storage bucket for loan documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('loan-documents', 'loan-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for loan-documents bucket
CREATE POLICY "Admins can access all loan documents"
ON storage.objects FOR ALL
USING (bucket_id = 'loan-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own loan documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'loan-documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own loan documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'loan-documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Add collateral and contract columns to loan_applications if not exists
ALTER TABLE loan_applications 
ADD COLUMN IF NOT EXISTS contract_url text,
ADD COLUMN IF NOT EXISTS collateral_description text,
ADD COLUMN IF NOT EXISTS collateral_value numeric,
ADD COLUMN IF NOT EXISTS admin_notes text;

-- Add DELETE policy for loan_applications for admins
CREATE POLICY "Admins can delete applications"
ON loan_applications FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== 20251222210143_2124c6ae-5bf2-410e-982c-a86c57808702.sql ==========

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- ========== 20251222221204_0183b7b3-dc3a-43bd-a4b5-082b10c75400.sql ==========

-- Allow users to upload their own documents
CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'loan-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own documents  
CREATE POLICY "Users can update their own documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'loan-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own documents
CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'loan-documents' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
  )
);

-- ========== 20251223154711_85016cc7-7323-4587-8c62-592385a24f3a.sql ==========

-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'loan_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'credit_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collections_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';

-- ========== 20251223154741_25b87651-46d3-48be-9262-df023007006e.sql ==========

-- 1. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins can modify settings" ON public.system_settings FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- 2. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Auditors can view audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- 3. Risk Assessments Table
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB,
  loan_application_id UUID REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES auth.users(id),
  credit_score INTEGER,
  risk_rating TEXT CHECK (risk_rating IN ('low', 'medium', 'high', 'critical')),
  admin_notes TEXT,
  decision TEXT CHECK (decision IN ('approve', 'reject', 'more_info')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers can manage risk assessments" ON public.risk_assessments FOR ALL USING (public.has_role(auth.uid(), 'credit_officer') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Loan Officers view risk assessments" ON public.risk_assessments FOR SELECT USING (public.has_role(auth.uid(), 'loan_officer'));

-- 4. Notification Logs Table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  title TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent',
  provider_response JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notifications" ON public.notification_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can view own notifications" ON public.notification_logs FOR SELECT USING (auth.uid() = user_id);

-- 5. Add Staff Assignment Column
ALTER TABLE public.loan_applications ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_assigned_to ON public.loan_applications(assigned_to);

-- 6. Audit Trigger for Loan Applications
CREATE OR REPLACE FUNCTION public.log_loan_changes() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES ((select auth.uid()), TG_OP, 'loan_application', NEW.id, row_to_json(OLD), row_to_json(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_log_loan_updates ON public.loan_applications;
CREATE TRIGGER trigger_log_loan_updates
AFTER UPDATE ON public.loan_applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
EXECUTE FUNCTION public.log_loan_changes();

-- 7. Audit Trigger for Repayments
CREATE OR REPLACE FUNCTION public.log_repayment_activity() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES ((select auth.uid()), 'REPAYMENT_CREATED', 'repayment', NEW.id, row_to_json(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_log_repayment_insert ON public.loan_repayments;
CREATE TRIGGER trigger_log_repayment_insert
AFTER INSERT ON public.loan_repayments
FOR EACH ROW EXECUTE FUNCTION public.log_repayment_activity();

-- 8. Default System Settings Data
INSERT INTO public.system_settings (key, value, description) VALUES
('general_config', '{"currency": "ZMW", "country": "ZM", "date_format": "DD/MM/YYYY"}'::jsonb, 'General Localization Settings'),
('lending_rules', '{"default_interest_rate": 15.0, "max_loan_amount": 50000, "min_loan_amount": 500}'::jsonb, 'Global Lending Parameters')
ON CONFLICT (key) DO NOTHING;

-- ========== 20251223160312_533e03f0-e33b-4917-9d07-8ee03d3b70dc.sql ==========

-- 1. Allow Admins and Staff to manage all profiles
CREATE POLICY "Admins and Staff can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer')
  );

-- 2. Update loan_applications policies to include staff roles for visibility
DROP POLICY IF EXISTS "Admins can view all applications" ON public.loan_applications;

CREATE POLICY "Staff and Admins can view all applications"
  ON public.loan_applications FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer') OR
    public.has_role(auth.uid(), 'finance_officer')
  );

DROP POLICY IF EXISTS "Admins can update all applications" ON public.loan_applications;

CREATE POLICY "Staff and Admins can update all applications"
  ON public.loan_applications FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
  );

-- ========== 20251223165300_enhanced_lms_schema.sql ==========

-- 1. Enhance Roles (Add specific staff roles)
-- We cannot execute ALTER TYPE inside a transaction block nicely in all environments, 
-- but Supabase migrations usually run independently. 
-- Note: 'admin' acts as Admin/Operations. 'super_admin' will be the Platform Owner.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'loan_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'credit_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collections_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';

-- 2. System Settings (Super Admin controlled)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies for System Settings
CREATE POLICY "Everyone can read system settings"
  ON public.system_settings FOR SELECT
  USING (true);

CREATE POLICY "Only Super Admins can modify settings"
  ON public.system_settings FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- 3. Audit Logs (Compliance & Security)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Audit Logs
CREATE POLICY "Admins and Auditors can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'auditor')
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true); -- Usually inserted via triggers or backend logic

-- 4. Credit & Risk Assessment Module
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB, -- checklist items, scores
  loan_application_id UUID REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES auth.users(id),
  credit_score INTEGER,
  risk_rating TEXT CHECK (risk_rating IN ('low', 'medium', 'high', 'critical')),
  admin_notes TEXT,
  decision TEXT CHECK (decision IN ('approve', 'reject', 'more_info')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

-- Policies for Risk Assessments
CREATE POLICY "Credit Officers and Admins can manage risk assessments"
  ON public.risk_assessments FOR ALL
  USING (
    public.has_role(auth.uid(), 'credit_officer') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Loan Officers can view risk assessments"
  ON public.risk_assessments FOR SELECT
  USING (public.has_role(auth.uid(), 'loan_officer'));

-- 5. Notification Logs (SMS/Email History)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'sms', 'email', 'whatsapp'
  recipient TEXT NOT NULL,
  title TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent', -- sent, failed, delivered
  provider_response JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notifications"
  ON public.notification_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their own notifications"
  ON public.notification_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Trigger for updated_at on new tables
CREATE TRIGGER update_risk_assessments_updated_at
  BEFORE UPDATE ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Insert Default System Settings
INSERT INTO public.system_settings (key, value, description) VALUES
('general_config', '{"currency": "ZMW", "country": "ZM", "date_format": "DD/MM/YYYY"}'::jsonb, 'General Localization Settings'),
('lending_rules', '{"default_interest_rate": 15.0, "max_loan_amount": 50000, "min_loan_amount": 500}'::jsonb, 'Global Lending Parameters'),
('company_info', '{"name": "LoanSphere Microfinance", "address": "Lusaka, Zambia", "support_email": "support@loansphere.com"}'::jsonb, 'Company Details');


-- ========== 20251223170406_8880dd62-ac54-4a08-9bcd-97a8cc6027a7.sql ==========

-- 1. Create collection_activities table for tracking collection efforts
CREATE TABLE IF NOT EXISTS public.collection_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  repayment_id UUID REFERENCES public.loan_repayments(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES auth.users(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('phone_call', 'sms', 'email', 'site_visit', 'demand_letter', 'legal_notice')),
  notes TEXT,
  outcome TEXT CHECK (outcome IN ('promised_to_pay', 'no_answer', 'wrong_number', 'refused', 'partial_payment', 'dispute', 'other')),
  promise_date DATE,
  promise_amount NUMERIC,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on collection_activities
ALTER TABLE public.collection_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collection_activities
CREATE POLICY "Staff can view collection activities" 
  ON public.collection_activities FOR SELECT 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'collections_officer') OR
    public.has_role(auth.uid(), 'loan_officer')
  );

CREATE POLICY "Staff can insert collection activities" 
  ON public.collection_activities FOR INSERT 
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'collections_officer') OR
    public.has_role(auth.uid(), 'loan_officer')
  );

CREATE POLICY "Staff can update collection activities" 
  ON public.collection_activities FOR UPDATE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'collections_officer')
  );

-- 2. Add advanced columns to loan_products
ALTER TABLE public.loan_products 
  ADD COLUMN IF NOT EXISTS interest_type TEXT DEFAULT 'flat' CHECK (interest_type IN ('flat', 'reducing_balance', 'compound')),
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_payment_penalty_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_repayment_allowed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS early_repayment_fee_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collateral_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_dti_ratio NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS min_credit_score INTEGER DEFAULT 0;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collection_activities_loan_id ON public.collection_activities(loan_id);
CREATE INDEX IF NOT EXISTS idx_collection_activities_follow_up ON public.collection_activities(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_status ON public.loan_repayments(status);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_due_date ON public.loan_repayments(due_date);

-- 4. Fix the generate_repayment_schedule trigger to reference correct table
CREATE OR REPLACE FUNCTION public.generate_repayment_schedule()
RETURNS TRIGGER AS $$
DECLARE
  loan_record RECORD;
  monthly_payment NUMERIC;
  due_date DATE;
  i INTEGER;
BEGIN
  -- Only run when status changes to 'completed' (disbursement completed)
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get loan details
    SELECT * INTO loan_record FROM public.loan_applications WHERE id = NEW.loan_id;
    
    IF loan_record IS NOT NULL THEN
      -- Calculate monthly payment
      monthly_payment := loan_record.monthly_payment;
      IF monthly_payment IS NULL OR monthly_payment = 0 THEN
        monthly_payment := loan_record.total_repayment / loan_record.loan_term_months;
      END IF;
      
      -- Generate repayment schedule
      FOR i IN 1..loan_record.loan_term_months LOOP
        due_date := (CURRENT_DATE + (i * INTERVAL '1 month'))::DATE;
        
        INSERT INTO public.loan_repayments (
          loan_id,
          user_id,
          amount,
          due_date,
          status,
          installment_number
        ) VALUES (
          NEW.loan_id,
          loan_record.user_id,
          monthly_payment,
          due_date,
          'pending',
          i
        );
      END LOOP;
      
      -- Update loan status to active
      UPDATE public.loan_applications 
      SET status = 'active' 
      WHERE id = NEW.loan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Ensure the trigger exists on disbursements table
DROP TRIGGER IF EXISTS trigger_generate_repayment_schedule ON public.disbursements;
CREATE TRIGGER trigger_generate_repayment_schedule
  AFTER UPDATE ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_repayment_schedule();

-- ========== 20251223170500_add_assigned_to.sql ==========

-- Add assigned_to column to loan_applications for staff assignment
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Add policy or update existing policies to allow assigned staff to view/update
-- (Existing admin policies already cover viewing/updating everything, but this column helps in filtering)

-- Create an index to speed up filtering by assigned staff
CREATE INDEX IF NOT EXISTS idx_loan_applications_assigned_to ON public.loan_applications(assigned_to);


-- ========== 20251223171500_storage_setup.sql ==========

-- Create a bucket for loan documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('loan_documents', 'loan_documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload their own documents
CREATE POLICY "Allow authenticated users to upload loan documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'loan_documents');

-- Policy: Allow authenticated users to view their own documents
CREATE POLICY "Allow users to view own loan documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'loan_documents' AND (select auth.uid()) = owner);

-- Policy: Allow staff/admins to view all loan documents
CREATE POLICY "Allow staff to view all loan documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'loan_documents' AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE public.user_roles.user_id = auth.uid() 
    AND public.user_roles.role IN ('admin', 'super_admin', 'loan_officer', 'credit_officer', 'finance_officer', 'auditor')
  )
);


-- ========== 20251223172500_audit_triggers.sql ==========

-- Function to log changes to audit_logs
CREATE OR REPLACE FUNCTION public.log_loan_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    (select auth.uid()),
    TG_OP,
    'loan_application',
    NEW.id,
    row_to_json(OLD),
    row_to_json(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for loan_applications updates
CREATE TRIGGER trigger_log_loan_updates
AFTER UPDATE ON public.loan_applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
EXECUTE FUNCTION public.log_loan_changes();

-- Function to log repayments
CREATE OR REPLACE FUNCTION public.log_repayment_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    new_values
  ) VALUES (
    (select auth.uid()),
    'REPAYMENT_CREATED',
    'repayment',
    NEW.id,
    row_to_json(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for repayments
CREATE TRIGGER trigger_log_repayment_insert
AFTER INSERT ON public.repayments
FOR EACH ROW
EXECUTE FUNCTION public.log_repayment_activity();


-- ========== 20251223173303_9a9100ca-0312-46d8-a5ef-4f3d2ffa379d.sql ==========

-- Add columns for penalty tracking and payment allocation to loan_repayments
ALTER TABLE public.loan_repayments 
ADD COLUMN IF NOT EXISTS penalty_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS principal_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalty_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_reversed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reversed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reversed_by uuid,
ADD COLUMN IF NOT EXISTS reversal_reason text,
ADD COLUMN IF NOT EXISTS original_amount numeric;

-- Add early settlement tracking to loan_applications
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS settlement_date date,
ADD COLUMN IF NOT EXISTS settlement_type text,
ADD COLUMN IF NOT EXISTS early_settlement_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_penalties numeric DEFAULT 0;

-- Create function to calculate penalty for overdue repayments
CREATE OR REPLACE FUNCTION public.calculate_repayment_penalty(
  p_repayment_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_due_date date;
  v_amount numeric;
  v_loan_id uuid;
  v_penalty_rate numeric;
  v_days_overdue integer;
  v_penalty numeric;
BEGIN
  -- Get repayment details
  SELECT due_date, amount, loan_id INTO v_due_date, v_amount, v_loan_id
  FROM public.loan_repayments
  WHERE id = p_repayment_id AND status = 'pending';
  
  IF v_due_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate days overdue
  v_days_overdue := CURRENT_DATE - v_due_date;
  
  IF v_days_overdue <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Get penalty rate from loan product
  SELECT COALESCE(lp.late_payment_penalty_percent, 5) INTO v_penalty_rate
  FROM public.loan_applications la
  LEFT JOIN public.loan_products lp ON la.loan_product_id = lp.id
  WHERE la.id = v_loan_id;
  
  -- Calculate penalty (monthly rate applied per month overdue)
  v_penalty := v_amount * (v_penalty_rate / 100) * CEIL(v_days_overdue::numeric / 30);
  
  -- Update the repayment record with penalty
  UPDATE public.loan_repayments
  SET penalty_amount = v_penalty
  WHERE id = p_repayment_id;
  
  RETURN v_penalty;
END;
$$;

-- Create function to apply penalties to all overdue repayments for a loan
CREATE OR REPLACE FUNCTION public.apply_loan_penalties(
  p_loan_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_penalty numeric := 0;
  v_repayment record;
BEGIN
  FOR v_repayment IN 
    SELECT id FROM public.loan_repayments 
    WHERE loan_id = p_loan_id 
    AND status = 'pending' 
    AND due_date < CURRENT_DATE
  LOOP
    v_total_penalty := v_total_penalty + public.calculate_repayment_penalty(v_repayment.id);
  END LOOP;
  
  -- Update total penalties on loan
  UPDATE public.loan_applications
  SET total_penalties = v_total_penalty
  WHERE id = p_loan_id;
  
  RETURN v_total_penalty;
END;
$$;

-- Create function for early settlement calculation
CREATE OR REPLACE FUNCTION public.calculate_early_settlement(
  p_loan_id uuid
)
RETURNS TABLE(
  outstanding_principal numeric,
  outstanding_interest numeric,
  total_penalties numeric,
  early_settlement_fee numeric,
  total_payoff_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_loan record;
  v_product record;
  v_total_paid numeric;
  v_total_due numeric;
  v_outstanding numeric;
  v_early_fee_rate numeric;
  v_early_fee numeric;
  v_penalties numeric;
BEGIN
  -- Get loan details
  SELECT * INTO v_loan FROM public.loan_applications WHERE id = p_loan_id;
  
  -- Get product early repayment fee
  SELECT COALESCE(early_repayment_fee_percent, 0) INTO v_early_fee_rate
  FROM public.loan_products WHERE id = v_loan.loan_product_id;
  
  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.loan_repayments
  WHERE loan_id = p_loan_id AND status = 'paid';
  
  -- Calculate outstanding
  v_outstanding := v_loan.total_repayment - v_total_paid;
  
  -- Calculate penalties
  SELECT COALESCE(SUM(penalty_amount), 0) INTO v_penalties
  FROM public.loan_repayments
  WHERE loan_id = p_loan_id AND status = 'pending';
  
  -- Calculate early settlement fee on remaining principal
  v_early_fee := (v_loan.loan_amount - v_total_paid) * (v_early_fee_rate / 100);
  IF v_early_fee < 0 THEN v_early_fee := 0; END IF;
  
  RETURN QUERY SELECT 
    GREATEST(v_loan.loan_amount - v_total_paid, 0)::numeric as outstanding_principal,
    GREATEST(v_outstanding - (v_loan.loan_amount - v_total_paid), 0)::numeric as outstanding_interest,
    v_penalties::numeric as total_penalties,
    v_early_fee::numeric as early_settlement_fee,
    GREATEST(v_outstanding + v_penalties + v_early_fee, 0)::numeric as total_payoff_amount;
END;
$$;

-- ========== 20251223174050_bf5f1909-cc0f-4e3c-8814-27c4ae88ecba.sql ==========

-- Add escalation and assignment columns to collection_activities
ALTER TABLE public.collection_activities
ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS assigned_to uuid,
ADD COLUMN IF NOT EXISTS ptp_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contact_method text;

-- Create collection assignments table for tracking collector workload
CREATE TABLE IF NOT EXISTS public.collection_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  collector_id uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid,
  status text DEFAULT 'active',
  priority text DEFAULT 'normal',
  notes text,
  last_contact_at timestamp with time zone,
  next_action_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(loan_id, collector_id, status)
);

-- Enable RLS
ALTER TABLE public.collection_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for collection_assignments
CREATE POLICY "Staff can view collection assignments"
ON public.collection_assignments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer') OR 
  has_role(auth.uid(), 'loan_officer') OR
  collector_id = auth.uid()
);

CREATE POLICY "Staff can insert collection assignments"
ON public.collection_assignments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer')
);

CREATE POLICY "Staff can update collection assignments"
ON public.collection_assignments
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer') OR
  collector_id = auth.uid()
);

CREATE POLICY "Admins can delete collection assignments"
ON public.collection_assignments
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin')
);

-- Create demand letters tracking table
CREATE TABLE IF NOT EXISTS public.demand_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  letter_type text NOT NULL DEFAULT 'first_notice',
  generated_by uuid,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  sent_via text,
  delivery_status text DEFAULT 'pending',
  file_url text,
  amount_demanded numeric,
  due_date date,
  response_received boolean DEFAULT false,
  response_date date,
  response_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demand_letters ENABLE ROW LEVEL SECURITY;

-- RLS policies for demand_letters
CREATE POLICY "Staff can view demand letters"
ON public.demand_letters
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer') OR 
  has_role(auth.uid(), 'loan_officer')
);

CREATE POLICY "Staff can insert demand letters"
ON public.demand_letters
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer')
);

CREATE POLICY "Staff can update demand letters"
ON public.demand_letters
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'collections_officer')
);

-- Add trigger for updated_at
CREATE TRIGGER update_collection_assignments_updated_at
BEFORE UPDATE ON public.collection_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create view for overdue loans with collection info
CREATE OR REPLACE VIEW public.overdue_loans_view AS
SELECT 
  la.id as loan_id,
  la.full_name as borrower_name,
  la.phone as borrower_phone,
  la.email as borrower_email,
  la.loan_amount,
  la.total_repayment,
  la.status as loan_status,
  COALESCE(
    (SELECT SUM(amount) FROM public.loan_repayments WHERE loan_id = la.id AND status = 'paid'),
    0
  ) as total_paid,
  COALESCE(
    (SELECT COUNT(*) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    0
  ) as overdue_count,
  COALESCE(
    (SELECT SUM(amount + COALESCE(penalty_amount, 0)) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    0
  ) as overdue_amount,
  COALESCE(
    (SELECT MIN(due_date) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    NULL
  ) as oldest_overdue_date,
  ca.collector_id as assigned_collector_id,
  ca.priority as collection_priority,
  ca.last_contact_at,
  ca.next_action_date,
  (SELECT activity_type FROM public.collection_activities 
   WHERE loan_id = la.id ORDER BY created_at DESC LIMIT 1) as last_activity_type,
  (SELECT created_at FROM public.collection_activities 
   WHERE loan_id = la.id ORDER BY created_at DESC LIMIT 1) as last_activity_date,
  (SELECT promise_date FROM public.collection_activities 
   WHERE loan_id = la.id AND promise_date IS NOT NULL AND promise_date >= CURRENT_DATE
   ORDER BY created_at DESC LIMIT 1) as active_ptp_date,
  (SELECT promise_amount FROM public.collection_activities 
   WHERE loan_id = la.id AND promise_date IS NOT NULL AND promise_date >= CURRENT_DATE
   ORDER BY created_at DESC LIMIT 1) as active_ptp_amount
FROM public.loan_applications la
LEFT JOIN public.collection_assignments ca ON ca.loan_id = la.id AND ca.status = 'active'
WHERE la.status IN ('active', 'disbursed')
AND EXISTS (
  SELECT 1 FROM public.loan_repayments 
  WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE
);

-- ========== 20251223174110_98d213cd-edd2-43f7-89a3-9107903147f4.sql ==========

-- Fix security definer view issue by dropping and recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.overdue_loans_view;

-- Recreate without SECURITY DEFINER (uses SECURITY INVOKER by default)
CREATE VIEW public.overdue_loans_view WITH (security_invoker = true) AS
SELECT 
  la.id as loan_id,
  la.full_name as borrower_name,
  la.phone as borrower_phone,
  la.email as borrower_email,
  la.loan_amount,
  la.total_repayment,
  la.status as loan_status,
  COALESCE(
    (SELECT SUM(amount) FROM public.loan_repayments WHERE loan_id = la.id AND status = 'paid'),
    0
  ) as total_paid,
  COALESCE(
    (SELECT COUNT(*) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    0
  ) as overdue_count,
  COALESCE(
    (SELECT SUM(amount + COALESCE(penalty_amount, 0)) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    0
  ) as overdue_amount,
  COALESCE(
    (SELECT MIN(due_date) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    NULL
  ) as oldest_overdue_date,
  ca.collector_id as assigned_collector_id,
  ca.priority as collection_priority,
  ca.last_contact_at,
  ca.next_action_date,
  (SELECT activity_type FROM public.collection_activities 
   WHERE loan_id = la.id ORDER BY created_at DESC LIMIT 1) as last_activity_type,
  (SELECT created_at FROM public.collection_activities 
   WHERE loan_id = la.id ORDER BY created_at DESC LIMIT 1) as last_activity_date,
  (SELECT promise_date FROM public.collection_activities 
   WHERE loan_id = la.id AND promise_date IS NOT NULL AND promise_date >= CURRENT_DATE
   ORDER BY created_at DESC LIMIT 1) as active_ptp_date,
  (SELECT promise_amount FROM public.collection_activities 
   WHERE loan_id = la.id AND promise_date IS NOT NULL AND promise_date >= CURRENT_DATE
   ORDER BY created_at DESC LIMIT 1) as active_ptp_amount
FROM public.loan_applications la
LEFT JOIN public.collection_assignments ca ON ca.loan_id = la.id AND ca.status = 'active'
WHERE la.status IN ('active', 'disbursed')
AND EXISTS (
  SELECT 1 FROM public.loan_repayments 
  WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE
);

-- ========== 20251223175000_fix_profile_rls.sql ==========

-- Allow Admins and Staff to manage all profiles
CREATE POLICY "Admins and Staff can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer')
  );

-- Also update loan_applications policies to include new staff roles
DROP POLICY IF EXISTS "Admins can view all applications" ON public.loan_applications;
CREATE POLICY "Staff and Admins can view all applications"
  ON public.loan_applications FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer') OR
    public.has_role(auth.uid(), 'finance_officer')
  );

DROP POLICY IF EXISTS "Admins can update all applications" ON public.loan_applications;
CREATE POLICY "Staff and Admins can update all applications"
  ON public.loan_applications FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
  );


-- ========== 20251223175018_5f115179-eea2-496e-a847-9599084453dc.sql ==========

-- Create document checklist table for loan verification
CREATE TABLE IF NOT EXISTS public.document_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_name text NOT NULL,
  is_required boolean DEFAULT true,
  is_submitted boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamp with time zone,
  rejection_reason text,
  file_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_checklists ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_checklists
CREATE POLICY "Users can view their own document checklist"
ON public.document_checklists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.loan_applications la 
    WHERE la.id = document_checklists.loan_id AND la.user_id = auth.uid()
  ) OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'loan_officer') OR
  has_role(auth.uid(), 'credit_officer')
);

CREATE POLICY "Staff can insert document checklist items"
ON public.document_checklists
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'loan_officer') OR
  has_role(auth.uid(), 'credit_officer')
);

CREATE POLICY "Staff can update document checklist"
ON public.document_checklists
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'loan_officer') OR
  has_role(auth.uid(), 'credit_officer')
);

CREATE POLICY "Admins can delete document checklist items"
ON public.document_checklists
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin')
);

-- Create guarantors table
CREATE TABLE IF NOT EXISTS public.loan_guarantors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  email text,
  nrc_number text,
  address text,
  city text,
  employment_status text,
  employer_name text,
  monthly_income numeric,
  is_verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamp with time zone,
  verification_notes text,
  nrc_front_url text,
  nrc_back_url text,
  consent_signed boolean DEFAULT false,
  consent_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loan_guarantors ENABLE ROW LEVEL SECURITY;

-- RLS policies for loan_guarantors
CREATE POLICY "Users can view guarantors on their loans"
ON public.loan_guarantors
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.loan_applications la 
    WHERE la.id = loan_guarantors.loan_id AND la.user_id = auth.uid()
  ) OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'loan_officer') OR
  has_role(auth.uid(), 'credit_officer')
);

CREATE POLICY "Staff can insert guarantors"
ON public.loan_guarantors
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'loan_officer')
);

CREATE POLICY "Staff can update guarantors"
ON public.loan_guarantors
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'loan_officer') OR
  has_role(auth.uid(), 'credit_officer')
);

CREATE POLICY "Admins can delete guarantors"
ON public.loan_guarantors
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin')
);

-- Add triggers for updated_at
CREATE TRIGGER update_document_checklists_updated_at
BEFORE UPDATE ON public.document_checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_guarantors_updated_at
BEFORE UPDATE ON public.loan_guarantors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create write-offs table for Phase 4
CREATE TABLE IF NOT EXISTS public.loan_writeoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE UNIQUE,
  writeoff_amount numeric NOT NULL,
  writeoff_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  approved_by uuid,
  approved_at timestamp with time zone,
  recovery_amount numeric DEFAULT 0,
  recovery_notes text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loan_writeoffs ENABLE ROW LEVEL SECURITY;

-- RLS policies for loan_writeoffs
CREATE POLICY "Staff can view writeoffs"
ON public.loan_writeoffs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'finance_officer')
);

CREATE POLICY "Admins can manage writeoffs"
ON public.loan_writeoffs
FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin')
);

-- Add trigger for updated_at
CREATE TRIGGER update_loan_writeoffs_updated_at
BEFORE UPDATE ON public.loan_writeoffs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20251223181000_collection_activities.sql ==========

-- Create Collections Activity Tracking
CREATE TABLE IF NOT EXISTS public.collection_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  repayment_id UUID REFERENCES public.loan_repayments(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES auth.users(id),
  activity_type TEXT NOT NULL, -- 'phone_call', 'sms', 'email', 'site_visit', 'demand_letter'
  notes TEXT,
  outcome TEXT, -- 'promised_to_pay', 'requested_extension', 'unreachable', 'disputed'
  promise_date DATE,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collection_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collections Officers and Admins can manage collection activities"
  ON public.collection_activities FOR ALL
  USING (
    public.has_role(auth.uid(), 'collections_officer') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Relevant staff can view collection activities"
  ON public.collection_activities FOR SELECT
  USING (
    public.has_role(auth.uid(), 'loan_officer') OR 
    public.has_role(auth.uid(), 'auditor')
  );

-- Add Index for performance
CREATE INDEX IF NOT EXISTS idx_collection_activities_loan_id ON public.collection_activities(loan_id);


-- ========== 20251223184500_update_role_policies.sql ==========

-- 1. Update user_roles policies to allow Super Admins and Admins to manage roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins and Super Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
  );

-- 2. Allow staff to view roles (needed for the staff list)
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles; -- In case it existed
CREATE POLICY "Staff can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer') OR
    public.has_role(auth.uid(), 'finance_officer') OR
    public.has_role(auth.uid(), 'collections_officer')
  );

-- 3. Update has_role function to be more flexible? 
-- Actually it's fine as it is, but we might want a 'is_staff' helper.
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role NOT IN ('user', 'employer')
  )
$$;


-- ========== 20251223185500_add_product_to_loans.sql ==========

-- Add product_id to loan_applications to track which product was used
ALTER TABLE public.loan_applications ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.loan_products(id);

-- Update index for performance
CREATE INDEX IF NOT EXISTS idx_loan_applications_product_id ON public.loan_applications(product_id);


-- ========== 20251225210230_ec4984d7-9668-49f1-9a1c-bd2de88c0138.sql ==========

-- Add policy to allow admins and staff to create loan applications for any user
CREATE POLICY "Admins can create loan applications" 
ON public.loan_applications 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role)
);

-- ========== 20251228203815_d704ee8f-7ea0-4562-8ebc-ca0d7f9db1d6.sql ==========

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

-- ========== 20251229094634_976bd5c2-0a15-4002-8a89-f5824a87a23f.sql ==========

-- Enable realtime for loan_applications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_applications;

-- ========== 20251229101844_a6d3400a-5bd5-4e0f-9f9c-12269cfb7197.sql ==========

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

-- ========== 20251229221616_238f9db5-94c0-41a2-9abb-b2a96cbbd700.sql ==========

-- Add new document and collateral columns for enhanced loan applications
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS collateral_image_url TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS bank_statement_url TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS payslip_2_url TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS payslip_3_url TEXT;

-- ========== 20251230144125_ef935dee-06bb-40ac-99d1-2c8534c9da16.sql ==========

-- Create CRB requests table to log all credit bureau interactions
CREATE TABLE public.crb_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_application_id UUID REFERENCES public.loan_applications(id) ON DELETE SET NULL,
  nrc_number TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('credit_check', 'submit_history')),
  request_payload JSONB,
  response_payload JSONB,
  credit_score INTEGER,
  blacklist_flag BOOLEAN DEFAULT FALSE,
  risk_rating TEXT CHECK (risk_rating IN ('excellent', 'good', 'fair', 'poor', 'unrated')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'timeout')),
  error_message TEXT,
  consent_obtained BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  provider TEXT DEFAULT 'creditbridge',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create guarantees table to track loan guarantee status
CREATE TABLE public.guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  guarantee_provider TEXT NOT NULL CHECK (guarantee_provider IN ('pmic', 'zcgs', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reference_code TEXT,
  eligibility_code TEXT,
  guaranteed_amount NUMERIC,
  guaranteed_percentage NUMERIC DEFAULT 80,
  guarantee_fee NUMERIC DEFAULT 0,
  validity_start DATE,
  validity_end DATE,
  conditions JSONB,
  approval_date TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  response_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add CRB and guarantee columns to loan_products
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS crb_check_required BOOLEAN DEFAULT FALSE;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS crb_auto_decline_score INTEGER DEFAULT 0;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS crb_manual_review_score INTEGER DEFAULT 300;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS crb_auto_approve_score INTEGER DEFAULT 600;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS guarantee_required BOOLEAN DEFAULT FALSE;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS guarantee_provider TEXT;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS max_guarantee_percent NUMERIC DEFAULT 80;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS guarantee_fee_percent NUMERIC DEFAULT 0;

-- Add CRB consent field to loan applications
ALTER TABLE public.loan_applications ADD COLUMN IF NOT EXISTS crb_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.loan_applications ADD COLUMN IF NOT EXISTS crb_consent_timestamp TIMESTAMPTZ;

-- Enable RLS on new tables
ALTER TABLE public.crb_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guarantees ENABLE ROW LEVEL SECURITY;

-- RLS policies for crb_requests
CREATE POLICY "Staff can view CRB requests" ON public.crb_requests
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'credit_officer'::app_role) OR
    has_role(auth.uid(), 'loan_officer'::app_role)
  );

CREATE POLICY "Staff can insert CRB requests" ON public.crb_requests
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'credit_officer'::app_role) OR
    has_role(auth.uid(), 'loan_officer'::app_role)
  );

CREATE POLICY "Staff can update CRB requests" ON public.crb_requests
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'credit_officer'::app_role)
  );

-- RLS policies for guarantees
CREATE POLICY "Staff can view guarantees" ON public.guarantees
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'credit_officer'::app_role) OR
    has_role(auth.uid(), 'loan_officer'::app_role) OR
    has_role(auth.uid(), 'finance_officer'::app_role)
  );

CREATE POLICY "Staff can insert guarantees" ON public.guarantees
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'credit_officer'::app_role)
  );

CREATE POLICY "Staff can update guarantees" ON public.guarantees
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'credit_officer'::app_role)
  );

CREATE POLICY "Admins can delete guarantees" ON public.guarantees
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Create indexes for performance
CREATE INDEX idx_crb_requests_borrower ON public.crb_requests(borrower_id);
CREATE INDEX idx_crb_requests_loan ON public.crb_requests(loan_application_id);
CREATE INDEX idx_crb_requests_nrc ON public.crb_requests(nrc_number);
CREATE INDEX idx_guarantees_loan ON public.guarantees(loan_id);
CREATE INDEX idx_guarantees_status ON public.guarantees(status);

-- Add trigger for guarantees updated_at
CREATE TRIGGER update_guarantees_updated_at
  BEFORE UPDATE ON public.guarantees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20251230163201_515bd1b1-1225-4d5b-9b2f-6e47e0c9d5f1.sql ==========

-- PMIC (Payroll Management Integration Center) Tables

-- 1. PMIC Config (Single row for lender settings)
CREATE TABLE public.pmic_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_authority TEXT, -- PMEC, PSPF, NAPSA, PRIVATE
  deduction_code TEXT, -- Assigned by authority (e.g., MFI-123)
  deduction_code_assigned_date DATE,
  max_deduction_percent NUMERIC DEFAULT 33, -- Max % of salary deductible
  min_net_pay_percent NUMERIC DEFAULT 50, -- Employee must retain this %
  max_loan_multiplier NUMERIC DEFAULT 36, -- Max loan = salary × multiplier
  default_loan_term_months INTEGER DEFAULT 24,
  max_concurrent_loans INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_config
CREATE POLICY "Admins can manage PMIC config"
ON public.pmic_config FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC config"
ON public.pmic_config FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer'));

-- 2. PMIC Employers
CREATE TABLE public.pmic_employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_code TEXT NOT NULL UNIQUE,
  employer_name TEXT NOT NULL,
  employer_type TEXT NOT NULL CHECK (employer_type IN ('government', 'parastatal', 'private', 'ngo')),
  payroll_cycle TEXT NOT NULL CHECK (payroll_cycle IN ('weekly', 'bi-weekly', 'monthly', 'quarterly')),
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_employers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_employers
CREATE POLICY "Admins can manage PMIC employers"
ON public.pmic_employers FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC employers"
ON public.pmic_employers FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'credit_officer'));

CREATE POLICY "Loan officers can insert PMIC employers"
ON public.pmic_employers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- 3. PMIC Borrower Enrollments
CREATE TABLE public.pmic_borrower_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.profiles(id),
  employer_id UUID REFERENCES public.pmic_employers(id),
  employee_number TEXT NOT NULL,
  department TEXT,
  gross_salary NUMERIC,
  net_salary NUMERIC,
  existing_deductions NUMERIC DEFAULT 0,
  available_deduction_capacity NUMERIC,
  enrollment_status TEXT DEFAULT 'pending' CHECK (enrollment_status IN ('pending', 'active', 'suspended', 'terminated')),
  enrolled_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_borrower_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_borrower_enrollments
CREATE POLICY "Admins can manage PMIC enrollments"
ON public.pmic_borrower_enrollments FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC enrollments"
ON public.pmic_borrower_enrollments FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'credit_officer'));

CREATE POLICY "Loan officers can insert PMIC enrollments"
ON public.pmic_borrower_enrollments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Loan officers can update PMIC enrollments"
ON public.pmic_borrower_enrollments FOR UPDATE
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- 4. PMIC Payroll Submissions
CREATE TABLE public.pmic_payroll_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_reference TEXT NOT NULL UNIQUE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('deduction_request', 'stop_order', 'variation', 'reconciliation')),
  payroll_period_start DATE NOT NULL,
  payroll_period_end DATE NOT NULL,
  total_amount NUMERIC,
  total_records INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'submitted', 'processing', 'completed', 'failed', 'rejected')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  processed_at TIMESTAMPTZ,
  file_url TEXT,
  response_file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_payroll_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_payroll_submissions
CREATE POLICY "Admins can manage PMIC submissions"
ON public.pmic_payroll_submissions FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC submissions"
ON public.pmic_payroll_submissions FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Staff can insert draft PMIC submissions"
ON public.pmic_payroll_submissions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- 5. PMIC Exceptions
CREATE TABLE public.pmic_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES public.pmic_borrower_enrollments(id),
  submission_id UUID REFERENCES public.pmic_payroll_submissions(id),
  exception_type TEXT NOT NULL CHECK (exception_type IN ('insufficient_salary', 'employment_terminated', 'duplicate_deduction', 'invalid_employee', 'exceeded_limit', 'payroll_error')),
  exception_status TEXT DEFAULT 'open' CHECK (exception_status IN ('open', 'investigating', 'resolved', 'closed')),
  description TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_exceptions
CREATE POLICY "Admins can manage PMIC exceptions"
ON public.pmic_exceptions FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC exceptions"
ON public.pmic_exceptions FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'collections_officer'));

-- Insert default PMIC config row
INSERT INTO public.pmic_config (
  payroll_authority,
  max_deduction_percent,
  min_net_pay_percent,
  max_loan_multiplier,
  default_loan_term_months,
  max_concurrent_loans,
  is_active
) VALUES (
  NULL,
  33,
  50,
  36,
  24,
  3,
  false
);

-- Create updated_at triggers
CREATE TRIGGER update_pmic_config_updated_at
BEFORE UPDATE ON public.pmic_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pmic_employers_updated_at
BEFORE UPDATE ON public.pmic_employers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pmic_borrower_enrollments_updated_at
BEFORE UPDATE ON public.pmic_borrower_enrollments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pmic_payroll_submissions_updated_at
BEFORE UPDATE ON public.pmic_payroll_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pmic_exceptions_updated_at
BEFORE UPDATE ON public.pmic_exceptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 2026_01_03_loan_engine_enhancements.sql ==========

-- =====================================================
-- LOAN ENGINE ENHANCEMENT - DATABASE MIGRATIONS
-- Run these in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PHASE 2: PER-PRODUCT DOCUMENT MANAGEMENT
-- =====================================================

-- Table: loan_product_documents
-- Defines required documents for each loan product
CREATE TABLE IF NOT EXISTS loan_product_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_product_id UUID NOT NULL REFERENCES loan_products(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN DEFAULT true,
  allowed_file_types TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'jpeg', 'png'],
  max_file_size_mb INTEGER DEFAULT 5,
  validity_days INTEGER, -- NULL = no expiry
  can_reuse_previous BOOLEAN DEFAULT false, -- Reuse from previous loans
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category column to loan_products if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loan_products' AND column_name = 'category') THEN
    ALTER TABLE loan_products ADD COLUMN category TEXT DEFAULT 'personal';
  END IF;
END $$;

-- Add term_unit column to loan_products if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loan_products' AND column_name = 'term_unit') THEN
    ALTER TABLE loan_products ADD COLUMN term_unit TEXT DEFAULT 'months';
  END IF;
END $$;

-- Table: loan_application_documents 
-- Stores uploaded documents for each loan application
CREATE TABLE IF NOT EXISTS loan_application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  document_config_id UUID REFERENCES loan_product_documents(id),
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  file_type TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Based on validity_days
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PHASE 3: CONFIGURABLE APPROVAL WORKFLOW
-- =====================================================

-- Table: workflow_stages
-- Defines the stages in an approval workflow
CREATE TABLE IF NOT EXISTS workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_product_id UUID REFERENCES loan_products(id) ON DELETE CASCADE,
  stage_code TEXT NOT NULL, -- e.g., 'submitted', 'document_review', 'crb_check'
  stage_name TEXT NOT NULL,
  stage_description TEXT,
  stage_order INTEGER NOT NULL DEFAULT 0,
  stage_type TEXT DEFAULT 'manual', -- manual, automatic, conditional
  color TEXT DEFAULT '#3b82f6', -- For UI display
  icon TEXT, -- lucide icon name
  is_initial BOOLEAN DEFAULT false, -- First stage
  is_terminal BOOLEAN DEFAULT false, -- Final stage (approved, rejected, etc.)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(loan_product_id, stage_code)
);

-- Table: workflow_transitions
-- Defines allowed transitions between stages
CREATE TABLE IF NOT EXISTS workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_product_id UUID REFERENCES loan_products(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  transition_name TEXT NOT NULL, -- e.g., 'Approve', 'Reject', 'Request More Docs'
  transition_action TEXT, -- approve, reject, escalate, return
  required_role TEXT[], -- Roles that can perform this transition
  requires_comment BOOLEAN DEFAULT false,
  requires_document BOOLEAN DEFAULT false,
  auto_trigger_condition JSONB, -- For automatic transitions
  notification_template TEXT, -- Email/SMS template to send
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: workflow_stage_permissions
-- Role-based permissions for each stage
CREATE TABLE IF NOT EXISTS workflow_stage_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- admin, loan_officer, collections, etc.
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_transition BOOLEAN DEFAULT false,
  can_comment BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: workflow_history
-- Audit trail of all stage transitions
CREATE TABLE IF NOT EXISTS workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  transition_action TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_by_name TEXT,
  comment TEXT,
  metadata JSONB, -- Additional data about the transition
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DEFAULT WORKFLOW TEMPLATES
-- =====================================================

-- Function to create default workflow for a loan product
CREATE OR REPLACE FUNCTION create_default_workflow(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stage_ids UUID[];
BEGIN
  -- Create default stages
  INSERT INTO workflow_stages (loan_product_id, stage_code, stage_name, stage_description, stage_order, stage_type, color, icon, is_initial, is_terminal)
  VALUES
    (p_product_id, 'draft', 'Draft', 'Application started but not submitted', 0, 'manual', '#6b7280', 'FileEdit', true, false),
    (p_product_id, 'submitted', 'Submitted', 'Application submitted for review', 1, 'manual', '#3b82f6', 'Send', false, false),
    (p_product_id, 'document_review', 'Document Review', 'Verifying uploaded documents', 2, 'manual', '#8b5cf6', 'FileSearch', false, false),
    (p_product_id, 'crb_check', 'CRB Check', 'Credit bureau verification', 3, 'automatic', '#f59e0b', 'Shield', false, false),
    (p_product_id, 'under_review', 'Under Review', 'Loan officer reviewing application', 4, 'manual', '#06b6d4', 'Eye', false, false),
    (p_product_id, 'approved', 'Approved', 'Loan approved, pending disbursement', 5, 'manual', '#10b981', 'CheckCircle', false, false),
    (p_product_id, 'disbursed', 'Disbursed', 'Funds sent to borrower', 6, 'manual', '#22c55e', 'Banknote', false, false),
    (p_product_id, 'active', 'Active', 'Loan is active with ongoing repayments', 7, 'automatic', '#14b8a6', 'Activity', false, false),
    (p_product_id, 'completed', 'Completed', 'Loan fully repaid', 8, 'automatic', '#10b981', 'Trophy', false, true),
    (p_product_id, 'rejected', 'Rejected', 'Application rejected', 99, 'manual', '#ef4444', 'XCircle', false, true),
    (p_product_id, 'defaulted', 'Defaulted', 'Loan in default status', 100, 'automatic', '#dc2626', 'AlertTriangle', false, true)
  RETURNING id INTO v_stage_ids;
  
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_loan_product_documents_product ON loan_product_documents(loan_product_id);
CREATE INDEX IF NOT EXISTS idx_loan_application_documents_app ON loan_application_documents(loan_application_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_product ON workflow_stages(loan_product_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_product ON workflow_transitions(loan_product_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_app ON workflow_history(loan_application_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE loan_product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_history ENABLE ROW LEVEL SECURITY;

-- Policy: loan_product_documents - Admins can manage, all authenticated can view
CREATE POLICY "Admins can manage loan_product_documents" ON loan_product_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Authenticated users can view loan_product_documents" ON loan_product_documents
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: loan_application_documents - Users can manage their own, admins can manage all
CREATE POLICY "Users can manage own loan_application_documents" ON loan_application_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM loan_applications WHERE id = loan_application_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all loan_application_documents" ON loan_application_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer'))
  );

-- Policy: workflow tables - Admins can manage
CREATE POLICY "Admins can manage workflow_stages" ON workflow_stages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Authenticated can view workflow_stages" ON workflow_stages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage workflow_transitions" ON workflow_transitions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Authenticated can view workflow_transitions" ON workflow_transitions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can view all workflow_history" ON workflow_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer'))
  );

CREATE POLICY "Users can view own workflow_history" ON workflow_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM loan_applications WHERE id = loan_application_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can insert workflow_history" ON workflow_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer'))
  );

-- =====================================================
-- SAMPLE DATA: Default document types
-- =====================================================

-- Insert common document types for reference
INSERT INTO loan_product_documents (loan_product_id, document_type, document_name, description, is_mandatory, allowed_file_types, max_file_size_mb, display_order)
SELECT 
  lp.id,
  dt.document_type,
  dt.document_name,
  dt.description,
  dt.is_mandatory,
  dt.allowed_file_types,
  dt.max_file_size_mb,
  dt.display_order
FROM loan_products lp
CROSS JOIN (
  VALUES
    ('nrc_front', 'NRC (Front)', 'National Registration Card - Front side', true, ARRAY['jpg', 'jpeg', 'png', 'pdf'], 5, 1),
    ('nrc_back', 'NRC (Back)', 'National Registration Card - Back side', true, ARRAY['jpg', 'jpeg', 'png', 'pdf'], 5, 2),
    ('payslip', 'Latest Payslip', 'Most recent payslip from employer', true, ARRAY['pdf', 'jpg', 'jpeg', 'png'], 5, 3),
    ('bank_statement', 'Bank Statement', '3 months bank statement', true, ARRAY['pdf'], 10, 4),
    ('employment_letter', 'Employment Letter', 'Letter confirming employment', false, ARRAY['pdf', 'jpg', 'jpeg', 'png'], 5, 5),
    ('proof_of_residence', 'Proof of Residence', 'Utility bill or rental agreement', false, ARRAY['pdf', 'jpg', 'jpeg', 'png'], 5, 6)
) AS dt(document_type, document_name, description, is_mandatory, allowed_file_types, max_file_size_mb, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM loan_product_documents lpd 
  WHERE lpd.loan_product_id = lp.id AND lpd.document_type = dt.document_type
)
AND lp.is_active = true
LIMIT 50; -- Safety limit

-- =====================================================
-- END OF MIGRATIONS
-- =====================================================


-- ========== 20260101161808_715ee19c-703b-470a-8e38-65d1338d3472.sql ==========

-- Create accounts table for capital management (bank accounts, wallets, etc.)
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'bank', -- bank, mobile_money, cash, petty_cash
  account_number TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create account transactions for tracking all money movements
CREATE TABLE public.account_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- deposit, withdrawal, transfer_in, transfer_out, disbursement, repayment
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  source TEXT, -- where money came from (for deposits)
  destination TEXT, -- where money went (for withdrawals)
  reference_type TEXT, -- loan, expense, transfer, capital_injection
  reference_id UUID, -- link to loan_id, expense_id, or transfer pair
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expenses table based on user reference
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_category TEXT NOT NULL, -- origination, collection, legal, overhead, marketing, salaries, utilities, rent, other
  amount NUMERIC NOT NULL,
  vendor_payee TEXT NOT NULL,
  description TEXT,
  loan_id UUID REFERENCES public.loan_applications(id) ON DELETE SET NULL,
  branch TEXT,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer', -- cash, bank_transfer, petty_cash, mobile_money
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, paid, rejected
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Accounts policies
CREATE POLICY "Staff can view accounts"
ON public.accounts FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Admins can manage accounts"
ON public.accounts FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Account transactions policies
CREATE POLICY "Staff can view transactions"
ON public.account_transactions FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Staff can insert transactions"
ON public.account_transactions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

-- Expenses policies
CREATE POLICY "Staff can view expenses"
ON public.expenses FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'loan_officer'));

CREATE POLICY "Staff can insert expenses"
ON public.expenses FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Staff can update expenses"
ON public.expenses FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Admins can delete expenses"
ON public.expenses FOR DELETE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Create updated_at triggers
CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20260108_account_based_transactions.sql ==========

-- Migration: Account-Based Financial System
-- Description: Link all financial transactions to specific accounts
-- Created: 2026-01-08

-- Add source_account_id to disbursements table
ALTER TABLE disbursements
ADD COLUMN IF NOT EXISTS source_account_id UUID REFERENCES accounts(id);

-- Add destination_account_id to repayments table (for recording which account received the payment)
ALTER TABLE repayments
ADD COLUMN IF NOT EXISTS destination_account_id UUID REFERENCES accounts(id);

-- Ensure expenses already have account_id (should exist, but making sure)
-- expenses.account_id should already exist from previous schema

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_disbursements_source_account ON disbursements(source_account_id);
CREATE INDEX IF NOT EXISTS idx_repayments_destination_account ON repayments(destination_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);

-- Add comments for documentation
COMMENT ON COLUMN disbursements.source_account_id IS 'The account from which funds were disbursed';
COMMENT ON COLUMN repayments.destination_account_id IS 'The account to which the repayment was deposited';

-- Create view for account cash flow analysis
CREATE OR REPLACE VIEW account_cash_flow AS
SELECT 
  a.id AS account_id,
  a.account_name,
  a.account_type,
  a.balance AS current_balance,
  -- Inflows (repayments deposited)
  COALESCE(SUM(CASE WHEN r.destination_account_id = a.id THEN r.amount ELSE 0 END), 0) AS total_repayments_received,
  -- Outflows (disbursements and expenses)
  COALESCE(SUM(CASE WHEN d.source_account_id = a.id THEN d.amount ELSE 0 END), 0) AS total_disbursements_sent,
  COALESCE(SUM(CASE WHEN e.account_id = a.id THEN e.amount ELSE 0 END), 0) AS total_expenses_paid,
  -- Net flow
  COALESCE(SUM(CASE WHEN r.destination_account_id = a.id THEN r.amount ELSE 0 END), 0) -
  (COALESCE(SUM(CASE WHEN d.source_account_id = a.id THEN d.amount ELSE 0 END), 0) +
   COALESCE(SUM(CASE WHEN e.account_id = a.id THEN e.amount ELSE 0 END), 0)) AS net_cash_flow
FROM accounts a
LEFT JOIN repayments r ON r.destination_account_id = a.id AND r.status = 'paid'
LEFT JOIN disbursements d ON d.source_account_id = a.id AND d.status = 'completed'
LEFT JOIN expenses e ON e.account_id = a.id AND e.status = 'paid'
WHERE a.is_active = true
GROUP BY a.id, a.account_name, a.account_type, a.balance;

-- Create function to validate account balance before disbursement
CREATE OR REPLACE FUNCTION check_account_balance_before_disbursement()
RETURNS TRIGGER AS $$
DECLARE
  account_balance DECIMAL(15, 2);
BEGIN
  -- Only check if source_account_id is set
  IF NEW.source_account_id IS NOT NULL THEN
    -- Get current account balance
    SELECT balance INTO account_balance
    FROM accounts
    WHERE id = NEW.source_account_id;

    -- Check if account has sufficient funds
    IF account_balance < NEW.amount THEN
      RAISE EXCEPTION 'Insufficient balance in source account. Available: %, Required: %', account_balance, NEW.amount;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for balance validation
DROP TRIGGER IF EXISTS validate_disbursement_balance ON disbursements;
CREATE TRIGGER validate_disbursement_balance
  BEFORE INSERT ON disbursements
  FOR EACH ROW
  EXECUTE FUNCTION check_account_balance_before_disbursement();

-- Create function to automatically update account balances on disbursement
CREATE OR REPLACE FUNCTION update_account_on_disbursement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if source_account_id is set and status is completed
  IF NEW.source_account_id IS NOT NULL AND NEW.status = 'completed' THEN
    -- For new disbursements or status changes to completed
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status != 'completed') THEN
      -- Deduct from source account
      UPDATE accounts
      SET balance = balance - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.source_account_id;

      -- Record transaction
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_after,
        reference_type,
        reference_id,
        description
      )
      SELECT 
        NEW.source_account_id,
        'disbursement',
        NEW.amount,
        balance,
        'loan_disbursement',
        NEW.id,
        'Loan disbursement for loan ID: ' || NEW.loan_id
      FROM accounts
      WHERE id = NEW.source_account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic account updates
DROP TRIGGER IF EXISTS auto_update_account_disbursement ON disbursements;
CREATE TRIGGER auto_update_account_disbursement
  AFTER INSERT OR UPDATE ON disbursements
  FOR EACH ROW
  EXECUTE FUNCTION update_account_on_disbursement();

-- Create function to automatically update account balances on repayment
CREATE OR REPLACE FUNCTION update_account_on_repayment()
RETURNS TRIGGER AS $$
DECLARE
  payment_amount DECIMAL(15, 2);
BEGIN
  -- Only process if destination_account_id is set and status is paid
  IF NEW.destination_account_id IS NOT NULL AND NEW.status = 'paid' THEN
    -- For new paid repayments or status changes to paid
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status != 'paid') THEN
      -- Calculate the actual payment amount
      payment_amount := COALESCE(NEW.principal_paid, NEW.amount);

      -- Add to destination account
      UPDATE accounts
      SET balance = balance + payment_amount,
          updated_at = NOW()
      WHERE id = NEW.destination_account_id;

      -- Record transaction
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_after,
        reference_type,
        reference_id,
        description
      )
      SELECT 
        NEW.destination_account_id,
        'repayment',
        payment_amount,
        balance,
        'loan_repayment',
        NEW.id,
        'Loan repayment for loan ID: ' || NEW.loan_id
      FROM accounts
      WHERE id = NEW.destination_account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic account updates on repayment
DROP TRIGGER IF NOT EXISTS auto_update_account_repayment ON repayments;
CREATE TRIGGER auto_update_account_repayment
  AFTER INSERT OR UPDATE ON repayments
  FOR EACH ROW
  EXECUTE FUNCTION update_account_on_repayment();

-- Create function to automatically update account balances on expense
CREATE OR REPLACE FUNCTION update_account_on_expense()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if account_id is set and status is paid
  IF NEW.account_id IS NOT NULL AND NEW.status = 'paid' THEN
    -- For new paid expenses or status changes to paid
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status != 'paid') THEN
      -- Deduct from account
      UPDATE accounts
      SET balance = balance - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.account_id;

      -- Record transaction
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_after,
        reference_type,
        reference_id,
        description
      )
      SELECT 
        NEW.account_id,
        'expense',
        NEW.amount,
        balance,
        'expense',
        NEW.id,
        'Expense: ' || COALESCE(NEW.expense_category, 'General') || ' - ' || COALESCE(NEW.vendor_payee, 'N/A')
      FROM accounts
      WHERE id = NEW.account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic account updates on expense
DROP TRIGGER IF EXISTS auto_update_account_expense ON expenses;
CREATE TRIGGER auto_update_account_expense
  AFTER INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_account_on_expense();

-- Add helpful comments
COMMENT ON VIEW account_cash_flow IS 'Shows cash flow analysis for each account including inflows (repayments) and outflows (disbursements, expenses)';
COMMENT ON FUNCTION check_account_balance_before_disbursement() IS 'Validates that the source account has sufficient balance before allowing a disbursement';
COMMENT ON FUNCTION update_account_on_disbursement() IS 'Automatically deducts disbursement amount from source account and records transaction';
COMMENT ON FUNCTION update_account_on_repayment() IS 'Automatically adds repayment amount to destination account and records transaction';
COMMENT ON FUNCTION update_account_on_expense() IS 'Automatically deducts expense amount from account and records transaction';


-- ========== 20260108_notification_providers.sql ==========

-- Migration: Add notification provider settings and enhance notification_logs table
-- Date: 2026-01-08
-- Description: Adds support for multiple notification providers (Africa's Talking, Twilio, SendGrid, SMTP)
--              for SMS, WhatsApp, and Email notifications

-- Ensure notification_logs table has all required columns
ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS provider_response JSONB DEFAULT '{}'::jsonb;

-- Add index for faster queries on notification logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- Add comment to notification_logs table
COMMENT ON TABLE notification_logs IS 'Logs all notification attempts (SMS, Email, WhatsApp) sent through the system';
COMMENT ON COLUMN notification_logs.type IS 'Type of notification: sms, email, push, whatsapp';
COMMENT ON COLUMN notification_logs.status IS 'Status: pending, sent, failed, pending_config, disabled';
COMMENT ON COLUMN notification_logs.provider_response IS 'Raw response from the notification provider (Africa''s Talking, Twilio, SendGrid)';

-- Insert default notification provider settings if not exists
INSERT INTO system_settings (key, value, description, created_at, updated_at)
VALUES (
  'notification_providers',
  jsonb_build_object(
    'sms_enabled', false,
    'sms_provider', 'none',
    'africastalking_username', '',
    'africastalking_api_key', '',
    'africastalking_sender_id', 'PHINDU',
    'twilio_account_sid', '',
    'twilio_auth_token', '',
    'twilio_phone_number', '',
    'whatsapp_enabled', false,
    'whatsapp_provider', 'none',
    'africastalking_whatsapp_number', '',
    'twilio_whatsapp_number', '',
    'email_enabled', false,
    'email_provider', 'none',
    'sendgrid_api_key', '',
    'sendgrid_from_email', '',
    'sendgrid_from_name', 'Phindu Finance',
    'smtp_host', '',
    'smtp_port', 587,
    'smtp_username', '',
    'smtp_password', '',
    'smtp_from_email', '',
    'smtp_from_name', 'Phindu Finance',
    'notify_on_signup', true,
    'notify_on_loan_approval', true,
    'notify_on_loan_rejection', true,
    'notify_on_disbursement', true,
    'notify_on_payment_received', true,
    'notify_on_payment_reminder', true,
    'notify_on_overdue', true,
    'notify_on_loan_completion', true
  ),
  'Multi-channel notification provider settings for SMS, WhatsApp, and Email communications',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Create a view for notification statistics
CREATE OR REPLACE VIEW notification_stats AS
SELECT
  type,
  status,
  COUNT(*) as count,
  DATE(created_at) as date
FROM notification_logs
GROUP BY type, status, DATE(created_at)
ORDER BY date DESC, type, status;

COMMENT ON VIEW notification_stats IS 'Daily notification statistics grouped by type and status';

-- Create function to get recent notification logs for a user
CREATE OR REPLACE FUNCTION get_user_notifications(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  recipient TEXT,
  title TEXT,
  message TEXT,
  status TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nl.id,
    nl.type,
    nl.recipient,
    nl.title,
    nl.message,
    nl.status,
    nl.sent_at,
    nl.created_at
  FROM notification_logs nl
  WHERE nl.user_id = p_user_id
  ORDER BY nl.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_notifications IS 'Retrieves recent notification logs for a specific user';

-- Create function to get notification delivery rate
CREATE OR REPLACE FUNCTION get_notification_delivery_rate(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  type TEXT,
  total_sent BIGINT,
  successful BIGINT,
  failed BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nl.type,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE status = 'sent') as successful,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'sent')::NUMERIC / NULLIF(COUNT(*), 0) * 100),
      2
    ) as success_rate
  FROM notification_logs nl
  WHERE DATE(nl.created_at) BETWEEN p_start_date AND p_end_date
  GROUP BY nl.type
  ORDER BY nl.type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_notification_delivery_rate IS 'Calculates notification delivery success rates by type for a date range';

-- Grant necessary permissions
GRANT SELECT ON notification_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_delivery_rate TO authenticated;


-- ========== 20260108_remove_funding_pool_setting.sql ==========

-- Remove deprecated static funding_pool setting in favor of real account balances
delete from system_settings where key = 'funding_pool';



-- ========== 20260108_wallet_and_court_system.sql ==========

-- Migration: Wallet/Account Management and Court Module
-- Description: Add wallet accounts for tracking balances and court cases management
-- Created: 2026-01-08

-- ==============================================
-- 1. WALLET/ACCOUNT MANAGEMENT SYSTEM
-- ==============================================

-- Create wallet_accounts table for tracking borrower available balances
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  pending_balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  total_deposited DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  total_withdrawn DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT positive_available_balance CHECK (available_balance >= 0),
  CONSTRAINT positive_pending_balance CHECK (pending_balance >= 0),
  CONSTRAINT positive_total_deposited CHECK (total_deposited >= 0),
  CONSTRAINT positive_total_withdrawn CHECK (total_withdrawn >= 0)
);

-- Create wallet_transactions table for all wallet movements
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'credit', 'debit', 'loan_payment', 'refund', 'withdrawal', 'adjustment'
  amount DECIMAL(15, 2) NOT NULL,
  balance_before DECIMAL(15, 2) NOT NULL,
  balance_after DECIMAL(15, 2) NOT NULL,
  reference_type VARCHAR(50), -- 'loan_payment', 'repayment', 'manual', 'reversal', etc.
  reference_id UUID, -- ID of related record (repayment_id, loan_id, etc.)
  description TEXT,
  status VARCHAR(50) DEFAULT 'completed' NOT NULL, -- 'pending', 'completed', 'failed', 'reversed'
  processed_by UUID REFERENCES auth.users(id), -- Admin who processed it
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('credit', 'debit', 'loan_payment', 'refund', 'withdrawal', 'adjustment', 'reversal')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Create wallet_withdrawal_requests table for borrower withdrawal requests
CREATE TABLE IF NOT EXISTS wallet_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  withdrawal_method VARCHAR(50) NOT NULL, -- 'bank_transfer', 'mobile_money', 'cash_pickup'
  account_details JSONB, -- Bank account, mobile money number, etc.
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  admin_notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  transaction_id UUID REFERENCES wallet_transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_withdrawal_status CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  CONSTRAINT valid_withdrawal_method CHECK (withdrawal_method IN ('bank_transfer', 'mobile_money', 'cash_pickup')),
  CONSTRAINT positive_withdrawal_amount CHECK (amount > 0)
);

-- ==============================================
-- 2. COURT CASES MODULE
-- ==============================================

-- Create court_cases table for legal enforcement tracking
CREATE TABLE IF NOT EXISTS court_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  case_number VARCHAR(100) UNIQUE NOT NULL,
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_name VARCHAR(255) NOT NULL,
  case_type VARCHAR(100) NOT NULL, -- 'recovery', 'enforcement', 'garnishment', 'bankruptcy'
  filing_date DATE NOT NULL,
  hearing_date DATE,
  case_status VARCHAR(50) DEFAULT 'filed' NOT NULL,
  judgment_amount DECIMAL(15, 2),
  judgment_date DATE,
  enforcement_status VARCHAR(50), -- 'pending', 'in_progress', 'completed', 'abandoned'
  court_costs DECIMAL(15, 2) DEFAULT 0.00,
  legal_fees DECIMAL(15, 2) DEFAULT 0.00,
  case_notes TEXT,
  documents JSONB, -- Array of document URLs
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id), -- Assigned lawyer/staff
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_case_type CHECK (case_type IN ('recovery', 'enforcement', 'garnishment', 'bankruptcy', 'other')),
  CONSTRAINT valid_case_status CHECK (case_status IN ('filed', 'pending_hearing', 'judgment_obtained', 'enforcement', 'closed', 'withdrawn')),
  CONSTRAINT valid_enforcement_status CHECK (enforcement_status IN ('pending', 'in_progress', 'completed', 'abandoned'))
);

-- Create court_case_events table for tracking court proceedings
CREATE TABLE IF NOT EXISTS court_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id UUID NOT NULL REFERENCES court_cases(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- 'filing', 'hearing', 'judgment', 'payment', 'document_submission'
  event_date DATE NOT NULL,
  event_time TIME,
  description TEXT NOT NULL,
  outcome TEXT,
  next_action TEXT,
  next_action_date DATE,
  documents JSONB,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_event_type CHECK (event_type IN ('filing', 'hearing', 'judgment', 'payment', 'document_submission', 'correspondence', 'other'))
);

-- ==============================================
-- 3. ENHANCED NOTIFICATION SYSTEM
-- ==============================================

-- Add rejection_reason field to loan_applications
ALTER TABLE loan_applications 
ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255),
ADD COLUMN IF NOT EXISTS rejection_details TEXT;

-- Add contract signing fields
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS contract_url TEXT,
ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS signed_contract_url TEXT;

-- ==============================================
-- 4. PARTIAL PAYMENT SYSTEM
-- ==============================================

-- Add fields to repayments table for partial/split payments
ALTER TABLE repayments
ADD COLUMN IF NOT EXISTS is_partial_payment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS installment_number INTEGER,
ADD COLUMN IF NOT EXISTS payment_source VARCHAR(50) DEFAULT 'direct'; -- 'direct', 'wallet', 'split'

-- Create payment_splits table for tracking split payments
CREATE TABLE IF NOT EXISTS payment_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repayment_id UUID NOT NULL REFERENCES repayments(id) ON DELETE CASCADE,
  split_number INTEGER NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  transaction_reference VARCHAR(100),
  payment_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status VARCHAR(50) DEFAULT 'completed' NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT positive_split_amount CHECK (amount > 0),
  CONSTRAINT valid_split_status CHECK (status IN ('pending', 'completed', 'failed'))
);

-- ==============================================
-- 5. INDEXES FOR PERFORMANCE
-- ==============================================

-- Wallet indexes
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_id ON wallet_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_active ON wallet_accounts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawal_requests_user_id ON wallet_withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawal_requests_status ON wallet_withdrawal_requests(status);

-- Court cases indexes
CREATE INDEX IF NOT EXISTS idx_court_cases_loan_id ON court_cases(loan_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_borrower_id ON court_cases(borrower_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_status ON court_cases(case_status);
CREATE INDEX IF NOT EXISTS idx_court_cases_filing_date ON court_cases(filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_court_cases_hearing_date ON court_cases(hearing_date);
CREATE INDEX IF NOT EXISTS idx_court_case_events_case_id ON court_case_events(court_case_id);
CREATE INDEX IF NOT EXISTS idx_court_case_events_date ON court_case_events(event_date DESC);

-- Payment splits indexes
CREATE INDEX IF NOT EXISTS idx_payment_splits_repayment_id ON payment_splits(repayment_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_date ON payment_splits(payment_date DESC);

-- Loan applications indexes for new fields
CREATE INDEX IF NOT EXISTS idx_loan_applications_contract_signed ON loan_applications(contract_signed_at) WHERE contract_signed_at IS NOT NULL;

-- ==============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Enable RLS on all new tables
ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;

-- Wallet RLS Policies
CREATE POLICY "Users can view their own wallet"
  ON wallet_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
  ON wallet_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'loan_officer')
    )
  );

-- Wallet Transactions RLS
CREATE POLICY "Users can view their own transactions"
  ON wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wallet_accounts
      WHERE wallet_accounts.id = wallet_transactions.wallet_id
      AND wallet_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all transactions"
  ON wallet_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'loan_officer')
    )
  );

-- Withdrawal Requests RLS
CREATE POLICY "Users can view their own withdrawal requests"
  ON wallet_withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own withdrawal requests"
  ON wallet_withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all withdrawal requests"
  ON wallet_withdrawal_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'loan_officer')
    )
  );

-- Court Cases RLS (Admin only)
CREATE POLICY "Admins can manage court cases"
  ON court_cases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'legal_officer')
    )
  );

CREATE POLICY "Admins can manage court case events"
  ON court_case_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'legal_officer')
    )
  );

-- Payment Splits RLS
CREATE POLICY "Users can view their own payment splits"
  ON payment_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM repayments
      JOIN loan_applications ON repayments.loan_id = loan_applications.id
      WHERE repayments.id = payment_splits.repayment_id
      AND loan_applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all payment splits"
  ON payment_splits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'loan_officer')
    )
  );

-- ==============================================
-- 7. TRIGGERS FOR AUTOMATIC UPDATES
-- ==============================================

-- Trigger to update wallet_accounts.updated_at
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_accounts_updated_at
  BEFORE UPDATE ON wallet_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

CREATE TRIGGER wallet_withdrawal_requests_updated_at
  BEFORE UPDATE ON wallet_withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

CREATE TRIGGER court_cases_updated_at
  BEFORE UPDATE ON court_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

-- ==============================================
-- 8. VIEWS FOR EASY DATA ACCESS
-- ==============================================

-- View for wallet summary with user details
CREATE OR REPLACE VIEW wallet_summary AS
SELECT 
  wa.id,
  wa.user_id,
  p.full_name,
  p.email,
  p.phone,
  wa.available_balance,
  wa.pending_balance,
  wa.total_deposited,
  wa.total_withdrawn,
  wa.is_active,
  wa.created_at,
  wa.updated_at,
  (SELECT COUNT(*) FROM wallet_transactions WHERE wallet_id = wa.id) as transaction_count,
  (SELECT COUNT(*) FROM wallet_withdrawal_requests WHERE wallet_id = wa.id AND status = 'pending') as pending_withdrawals
FROM wallet_accounts wa
JOIN profiles p ON wa.user_id = p.id;

-- View for court cases with loan and borrower details
CREATE OR REPLACE VIEW court_cases_detailed AS
SELECT 
  cc.*,
  la.loan_amount,
  la.total_repayment,
  la.status as loan_status,
  p.full_name as borrower_name,
  p.email as borrower_email,
  p.phone as borrower_phone,
  p.nrc_number as borrower_nrc,
  (SELECT COUNT(*) FROM court_case_events WHERE court_case_id = cc.id) as event_count
FROM court_cases cc
JOIN loan_applications la ON cc.loan_id = la.id
JOIN profiles p ON cc.borrower_id = p.id;

-- ==============================================
-- 9. FUNCTIONS FOR BUSINESS LOGIC
-- ==============================================

-- Function to credit wallet (add money)
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id UUID,
  p_amount DECIMAL,
  p_transaction_type VARCHAR,
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_processed_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before DECIMAL;
  v_balance_after DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- Get or create wallet
  SELECT id, available_balance INTO v_wallet_id, v_balance_before
  FROM wallet_accounts
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallet_accounts (user_id, available_balance)
    VALUES (p_user_id, 0)
    RETURNING id, available_balance INTO v_wallet_id, v_balance_before;
  END IF;
  
  -- Calculate new balance
  v_balance_after := v_balance_before + p_amount;
  
  -- Update wallet
  UPDATE wallet_accounts
  SET 
    available_balance = v_balance_after,
    total_deposited = total_deposited + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, balance_before, balance_after,
    reference_type, reference_id, description, status, processed_by
  ) VALUES (
    v_wallet_id, p_transaction_type, p_amount, v_balance_before, v_balance_after,
    p_reference_type, p_reference_id, p_description, 'completed', p_processed_by
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to debit wallet (remove money)
CREATE OR REPLACE FUNCTION debit_wallet(
  p_user_id UUID,
  p_amount DECIMAL,
  p_transaction_type VARCHAR,
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_processed_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before DECIMAL;
  v_balance_after DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- Get wallet
  SELECT id, available_balance INTO v_wallet_id, v_balance_before
  FROM wallet_accounts
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;
  
  -- Check sufficient balance
  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Calculate new balance
  v_balance_after := v_balance_before - p_amount;
  
  -- Update wallet
  UPDATE wallet_accounts
  SET 
    available_balance = v_balance_after,
    total_withdrawn = total_withdrawn + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, balance_before, balance_after,
    reference_type, reference_id, description, status, processed_by
  ) VALUES (
    v_wallet_id, p_transaction_type, p_amount, v_balance_before, v_balance_after,
    p_reference_type, p_reference_id, p_description, 'completed', p_processed_by
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 10. SEED DATA / INITIAL SETUP
-- ==============================================

-- Create wallets for existing users (optional, can be done on-demand)
INSERT INTO wallet_accounts (user_id, available_balance)
SELECT id, 0
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM wallet_accounts WHERE wallet_accounts.user_id = auth.users.id
)
ON CONFLICT DO NOTHING;

-- Add comment for tracking
COMMENT ON TABLE wallet_accounts IS 'Stores wallet/account balances for borrowers to track overpayments and available funds';
COMMENT ON TABLE court_cases IS 'Manages legal enforcement and court proceedings for defaulted loans';
COMMENT ON TABLE payment_splits IS 'Tracks split/partial payments for loan repayments';


-- ========== 20260108171013_68fb6947-6cc4-4eb3-8e58-7d2d0511db79.sql ==========

-- Create wallet_accounts table for borrower wallets
CREATE TABLE public.wallet_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'main',
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallet_transactions table
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallet_accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create court_cases table
CREATE TABLE public.court_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  case_number TEXT,
  court_name TEXT,
  case_type TEXT NOT NULL DEFAULT 'debt_recovery',
  status TEXT NOT NULL DEFAULT 'filed',
  filing_date DATE,
  hearing_date DATE,
  judgment_date DATE,
  judgment_amount NUMERIC,
  legal_fees NUMERIC DEFAULT 0,
  assigned_lawyer TEXT,
  lawyer_contact TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create court_case_events table
CREATE TABLE public.court_case_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  court_case_id UUID NOT NULL REFERENCES public.court_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT,
  outcome TEXT,
  next_action TEXT,
  next_action_date DATE,
  documents_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment_splits table for split repayments
CREATE TABLE public.payment_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repayment_id UUID NOT NULL REFERENCES public.loan_repayments(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  transaction_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create push_subscriptions table for push notifications
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS on all tables
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Wallet accounts policies
CREATE POLICY "Users can view their own wallet" ON public.wallet_accounts
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage wallets" ON public.wallet_accounts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Wallet transactions policies
CREATE POLICY "Users can view their wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wallet_accounts wa WHERE wa.id = wallet_transactions.wallet_id AND wa.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can manage wallet transactions" ON public.wallet_transactions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Court cases policies
CREATE POLICY "Staff can view court cases" ON public.court_cases
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'collections_officer'::app_role) OR has_role(auth.uid(), 'loan_officer'::app_role)
  );

CREATE POLICY "Admins can manage court cases" ON public.court_cases
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Court case events policies
CREATE POLICY "Staff can view court case events" ON public.court_case_events
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'collections_officer'::app_role)
  );

CREATE POLICY "Admins can manage court case events" ON public.court_case_events
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Payment splits policies
CREATE POLICY "Staff can view payment splits" ON public.payment_splits
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'finance_officer'::app_role)
  );

CREATE POLICY "Admins can manage payment splits" ON public.payment_splits
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Push subscriptions policies
CREATE POLICY "Users can manage their push subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view push subscriptions" ON public.push_subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_wallet_accounts_user_id ON public.wallet_accounts(user_id);
CREATE INDEX idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX idx_court_cases_loan_id ON public.court_cases(loan_id);
CREATE INDEX idx_court_cases_status ON public.court_cases(status);
CREATE INDEX idx_court_case_events_case_id ON public.court_case_events(court_case_id);
CREATE INDEX idx_payment_splits_repayment_id ON public.payment_splits(repayment_id);
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Create trigger for updated_at on wallet_accounts
CREATE TRIGGER update_wallet_accounts_updated_at
  BEFORE UPDATE ON public.wallet_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on court_cases
CREATE TRIGGER update_court_cases_updated_at
  BEFORE UPDATE ON public.court_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on push_subscriptions
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20260109100148_f6e6ee77-64b0-4979-97a1-071c2d043aef.sql ==========

-- Add term_unit column to loan_products table to support daily/weekly/monthly/yearly terms
ALTER TABLE public.loan_products 
ADD COLUMN IF NOT EXISTS term_unit text NOT NULL DEFAULT 'months';

-- Add comment for documentation
COMMENT ON COLUMN public.loan_products.term_unit IS 'Unit for loan term: days, weeks, months, or years';

-- Also add term_unit to loan_applications to store the selected unit when loan is created
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS term_unit text NOT NULL DEFAULT 'months';

COMMENT ON COLUMN public.loan_applications.term_unit IS 'Unit for loan term: days, weeks, months, or years';

-- ========== 20260109230807_8a3ea80c-ff21-46d4-9d04-f2bbde29cd7d.sql ==========

-- Add brevo_whatsapp_templates table for managing WhatsApp template mappings
CREATE TABLE IF NOT EXISTS public.brevo_whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL UNIQUE,
  template_id TEXT NOT NULL,
  template_name TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brevo_whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
CREATE POLICY "Admins can manage whatsapp templates"
  ON public.brevo_whatsapp_templates
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_brevo_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.brevo_whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default event types
INSERT INTO public.brevo_whatsapp_templates (event_type, template_id, template_name, description) VALUES
  ('otp', '', 'OTP Verification', 'Template for sending OTP codes'),
  ('loan_approval', '', 'Loan Approved', 'Template for loan approval notifications'),
  ('loan_rejection', '', 'Loan Rejected', 'Template for loan rejection notifications'),
  ('disbursement', '', 'Disbursement Confirmation', 'Template for disbursement confirmations'),
  ('payment_received', '', 'Payment Received', 'Template for payment confirmations'),
  ('payment_reminder', '', 'Payment Reminder', 'Template for payment due reminders'),
  ('overdue_notice', '', 'Overdue Notice', 'Template for overdue payment notices'),
  ('loan_completion', '', 'Loan Completion', 'Template for loan completion congratulations'),
  ('welcome', '', 'Welcome Message', 'Template for welcoming new users')
ON CONFLICT (event_type) DO NOTHING;

-- ========== 20260110174344_9c2511f8-76c4-4421-b7bb-9a84f2ef7350.sql ==========

-- 1. Add eligible_locations column to loan_products for location control
ALTER TABLE public.loan_products 
ADD COLUMN IF NOT EXISTS eligible_locations text[] DEFAULT NULL;

-- Comment: NULL means nationwide, specific values like ['Lusaka', 'Kitwe'] restrict eligibility

-- 2. Add payslip_password field to loan_applications for payslip password verification
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS payslip_password text DEFAULT NULL;

-- 3. Add signed_contract_url column for borrower contract uploads
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS signed_contract_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS signed_contract_uploaded_at timestamp with time zone DEFAULT NULL;

-- 4. Add legal_fees to loan_applications for tracking legal deductions
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS legal_fees numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS enforcement_fees numeric DEFAULT 0;

-- 5. Update court_cases table to add more fields for full case management
ALTER TABLE public.court_cases
ADD COLUMN IF NOT EXISTS plaintiff_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS defendant_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS claim_amount numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recovered_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS court_location text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_hearing_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS enforcement_status text DEFAULT 'pending';

-- ========== 20260112183357_f24f7235-69bb-4d65-86ca-f3f22fd1c07e.sql ==========

-- Update loan products to set the 10% legal fee (platform_fee_percent)
UPDATE public.loan_products 
SET platform_fee_percent = 10 
WHERE is_active = true AND (platform_fee_percent IS NULL OR platform_fee_percent = 0);

-- Ensure processing fee is set correctly (2.5%)
UPDATE public.loan_products 
SET processing_fee_percent = 2.5 
WHERE is_active = true AND (processing_fee_percent IS NULL OR processing_fee_percent = 0);

-- ========== 20260115_hr_payroll_system.sql ==========

-- HR and Payroll System for Phindu Loans Internal Employees
-- Date: 2026-01-15
-- Description: Complete HR and Payroll system compliant with Zambian labor and tax standards

-- 1. Employee Records Table
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to auth user if exists
  employee_number TEXT NOT NULL UNIQUE, -- Unique employee ID (e.g., PHINDU-001)
  title TEXT CHECK (title IN ('Mr', 'Mrs', 'Ms', 'Dr', 'Prof')), -- Salutation
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  nrc_number TEXT NOT NULL UNIQUE, -- Zambian NRC
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
  
  -- Contact Information
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  alternative_phone TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT, -- Zambian province
  postal_code TEXT,
  
  -- Employment Details
  employment_type TEXT NOT NULL CHECK (employment_type IN ('permanent', 'contract', 'temporary', 'intern')),
  department TEXT, -- e.g., 'Finance', 'Operations', 'IT', 'HR'
  position TEXT NOT NULL, -- Job title
  job_grade TEXT, -- e.g., 'A1', 'B2', 'C3'
  reporting_manager_id UUID REFERENCES public.employees(id), -- Self-referencing for hierarchy
  employment_start_date DATE NOT NULL,
  employment_end_date DATE, -- For contract employees
  probation_end_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Zambian Tax & Social Security
  napsa_number TEXT, -- NAPSA membership number
  tax_pin TEXT, -- ZRA Tax PIN
  nhima_number TEXT, -- National Health Insurance Membership Authority
  
  -- Banking Details
  bank_name TEXT,
  bank_account_number TEXT,
  bank_branch TEXT,
  mobile_money_number TEXT, -- For salary payment via mobile money
  
  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone TEXT,
  
  -- Documents
  nrc_front_url TEXT,
  nrc_back_url TEXT,
  contract_url TEXT,
  photo_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- 2. Salary Structure Table
CREATE TABLE IF NOT EXISTS public.employee_salary_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL, -- When this salary structure becomes active
  expiry_date DATE, -- When it expires (NULL for current)
  
  -- Basic Salary Components
  basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0, -- Base salary
  housing_allowance NUMERIC(12, 2) DEFAULT 0,
  transport_allowance NUMERIC(12, 2) DEFAULT 0,
  meal_allowance NUMERIC(12, 2) DEFAULT 0,
  medical_allowance NUMERIC(12, 2) DEFAULT 0,
  communication_allowance NUMERIC(12, 2) DEFAULT 0,
  other_allowances NUMERIC(12, 2) DEFAULT 0,
  
  -- Calculated Totals
  gross_salary NUMERIC(12, 2) GENERATED ALWAYS AS (
    basic_salary + 
    COALESCE(housing_allowance, 0) + 
    COALESCE(transport_allowance, 0) + 
    COALESCE(meal_allowance, 0) + 
    COALESCE(medical_allowance, 0) + 
    COALESCE(communication_allowance, 0) + 
    COALESCE(other_allowances, 0)
  ) STORED,
  
  -- Deductions (Fixed amounts)
  napsa_employee_contribution NUMERIC(12, 2) DEFAULT 0, -- 5% of gross (capped)
  nhima_contribution NUMERIC(12, 2) DEFAULT 0, -- NHIMA contribution
  union_dues NUMERIC(12, 2) DEFAULT 0,
  loan_deductions NUMERIC(12, 2) DEFAULT 0, -- Internal loan repayments
  other_deductions NUMERIC(12, 2) DEFAULT 0,
  
  -- Tax Information
  paye_amount NUMERIC(12, 2) DEFAULT 0, -- Calculated PAYE
  tax_relief NUMERIC(12, 2) DEFAULT 0, -- Personal relief, etc.
  
  -- Net Salary (calculated)
  net_salary NUMERIC(12, 2) GENERATED ALWAYS AS (
    gross_salary - 
    COALESCE(napsa_employee_contribution, 0) - 
    COALESCE(nhima_contribution, 0) - 
    COALESCE(union_dues, 0) - 
    COALESCE(loan_deductions, 0) - 
    COALESCE(other_deductions, 0) - 
    COALESCE(paye_amount, 0) + 
    COALESCE(tax_relief, 0)
  ) STORED,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Payroll Periods Table
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name TEXT NOT NULL, -- e.g., "January 2026"
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'bi-weekly', 'weekly')),
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  pay_date DATE NOT NULL, -- When employees will be paid
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'approved', 'paid', 'cancelled')),
  total_gross NUMERIC(12, 2) DEFAULT 0,
  total_deductions NUMERIC(12, 2) DEFAULT 0,
  total_net NUMERIC(12, 2) DEFAULT 0,
  total_employees INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Payroll Records (Individual employee payroll for each period)
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- Salary Components (snapshot at time of payroll)
  basic_salary NUMERIC(12, 2) NOT NULL,
  housing_allowance NUMERIC(12, 2) DEFAULT 0,
  transport_allowance NUMERIC(12, 2) DEFAULT 0,
  meal_allowance NUMERIC(12, 2) DEFAULT 0,
  medical_allowance NUMERIC(12, 2) DEFAULT 0,
  communication_allowance NUMERIC(12, 2) DEFAULT 0,
  other_allowances NUMERIC(12, 2) DEFAULT 0,
  overtime_amount NUMERIC(12, 2) DEFAULT 0,
  bonus_amount NUMERIC(12, 2) DEFAULT 0,
  commission_amount NUMERIC(12, 2) DEFAULT 0,
  
  -- Gross Salary
  gross_salary NUMERIC(12, 2) NOT NULL,
  
  -- Zambian Statutory Deductions
  napsa_employee NUMERIC(12, 2) DEFAULT 0, -- 5% of gross (capped at threshold)
  napsa_employer NUMERIC(12, 2) DEFAULT 0, -- 5% employer contribution
  nhima_contribution NUMERIC(12, 2) DEFAULT 0,
  paye_tax NUMERIC(12, 2) DEFAULT 0, -- Calculated PAYE based on ZRA brackets
  
  -- Other Deductions
  union_dues NUMERIC(12, 2) DEFAULT 0,
  loan_deductions NUMERIC(12, 2) DEFAULT 0,
  advance_deductions NUMERIC(12, 2) DEFAULT 0, -- Salary advances
  other_deductions NUMERIC(12, 2) DEFAULT 0,
  
  -- Totals
  total_deductions NUMERIC(12, 2) GENERATED ALWAYS AS (
    COALESCE(napsa_employee, 0) + 
    COALESCE(nhima_contribution, 0) + 
    COALESCE(paye_tax, 0) + 
    COALESCE(union_dues, 0) + 
    COALESCE(loan_deductions, 0) + 
    COALESCE(advance_deductions, 0) + 
    COALESCE(other_deductions, 0)
  ) STORED,
  
  net_salary NUMERIC(12, 2) GENERATED ALWAYS AS (
    gross_salary - (
      COALESCE(napsa_employee, 0) + 
      COALESCE(nhima_contribution, 0) + 
      COALESCE(paye_tax, 0) + 
      COALESCE(union_dues, 0) + 
      COALESCE(loan_deductions, 0) + 
      COALESCE(advance_deductions, 0) + 
      COALESCE(other_deductions, 0)
    )
  ) STORED,
  
  -- Payment Details
  payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'mobile_money', 'cash', 'cheque')),
  payment_reference TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processed', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,
  
  -- Leave Deductions
  unpaid_leave_days NUMERIC(5, 2) DEFAULT 0,
  leave_deduction_amount NUMERIC(12, 2) DEFAULT 0,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(payroll_period_id, employee_id) -- One record per employee per period
);

-- 5. Leave Management
CREATE TABLE IF NOT EXISTS public.employee_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'compassionate', 'study', 'unpaid')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_taken NUMERIC(5, 2) NOT NULL, -- Can be fractional (half days)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Leave Balances
CREATE TABLE IF NOT EXISTS public.employee_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'compassionate', 'study')),
  year INTEGER NOT NULL, -- e.g., 2026
  allocated_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  used_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  balance_days NUMERIC(5, 2) GENERATED ALWAYS AS (allocated_days - used_days) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, leave_type, year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_number ON public.employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_nrc ON public.employees(nrc_number);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON public.employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employee_salary_structure_employee_id ON public.employee_salary_structure(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_salary_structure_effective_date ON public.employee_salary_structure(effective_date);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON public.payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_period_start ON public.payroll_periods(period_start_date);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period_id ON public.payroll_records(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON public.payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_employee_id ON public.employee_leave(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_status ON public.employee_leave(status);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "Admins can manage employees"
  ON public.employees FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR staff can view employees"
  ON public.employees FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Employees can view their own record"
  ON public.employees FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for salary structure
CREATE POLICY "Admins can manage salary structures"
  ON public.employee_salary_structure FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Finance staff can view salary structures"
  ON public.employee_salary_structure FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

-- RLS Policies for payroll periods
CREATE POLICY "Admins and finance can manage payroll periods"
  ON public.payroll_periods FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

-- RLS Policies for payroll records
CREATE POLICY "Admins and finance can manage payroll records"
  ON public.payroll_records FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Employees can view their own payroll records"
  ON public.payroll_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = payroll_records.employee_id 
      AND e.user_id = auth.uid()
    )
  );

-- RLS Policies for leave
CREATE POLICY "Admins can manage all leave"
  ON public.employee_leave FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Employees can view their own leave"
  ON public.employee_leave FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = employee_leave.employee_id 
      AND e.user_id = auth.uid()
    )
  );

-- RLS Policies for leave balances
CREATE POLICY "Admins can manage leave balances"
  ON public.employee_leave_balances FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Employees can view their own leave balances"
  ON public.employee_leave_balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = employee_leave_balances.employee_id 
      AND e.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_salary_structure_updated_at
  BEFORE UPDATE ON public.employee_salary_structure
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_records_updated_at
  BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_leave_updated_at
  BEFORE UPDATE ON public.employee_leave
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_leave_balances_updated_at
  BEFORE UPDATE ON public.employee_leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate employee number
CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  last_number INTEGER;
BEGIN
  -- Get the last employee number
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_number FROM 'PHINDU-(\d+)') AS INTEGER)), 0)
  INTO last_number
  FROM public.employees
  WHERE employee_number ~ '^PHINDU-\d+$';
  
  -- Generate new number
  new_number := 'PHINDU-' || LPAD((last_number + 1)::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE public.employees IS 'Internal employee records for Phindu Loans staff';
COMMENT ON TABLE public.employee_salary_structure IS 'Salary structure and components for each employee';
COMMENT ON TABLE public.payroll_periods IS 'Payroll processing periods (monthly, bi-weekly, etc.)';
COMMENT ON TABLE public.payroll_records IS 'Individual payroll records for each employee per period';
COMMENT ON TABLE public.employee_leave IS 'Employee leave applications and records';
COMMENT ON TABLE public.employee_leave_balances IS 'Annual leave balances for employees';

COMMENT ON COLUMN public.employees.napsa_number IS 'NAPSA (National Pension Scheme Authority) membership number';
COMMENT ON COLUMN public.employees.tax_pin IS 'ZRA (Zambia Revenue Authority) Tax PIN';
COMMENT ON COLUMN public.employees.nhima_number IS 'NHIMA (National Health Insurance Membership Authority) number';
COMMENT ON COLUMN public.employee_salary_structure.napsa_employee_contribution IS 'NAPSA employee contribution (5% of gross, capped at threshold)';
COMMENT ON COLUMN public.payroll_records.paye_tax IS 'PAYE (Pay As You Earn) tax calculated based on ZRA tax brackets';
COMMENT ON COLUMN public.payroll_records.napsa_employee IS 'NAPSA employee contribution for this period';
COMMENT ON COLUMN public.payroll_records.napsa_employer IS 'NAPSA employer contribution (5% of gross)';


-- ========== 20260115_user_notification_preferences.sql ==========

-- Migration: Add user notification preferences to profiles table
-- Date: 2026-01-15
-- Description: Adds notification preference columns to profiles table for user-specific notification settings

-- Add notification preference columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_reminders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_reminders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS payment_alerts boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS marketing boolean DEFAULT false;

-- Add comments
COMMENT ON COLUMN public.profiles.email_reminders IS 'User preference for receiving email payment reminders';
COMMENT ON COLUMN public.profiles.sms_reminders IS 'User preference for receiving SMS payment reminders';
COMMENT ON COLUMN public.profiles.payment_alerts IS 'User preference for receiving payment confirmation alerts';
COMMENT ON COLUMN public.profiles.marketing IS 'User preference for receiving marketing and promotional notifications';


-- ========== 20260116214243_81bc24eb-30cf-4300-8e30-65c3d8f7c606.sql ==========

-- Add notification preference columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_reminders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_reminders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS payment_alerts boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS marketing boolean DEFAULT false;

-- Add comments
COMMENT ON COLUMN public.profiles.email_reminders IS 'User preference for receiving email payment reminders';
COMMENT ON COLUMN public.profiles.sms_reminders IS 'User preference for receiving SMS payment reminders';
COMMENT ON COLUMN public.profiles.payment_alerts IS 'User preference for receiving payment confirmation alerts';
COMMENT ON COLUMN public.profiles.marketing IS 'User preference for receiving marketing and promotional notifications';

-- ========== 20260117_auto_notifications_and_enhancements.sql ==========

-- Migration: Automatic notifications, multiple collateral images, and contract template enhancements
-- Date: 2026-01-17
-- Description: 
--  1. Adds database triggers for automatic email/SMS notifications on loan events
--  2. Adds support for multiple collateral images (up to 3+)
--  3. Adds contract_template_files table for DOCX uploads

-- ============================================================================
-- 1. MULTIPLE COLLATERAL IMAGES SUPPORT
-- ============================================================================

-- Add additional collateral image columns to loan_applications
ALTER TABLE loan_applications 
  ADD COLUMN IF NOT EXISTS collateral_image_2_url TEXT,
  ADD COLUMN IF NOT EXISTS collateral_image_3_url TEXT;

COMMENT ON COLUMN loan_applications.collateral_image_2_url IS 'Second collateral image URL';
COMMENT ON COLUMN loan_applications.collateral_image_3_url IS 'Third collateral image URL';

-- Create table for additional collateral images (for dynamic support)
CREATE TABLE IF NOT EXISTS loan_collateral_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_order INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collateral_images_loan_id ON loan_collateral_images(loan_application_id);

COMMENT ON TABLE loan_collateral_images IS 'Stores additional collateral images for loan applications (beyond the first 3)';

-- ============================================================================
-- 2. CONTRACT TEMPLATE DOCX UPLOAD SUPPORT
-- ============================================================================

-- Add file_url column to contract templates (for DOCX uploads)
ALTER TABLE contract_templates 
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'text' CHECK (file_type IN ('text', 'docx'));

COMMENT ON COLUMN contract_templates.file_url IS 'URL to uploaded DOCX template file';
COMMENT ON COLUMN contract_templates.file_type IS 'Type of template: text (plain text) or docx (uploaded file)';

-- ============================================================================
-- 3. AUTOMATIC NOTIFICATION TRIGGERS
-- ============================================================================

-- Function to send notification via edge function
CREATE OR REPLACE FUNCTION send_notification_via_edge_function(
  p_user_id UUID,
  p_type TEXT,
  p_recipient TEXT,
  p_title TEXT,
  p_message TEXT,
  p_subject TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Call the edge function via HTTP (using pg_net if available, otherwise log)
  -- Note: This requires pg_net extension or we can use Supabase's built-in HTTP functions
  -- For now, we'll log the notification request and it can be processed by a background job
  -- or the edge function can be called directly from the application layer
  
  -- Insert into notification_logs for tracking
  INSERT INTO notification_logs (
    user_id,
    type,
    recipient,
    title,
    message,
    subject,
    status,
    created_at
  ) VALUES (
    p_user_id,
    p_type,
    p_recipient,
    p_title,
    p_message,
    p_subject,
    'pending',
    NOW()
  );
  
  -- The actual sending will be handled by the application layer or a background job
  -- that reads from notification_logs where status = 'pending'
END;
$$;

COMMENT ON FUNCTION send_notification_via_edge_function IS 'Logs notification request for processing by edge function or background job';

-- Function to trigger notification on loan status change
CREATE OR REPLACE FUNCTION notify_loan_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_loan_amount NUMERIC;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get borrower details
    SELECT email, phone, full_name, loan_amount
    INTO v_borrower_email, v_borrower_phone, v_borrower_name, v_loan_amount
    FROM loan_applications
    WHERE id = NEW.id;
    
    -- Loan Approved
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      -- Email notification
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'email',
          v_borrower_email,
          'Loan Approved',
          format('Congratulations %s! Your loan application for K%s has been APPROVED. Funds will be disbursed shortly.', 
                 v_borrower_name, v_loan_amount::TEXT),
          format('Loan Approved - K%s', v_loan_amount::TEXT),
          'loan_approval'
        );
        
        -- SMS alert to check email
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id,
            'sms',
            v_borrower_phone,
            'Loan Approved',
            format('Dear %s, your loan application has been APPROVED. Please check your email for details. - Phindu Finance', v_borrower_name),
            NULL,
            'loan_approval'
          );
        END IF;
      END IF;
      
      -- SMS notification (if no email)
      IF v_borrower_phone IS NOT NULL AND v_borrower_email IS NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'sms',
          v_borrower_phone,
          'Loan Approved',
          format('Congratulations %s! Your loan application for K%s has been APPROVED. Funds will be disbursed shortly. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          NULL,
          'loan_approval'
        );
      END IF;
    END IF;
    
    -- Loan Rejected
    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'email',
          v_borrower_email,
          'Loan Application Update',
          format('Dear %s, we regret to inform you that your loan application was not approved at this time. Please contact us for more information. - Phindu Finance', v_borrower_name),
          'Loan Application Update',
          'loan_rejection'
        );
        
        -- SMS alert to check email
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id,
            'sms',
            v_borrower_phone,
            'Loan Application Update',
            format('Dear %s, please check your email regarding your loan application status. - Phindu Finance', v_borrower_name),
            NULL,
            'loan_rejection'
          );
        END IF;
      END IF;
    END IF;
    
    -- Loan Completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'email',
          v_borrower_email,
          'Loan Completed',
          format('Congratulations %s! You have successfully completed all loan repayments. Your account is now clear. Thank you for banking with Phindu Finance!', v_borrower_name),
          'Loan Completed - Congratulations!',
          'loan_completion'
        );
        
        -- SMS alert
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id,
            'sms',
            v_borrower_phone,
            'Loan Completed',
            format('Congratulations %s! Your loan has been fully repaid. Check your email for clearance certificate. - Phindu Finance', v_borrower_name),
            NULL,
            'loan_completion'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for loan status changes
DROP TRIGGER IF EXISTS trigger_notify_loan_status_change ON loan_applications;
CREATE TRIGGER trigger_notify_loan_status_change
  AFTER UPDATE OF status ON loan_applications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_loan_status_change();

-- Function to notify on disbursement
CREATE OR REPLACE FUNCTION notify_disbursement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loan_record RECORD;
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
BEGIN
  -- Only trigger when disbursement is completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get loan details
    SELECT la.email, la.phone, la.full_name, la.user_id
    INTO v_borrower_email, v_borrower_phone, v_borrower_name, v_loan_record.user_id
    FROM loan_applications la
    WHERE la.id = NEW.loan_id;
    
    v_loan_record.user_id := (SELECT user_id FROM loan_applications WHERE id = NEW.loan_id);
    
    -- Email notification
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_loan_record.user_id,
        'email',
        v_borrower_email,
        'Disbursement Confirmation',
        format('Dear %s, K%s has been disbursed to your account. Ref: %s. Your first repayment will be due in 30 days. - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, COALESCE(NEW.transaction_reference, 'N/A')),
        format('Loan Disbursed - K%s', NEW.amount::TEXT),
        'disbursement'
      );
      
      -- SMS alert to check email
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_loan_record.user_id,
          'sms',
          v_borrower_phone,
          'Disbursement Confirmation',
          format('Dear %s, K%s has been disbursed. Please check your email for details. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT),
          NULL,
          'disbursement'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for disbursements
DROP TRIGGER IF EXISTS trigger_notify_disbursement ON disbursements;
CREATE TRIGGER trigger_notify_disbursement
  AFTER UPDATE OF status ON disbursements
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION notify_disbursement();

-- Function to notify on payment received
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loan_record RECORD;
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_remaining_balance NUMERIC;
BEGIN
  -- Only trigger when payment is marked as paid
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Get loan and borrower details
    SELECT 
      la.email, 
      la.phone, 
      la.full_name, 
      la.user_id,
      la.total_repayment,
      (SELECT COALESCE(SUM(amount), 0) FROM loan_repayments WHERE loan_id = la.id AND status = 'paid') as total_paid
    INTO v_loan_record
    FROM loan_applications la
    WHERE la.id = NEW.loan_id;
    
    v_borrower_email := (SELECT email FROM loan_applications WHERE id = NEW.loan_id);
    v_borrower_phone := (SELECT phone FROM loan_applications WHERE id = NEW.loan_id);
    v_borrower_name := (SELECT full_name FROM loan_applications WHERE id = NEW.loan_id);
    v_remaining_balance := GREATEST(0, v_loan_record.total_repayment - COALESCE(v_loan_record.total_paid, 0));
    
    -- Email notification
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_loan_record.user_id,
        'email',
        v_borrower_email,
        'Payment Received',
        format('Dear %s, we have received your payment of K%s. Remaining balance: K%s. Thank you! - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
        format('Payment Received - K%s', NEW.amount::TEXT),
        'payment_received'
      );
      
      -- SMS alert to check email
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_loan_record.user_id,
          'sms',
          v_borrower_phone,
          'Payment Received',
          format('Dear %s, payment of K%s received. Remaining: K%s. Check email for receipt. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
          NULL,
          'payment_received'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for payments
DROP TRIGGER IF EXISTS trigger_notify_payment_received ON loan_repayments;
CREATE TRIGGER trigger_notify_payment_received
  AFTER UPDATE OF status ON loan_repayments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid')
  EXECUTE FUNCTION notify_payment_received();

-- ============================================================================
-- 4. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON loan_collateral_images TO authenticated;
GRANT SELECT, INSERT, UPDATE ON contract_templates TO authenticated;

COMMENT ON FUNCTION notify_loan_status_change IS 'Automatically sends notifications when loan status changes (approved, rejected, completed)';
COMMENT ON FUNCTION notify_disbursement IS 'Automatically sends notifications when loan is disbursed';
COMMENT ON FUNCTION notify_payment_received IS 'Automatically sends notifications when payment is received';


-- ========== 20260117_fix_weekly_payments_and_deletions.sql ==========

-- Migration: Fix weekly payment schedules, interest calculations, and add deletion restrictions
-- Date: 2026-01-17
-- Description: 
--  1. Update repayment schedule generation to support weekly payments
--  2. Fix interest calculations for weekly loans
--  3. Add restrictions for loan and borrower deletion

-- ============================================================================
-- 1. UPDATE REPAYMENT SCHEDULE GENERATION FOR WEEKLY PAYMENTS
-- ============================================================================

-- Update the generate_repayment_schedule function to support weekly payments
CREATE OR REPLACE FUNCTION public.generate_repayment_schedule()
RETURNS TRIGGER AS $$
DECLARE
  loan_record RECORD;
  product_record RECORD;
  payment_amount NUMERIC;
  due_date DATE;
  i INTEGER;
  num_installments INTEGER;
  payment_interval INTERVAL;
  term_unit TEXT;
  interest_period TEXT;
  repayment_frequency TEXT;
  is_weekly BOOLEAN;
  is_daily BOOLEAN;
BEGIN
  -- Only run when status changes to 'completed' (disbursement completed)
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get loan details
    SELECT * INTO loan_record FROM public.loan_applications WHERE id = NEW.loan_id;
    
    IF loan_record IS NOT NULL THEN
      -- Get product details to check term_unit, interest_period, and repayment_frequency
      SELECT term_unit, interest_period, repayment_frequency INTO product_record
      FROM public.loan_products 
      WHERE id = loan_record.loan_product_id;
      
      -- Determine payment frequency
      term_unit := COALESCE(loan_record.term_unit, product_record.term_unit, 'months');
      interest_period := COALESCE(product_record.interest_period, 'monthly');
      repayment_frequency := COALESCE(product_record.repayment_frequency, 'monthly');
      
      -- Check payment frequency (daily, weekly, or monthly)
      is_weekly := (term_unit = 'weeks') OR 
                   (term_unit = 'months' AND (interest_period = 'weekly' OR repayment_frequency = 'weekly'));
      is_daily := (term_unit = 'days') OR 
                  (term_unit = 'months' AND (interest_period = 'daily' OR repayment_frequency = 'daily'));
      
      -- Calculate payment amount and interval
      IF is_daily THEN
        -- For daily loans
        payment_amount := loan_record.monthly_payment;
        IF payment_amount IS NULL OR payment_amount = 0 THEN
          IF term_unit = 'days' THEN
            payment_amount := loan_record.total_repayment / loan_record.loan_term_months;
          ELSE
            -- If term_unit is months but frequency is daily, convert
            payment_amount := (loan_record.total_repayment / loan_record.loan_term_months) / 30;
          END IF;
        ELSE
          payment_amount := payment_amount / 30;
        END IF;
        
        payment_interval := INTERVAL '1 day';
        num_installments := CASE 
          WHEN term_unit = 'days' THEN loan_record.loan_term_months
          ELSE loan_record.loan_term_months * 30
        END;
      ELSIF is_weekly THEN
        -- For weekly loans
        payment_amount := loan_record.monthly_payment;
        IF payment_amount IS NULL OR payment_amount = 0 THEN
          IF term_unit = 'weeks' THEN
            payment_amount := loan_record.total_repayment / loan_record.loan_term_months;
          ELSE
            -- If term_unit is months but frequency is weekly, convert
            payment_amount := (loan_record.total_repayment / loan_record.loan_term_months) / 4.33;
          END IF;
        ELSE
          payment_amount := payment_amount / 4.33;
        END IF;
        
        payment_interval := INTERVAL '7 days';
        num_installments := CASE 
          WHEN term_unit = 'weeks' THEN loan_record.loan_term_months
          ELSE loan_record.loan_term_months * 4
        END;
      ELSE
        -- For monthly loans
        payment_amount := loan_record.monthly_payment;
        IF payment_amount IS NULL OR payment_amount = 0 THEN
          payment_amount := loan_record.total_repayment / loan_record.loan_term_months;
        END IF;
        
        payment_interval := INTERVAL '1 month';
        num_installments := loan_record.loan_term_months;
      END IF;
      
      -- Generate repayment schedule
      FOR i IN 1..num_installments LOOP
        IF i = 1 THEN
          -- First payment due date
          IF is_daily THEN
            due_date := (CURRENT_DATE + INTERVAL '1 day')::DATE;
          ELSIF is_weekly THEN
            due_date := (CURRENT_DATE + INTERVAL '7 days')::DATE;
          ELSE
            due_date := (CURRENT_DATE + INTERVAL '1 month')::DATE;
          END IF;
        ELSE
          -- Subsequent payments
          due_date := (CURRENT_DATE + (i * payment_interval))::DATE;
        END IF;
        
        INSERT INTO public.loan_repayments (
          loan_id,
          user_id,
          amount,
          due_date,
          status,
          installment_number
        ) VALUES (
          NEW.loan_id,
          loan_record.user_id,
          payment_amount,
          due_date,
          'pending',
          i
        );
      END LOOP;
      
      -- Update loan status to active
      UPDATE public.loan_applications 
      SET status = 'active' 
      WHERE id = NEW.loan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. ADD FUNCTION TO CHECK IF LOAN CAN BE DELETED
-- ============================================================================

-- Function to check if a loan can be deleted (only pending, rejected, or under_review)
CREATE OR REPLACE FUNCTION public.can_delete_loan(p_loan_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  loan_status TEXT;
BEGIN
  SELECT status INTO loan_status
  FROM public.loan_applications
  WHERE id = p_loan_id;
  
  -- Only allow deletion if loan is not approved or disbursed
  RETURN loan_status IN ('pending', 'rejected', 'under_review');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. ADD FUNCTION TO CHECK IF BORROWER CAN BE DELETED
-- ============================================================================

-- Function to check if a borrower can be deleted (no active loans)
CREATE OR REPLACE FUNCTION public.can_delete_borrower(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  active_loans_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_loans_count
  FROM public.loan_applications
  WHERE user_id = p_user_id
    AND status IN ('active', 'disbursed', 'approved', 'completed');
  
  -- Only allow deletion if borrower has no active loans
  RETURN active_loans_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. ADD RLS POLICIES FOR DELETION RESTRICTIONS
-- ============================================================================

-- Policy to prevent deletion of loans that are approved or disbursed
-- This will be enforced at the application level, but we add a comment for documentation
COMMENT ON FUNCTION public.can_delete_loan IS 'Checks if a loan can be deleted. Returns true only for pending, rejected, or under_review loans.';

COMMENT ON FUNCTION public.can_delete_borrower IS 'Checks if a borrower can be deleted. Returns true only if borrower has no active, disbursed, approved, or completed loans.';

-- ============================================================================
-- 5. UPDATE COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.generate_repayment_schedule IS 'Generates repayment schedule for loans. Supports both weekly and monthly payment frequencies based on term_unit and interest_period.';


-- ========== 20260117_notification_queue_enhancements.sql ==========

-- Migration: Notification Queue Processing Enhancements
-- Date: 2026-01-17
-- Description: Adds retry_count column and indexes for notification queue processing

-- Add retry_count column to notification_logs if not exists
ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for pending notifications (for queue processor)
CREATE INDEX IF NOT EXISTS idx_notification_logs_pending ON notification_logs(status, created_at) 
  WHERE status = 'pending';

-- Create index for retry processing
CREATE INDEX IF NOT EXISTS idx_notification_logs_retry ON notification_logs(status, retry_count, created_at)
  WHERE status = 'pending' AND retry_count < 3;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notification_logs_updated_at ON notification_logs;
CREATE TRIGGER trigger_update_notification_logs_updated_at
  BEFORE UPDATE ON notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_logs_updated_at();

-- Create function to get notification queue stats
CREATE OR REPLACE FUNCTION get_notification_queue_stats()
RETURNS TABLE (
  pending_count BIGINT,
  failed_count BIGINT,
  sent_today BIGINT,
  avg_retry_count NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE status = 'sent' AND DATE(created_at) = CURRENT_DATE) as sent_today,
    ROUND(AVG(retry_count) FILTER (WHERE status = 'pending'), 2) as avg_retry_count
  FROM notification_logs
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_notification_queue_stats IS 'Returns statistics about the notification queue for monitoring';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_notification_queue_stats TO authenticated;


-- ========== 20260121104933_9a9ba221-80e9-469a-8296-eefbbbc778db.sql ==========

-- Migration: Automatic notifications, multiple collateral images, and contract template enhancements
-- Date: 2026-01-21
-- Description: 
--  1. Adds database triggers for automatic email/SMS notifications on loan events
--  2. Adds support for multiple collateral images (up to 3+)
--  3. Adds contract_template_files table for DOCX uploads

-- ============================================================================
-- 1. MULTIPLE COLLATERAL IMAGES SUPPORT
-- ============================================================================

-- Add additional collateral image columns to loan_applications
ALTER TABLE loan_applications 
  ADD COLUMN IF NOT EXISTS collateral_image_2_url TEXT,
  ADD COLUMN IF NOT EXISTS collateral_image_3_url TEXT;

COMMENT ON COLUMN loan_applications.collateral_image_2_url IS 'Second collateral image URL';
COMMENT ON COLUMN loan_applications.collateral_image_3_url IS 'Third collateral image URL';

-- Create table for additional collateral images (for dynamic support)
CREATE TABLE IF NOT EXISTS loan_collateral_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_order INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collateral_images_loan_id ON loan_collateral_images(loan_application_id);

-- Enable RLS on loan_collateral_images
ALTER TABLE loan_collateral_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for loan_collateral_images
CREATE POLICY "Staff can view collateral images" ON loan_collateral_images
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'loan_officer'::app_role) OR
    has_role(auth.uid(), 'credit_officer'::app_role)
  );

CREATE POLICY "Staff can insert collateral images" ON loan_collateral_images
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'loan_officer'::app_role)
  );

CREATE POLICY "Staff can update collateral images" ON loan_collateral_images
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'loan_officer'::app_role)
  );

CREATE POLICY "Admins can delete collateral images" ON loan_collateral_images
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  );

COMMENT ON TABLE loan_collateral_images IS 'Stores additional collateral images for loan applications (beyond the first 3)';

-- ============================================================================
-- 2. CONTRACT TEMPLATE DOCX UPLOAD SUPPORT
-- ============================================================================

-- Add file_url column to contract templates (for DOCX uploads)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_templates' AND table_schema = 'public') THEN
    CREATE TABLE contract_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      content TEXT,
      file_url TEXT,
      file_type TEXT DEFAULT 'text' CHECK (file_type IN ('text', 'docx')),
      is_active BOOLEAN DEFAULT false,
      loan_product_id UUID REFERENCES loan_products(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Staff can manage contract templates" ON contract_templates
      FOR ALL USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'super_admin'::app_role)
      );
  ELSE
    -- Add columns if table exists
    ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS file_url TEXT;
    ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'text';
  END IF;
END $$;

COMMENT ON COLUMN contract_templates.file_url IS 'URL to uploaded DOCX template file';
COMMENT ON COLUMN contract_templates.file_type IS 'Type of template: text (plain text) or docx (uploaded file)';

-- ============================================================================
-- 3. NOTIFICATION LOGS ENHANCEMENTS
-- ============================================================================

-- Add subject column to notification_logs if it doesn't exist
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add INSERT policy for notification_logs so triggers can insert
DROP POLICY IF EXISTS "System can insert notification logs" ON notification_logs;
CREATE POLICY "System can insert notification logs" ON notification_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 4. AUTOMATIC NOTIFICATION TRIGGERS
-- ============================================================================

-- Function to send notification via edge function
CREATE OR REPLACE FUNCTION send_notification_via_edge_function(
  p_user_id UUID,
  p_type TEXT,
  p_recipient TEXT,
  p_title TEXT,
  p_message TEXT,
  p_subject TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into notification_logs for tracking
  INSERT INTO notification_logs (
    user_id,
    type,
    recipient,
    title,
    message,
    subject,
    status,
    created_at
  ) VALUES (
    p_user_id,
    p_type,
    p_recipient,
    p_title,
    p_message,
    p_subject,
    'pending',
    NOW()
  );
END;
$$;

COMMENT ON FUNCTION send_notification_via_edge_function IS 'Logs notification request for processing by edge function or background job';

-- Function to trigger notification on loan status change
CREATE OR REPLACE FUNCTION notify_loan_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_loan_amount NUMERIC;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get borrower details
    v_borrower_email := NEW.email;
    v_borrower_phone := NEW.phone;
    v_borrower_name := NEW.full_name;
    v_loan_amount := NEW.loan_amount;
    
    -- Loan Approved
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'email',
          v_borrower_email,
          'Loan Approved',
          format('Congratulations %s! Your loan application for K%s has been APPROVED. Funds will be disbursed shortly.', 
                 v_borrower_name, v_loan_amount::TEXT),
          format('Loan Approved - K%s', v_loan_amount::TEXT),
          'loan_approval'
        );
        
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id,
            'sms',
            v_borrower_phone,
            'Loan Approved',
            format('Dear %s, your loan application has been APPROVED. Please check your email for details. - Phindu Finance', v_borrower_name),
            NULL,
            'loan_approval'
          );
        END IF;
      ELSIF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'sms',
          v_borrower_phone,
          'Loan Approved',
          format('Congratulations %s! Your loan for K%s has been APPROVED. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          NULL,
          'loan_approval'
        );
      END IF;
    END IF;
    
    -- Loan Rejected
    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'email',
          v_borrower_email,
          'Loan Application Update',
          format('Dear %s, we regret to inform you that your loan application was not approved at this time. Please contact us for more information. - Phindu Finance', v_borrower_name),
          'Loan Application Update',
          'loan_rejection'
        );
        
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id,
            'sms',
            v_borrower_phone,
            'Loan Application Update',
            format('Dear %s, please check your email regarding your loan application status. - Phindu Finance', v_borrower_name),
            NULL,
            'loan_rejection'
          );
        END IF;
      END IF;
    END IF;
    
    -- Loan Completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'email',
          v_borrower_email,
          'Loan Completed',
          format('Congratulations %s! You have successfully completed all loan repayments. Your account is now clear. Thank you for banking with Phindu Finance!', v_borrower_name),
          'Loan Completed - Congratulations!',
          'loan_completion'
        );
        
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id,
            'sms',
            v_borrower_phone,
            'Loan Completed',
            format('Congratulations %s! Your loan has been fully repaid. Check your email for clearance certificate. - Phindu Finance', v_borrower_name),
            NULL,
            'loan_completion'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for loan status changes
DROP TRIGGER IF EXISTS trigger_notify_loan_status_change ON loan_applications;
CREATE TRIGGER trigger_notify_loan_status_change
  AFTER UPDATE OF status ON loan_applications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_loan_status_change();

-- Function to notify on disbursement
CREATE OR REPLACE FUNCTION notify_disbursement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_user_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT la.email, la.phone, la.full_name, la.user_id
    INTO v_borrower_email, v_borrower_phone, v_borrower_name, v_user_id
    FROM loan_applications la
    WHERE la.id = NEW.loan_id;
    
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id,
        'email',
        v_borrower_email,
        'Disbursement Confirmation',
        format('Dear %s, K%s has been disbursed to your account. Ref: %s. Your first repayment will be due in 30 days. - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, COALESCE(NEW.transaction_reference, 'N/A')),
        format('Loan Disbursed - K%s', NEW.amount::TEXT),
        'disbursement'
      );
      
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_user_id,
          'sms',
          v_borrower_phone,
          'Disbursement Confirmation',
          format('Dear %s, K%s has been disbursed. Please check your email for details. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT),
          NULL,
          'disbursement'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for disbursements
DROP TRIGGER IF EXISTS trigger_notify_disbursement ON disbursements;
CREATE TRIGGER trigger_notify_disbursement
  AFTER UPDATE OF status ON disbursements
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION notify_disbursement();

-- Function to notify on payment received
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_user_id UUID;
  v_total_repayment NUMERIC;
  v_total_paid NUMERIC;
  v_remaining_balance NUMERIC;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    SELECT 
      la.email, 
      la.phone, 
      la.full_name, 
      la.user_id,
      la.total_repayment
    INTO v_borrower_email, v_borrower_phone, v_borrower_name, v_user_id, v_total_repayment
    FROM loan_applications la
    WHERE la.id = NEW.loan_id;
    
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM loan_repayments 
    WHERE loan_id = NEW.loan_id AND status = 'paid';
    
    v_remaining_balance := GREATEST(0, COALESCE(v_total_repayment, 0) - v_total_paid);
    
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id,
        'email',
        v_borrower_email,
        'Payment Received',
        format('Dear %s, we have received your payment of K%s. Remaining balance: K%s. Thank you! - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
        format('Payment Received - K%s', NEW.amount::TEXT),
        'payment_received'
      );
      
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_user_id,
          'sms',
          v_borrower_phone,
          'Payment Received',
          format('Dear %s, payment of K%s received. Remaining: K%s. Check email for receipt. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
          NULL,
          'payment_received'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for payments
DROP TRIGGER IF EXISTS trigger_notify_payment_received ON loan_repayments;
CREATE TRIGGER trigger_notify_payment_received
  AFTER UPDATE OF status ON loan_repayments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid')
  EXECUTE FUNCTION notify_payment_received();

COMMENT ON FUNCTION notify_loan_status_change IS 'Automatically sends notifications when loan status changes (approved, rejected, completed)';
COMMENT ON FUNCTION notify_disbursement IS 'Automatically sends notifications when loan is disbursed';
COMMENT ON FUNCTION notify_payment_received IS 'Automatically sends notifications when payment is received';

-- ========== 20260121105011_e7e9dee2-9ae7-425e-b2d7-4f4faf25b4f6.sql ==========

-- Fix security warnings: Set search_path on functions

-- Fix send_notification_via_edge_function
CREATE OR REPLACE FUNCTION send_notification_via_edge_function(
  p_user_id UUID,
  p_type TEXT,
  p_recipient TEXT,
  p_title TEXT,
  p_message TEXT,
  p_subject TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notification_logs (
    user_id,
    type,
    recipient,
    title,
    message,
    subject,
    status,
    created_at
  ) VALUES (
    p_user_id,
    p_type,
    p_recipient,
    p_title,
    p_message,
    p_subject,
    'pending',
    NOW()
  );
END;
$$;

-- Fix notify_loan_status_change
CREATE OR REPLACE FUNCTION notify_loan_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_loan_amount NUMERIC;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_borrower_email := NEW.email;
    v_borrower_phone := NEW.phone;
    v_borrower_name := NEW.full_name;
    v_loan_amount := NEW.loan_amount;
    
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Approved',
          format('Congratulations %s! Your loan application for K%s has been APPROVED. Funds will be disbursed shortly.', 
                 v_borrower_name, v_loan_amount::TEXT),
          format('Loan Approved - K%s', v_loan_amount::TEXT), 'loan_approval'
        );
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id, 'sms', v_borrower_phone, 'Loan Approved',
            format('Dear %s, your loan application has been APPROVED. Please check your email for details. - Phindu Finance', v_borrower_name),
            NULL, 'loan_approval'
          );
        END IF;
      ELSIF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Approved',
          format('Congratulations %s! Your loan for K%s has been APPROVED. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          NULL, 'loan_approval'
        );
      END IF;
    END IF;
    
    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Application Update',
          format('Dear %s, we regret to inform you that your loan application was not approved at this time. Please contact us for more information. - Phindu Finance', v_borrower_name),
          'Loan Application Update', 'loan_rejection'
        );
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id, 'sms', v_borrower_phone, 'Loan Application Update',
            format('Dear %s, please check your email regarding your loan application status. - Phindu Finance', v_borrower_name),
            NULL, 'loan_rejection'
          );
        END IF;
      END IF;
    END IF;
    
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Completed',
          format('Congratulations %s! You have successfully completed all loan repayments. Your account is now clear. Thank you for banking with Phindu Finance!', v_borrower_name),
          'Loan Completed - Congratulations!', 'loan_completion'
        );
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id, 'sms', v_borrower_phone, 'Loan Completed',
            format('Congratulations %s! Your loan has been fully repaid. Check your email for clearance certificate. - Phindu Finance', v_borrower_name),
            NULL, 'loan_completion'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix notify_disbursement
CREATE OR REPLACE FUNCTION notify_disbursement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_user_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT la.email, la.phone, la.full_name, la.user_id
    INTO v_borrower_email, v_borrower_phone, v_borrower_name, v_user_id
    FROM loan_applications la WHERE la.id = NEW.loan_id;
    
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id, 'email', v_borrower_email, 'Disbursement Confirmation',
        format('Dear %s, K%s has been disbursed to your account. Ref: %s. Your first repayment will be due in 30 days. - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, COALESCE(NEW.transaction_reference, 'N/A')),
        format('Loan Disbursed - K%s', NEW.amount::TEXT), 'disbursement'
      );
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_user_id, 'sms', v_borrower_phone, 'Disbursement Confirmation',
          format('Dear %s, K%s has been disbursed. Please check your email for details. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT),
          NULL, 'disbursement'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix notify_payment_received
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_user_id UUID;
  v_total_repayment NUMERIC;
  v_total_paid NUMERIC;
  v_remaining_balance NUMERIC;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    SELECT la.email, la.phone, la.full_name, la.user_id, la.total_repayment
    INTO v_borrower_email, v_borrower_phone, v_borrower_name, v_user_id, v_total_repayment
    FROM loan_applications la WHERE la.id = NEW.loan_id;
    
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM loan_repayments WHERE loan_id = NEW.loan_id AND status = 'paid';
    
    v_remaining_balance := GREATEST(0, COALESCE(v_total_repayment, 0) - v_total_paid);
    
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id, 'email', v_borrower_email, 'Payment Received',
        format('Dear %s, we have received your payment of K%s. Remaining balance: K%s. Thank you! - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
        format('Payment Received - K%s', NEW.amount::TEXT), 'payment_received'
      );
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_user_id, 'sms', v_borrower_phone, 'Payment Received',
          format('Dear %s, payment of K%s received. Remaining: K%s. Check email for receipt. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
          NULL, 'payment_received'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ========== 20260122_unified_application_documents.sql ==========

-- Migration: Unified Application Documents (Phase 1)
-- Extends loan_application_documents for single-doc-model and admin visibility
-- Date: 2026-01-22

-- ============================================================================
-- 1. EXTEND loan_application_documents
-- ============================================================================

ALTER TABLE public.loan_application_documents
  ADD COLUMN IF NOT EXISTS borrower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS doc_label TEXT,
  ADD COLUMN IF NOT EXISTS month_tag TEXT,
  ADD COLUMN IF NOT EXISTS payslip_password TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT DEFAULT 'borrower',
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT;

COMMENT ON COLUMN public.loan_application_documents.borrower_id IS 'Borrower who uploaded (for vault linkage)';
COMMENT ON COLUMN public.loan_application_documents.doc_label IS 'Human-readable label for display';
COMMENT ON COLUMN public.loan_application_documents.month_tag IS 'For payslips: YYYY-MM';
COMMENT ON COLUMN public.loan_application_documents.payslip_password IS 'Password for secured payslip PDFs; admin-only visible';
COMMENT ON COLUMN public.loan_application_documents.uploaded_by IS 'borrower | admin or user id';
COMMENT ON COLUMN public.loan_application_documents.mime_type IS 'e.g. application/pdf, image/jpeg';
COMMENT ON COLUMN public.loan_application_documents.file_name IS 'Original file name';

-- Allow file_url to be nullable for draft/placeholder rows if needed
ALTER TABLE public.loan_application_documents
  ALTER COLUMN file_url DROP NOT NULL;

-- Index for admin listing by application
CREATE INDEX IF NOT EXISTS idx_loan_application_documents_borrower
  ON public.loan_application_documents(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loan_application_documents_type
  ON public.loan_application_documents(loan_application_id, document_type);

-- ============================================================================
-- 2. RLS: Admin can read all docs for applications they can access
-- ============================================================================

-- Ensure staff roles can SELECT (already have "Admins can manage all" which includes SELECT)
-- Add explicit SELECT for credit_officer, finance_officer, auditor if needed
DROP POLICY IF EXISTS "Admins can manage all loan_application_documents" ON public.loan_application_documents;
CREATE POLICY "Admins can manage all loan_application_documents" ON public.loan_application_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'loan_officer', 'credit_officer', 'finance_officer', 'auditor')
    )
  );

-- ============================================================================
-- 3. notification_logs / email log support (for Phase 4 Email Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email_logs" ON public.email_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer', 'credit_officer'))
  );

CREATE POLICY "Service can insert email_logs" ON public.email_logs
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.email_logs IS 'Log of email send attempts for admin Email Log view';

-- ============================================================================
-- 4. BORROWER DOCUMENT VAULT (permanent storage for reuse)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.borrower_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_borrower_documents_user ON public.borrower_documents(user_id);

ALTER TABLE public.borrower_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own borrower_documents" ON public.borrower_documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view borrower_documents" ON public.borrower_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer', 'credit_officer'))
  );

COMMENT ON TABLE public.borrower_documents IS 'Borrower document vault for NRC, proof of residence, etc.; reuse from vault on new applications';


-- ========== 20260126_twilio_notification_enhancements.sql ==========

-- Migration: Twilio Notification Enhancements
-- Date: 2026-01-26
-- Description: Adds new notification event triggers and Twilio-specific settings
--              for comprehensive notification system

-- ============================================================================
-- 1. UPDATE SYSTEM SETTINGS WITH NEW EVENT TRIGGERS
-- ============================================================================

-- Update the notification_providers settings to include new event triggers
-- This uses a merge approach to add new fields without overwriting existing ones
UPDATE system_settings
SET 
  value = value || jsonb_build_object(
    -- Twilio specific settings
    'twilio_messaging_service_sid', COALESCE((value->>'twilio_messaging_service_sid'), ''),
    
    -- New Account & Application triggers
    'notify_on_application_submitted', COALESCE((value->>'notify_on_application_submitted')::boolean, true),
    'notify_on_application_under_review', COALESCE((value->>'notify_on_application_under_review')::boolean, true),
    'notify_on_kyc_verification', COALESCE((value->>'notify_on_kyc_verification')::boolean, true),
    'notify_on_document_request', COALESCE((value->>'notify_on_document_request')::boolean, true),
    
    -- New Loan Status triggers
    'notify_on_loan_restructured', COALESCE((value->>'notify_on_loan_restructured')::boolean, true),
    'notify_on_contract_sent', COALESCE((value->>'notify_on_contract_sent')::boolean, true),
    
    -- New Payment triggers
    'notify_on_partial_payment', COALESCE((value->>'notify_on_partial_payment')::boolean, true),
    'notify_on_collection_escalation', COALESCE((value->>'notify_on_collection_escalation')::boolean, true),
    'notify_on_court_case', COALESCE((value->>'notify_on_court_case')::boolean, true),
    
    -- New Other triggers
    'notify_on_statement_available', COALESCE((value->>'notify_on_statement_available')::boolean, true),
    'notify_on_promotion', COALESCE((value->>'notify_on_promotion')::boolean, false)
  ),
  updated_at = NOW()
WHERE key = 'notification_providers';

-- Insert default if not exists (for fresh installations)
INSERT INTO system_settings (key, value, description, created_at, updated_at)
VALUES (
  'notification_providers',
  jsonb_build_object(
    -- Channel enablement
    'sms_enabled', false,
    'whatsapp_enabled', false,
    'email_enabled', false,
    
    -- Twilio Settings (primary provider)
    'twilio_account_sid', '',
    'twilio_auth_token', '',
    'twilio_phone_number', '',
    'twilio_whatsapp_number', '',
    'twilio_messaging_service_sid', '',
    
    -- SendGrid (Twilio Email)
    'sendgrid_api_key', '',
    'sendgrid_from_email', '',
    'sendgrid_from_name', 'Phindu Finance',
    
    -- Account & Application Events
    'notify_on_signup', true,
    'notify_on_application_submitted', true,
    'notify_on_application_under_review', true,
    'notify_on_kyc_verification', true,
    'notify_on_document_request', true,
    
    -- Loan Status Events
    'notify_on_loan_approval', true,
    'notify_on_loan_rejection', true,
    'notify_on_disbursement', true,
    'notify_on_loan_restructured', true,
    'notify_on_loan_completion', true,
    'notify_on_contract_sent', true,
    
    -- Payment Events
    'notify_on_payment_received', true,
    'notify_on_partial_payment', true,
    'notify_on_payment_reminder', true,
    'notify_on_overdue', true,
    'notify_on_collection_escalation', true,
    'notify_on_court_case', true,
    
    -- Other Events
    'notify_on_statement_available', true,
    'notify_on_promotion', false
  ),
  'Twilio notification settings for SMS, WhatsApp (via Twilio), and Email (via SendGrid)',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. ADD SUBJECT COLUMN TO NOTIFICATION_LOGS IF NOT EXISTS
-- ============================================================================

ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS subject TEXT;

COMMENT ON COLUMN notification_logs.subject IS 'Email subject line (for email notifications)';

-- ============================================================================
-- 3. ADD EVENT_TYPE COLUMN TO NOTIFICATION_LOGS FOR BETTER TRACKING
-- ============================================================================

ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS event_type TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_logs_event_type ON notification_logs(event_type);

COMMENT ON COLUMN notification_logs.event_type IS 'The event that triggered this notification (e.g., loan_approval, payment_received)';

-- ============================================================================
-- 4. CREATE NOTIFICATION TRIGGER FOR APPLICATION SUBMISSION
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_application_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send notification for new application
  IF TG_OP = 'INSERT' THEN
    -- Email notification
    IF NEW.email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        NEW.user_id,
        'email',
        NEW.email,
        'Application Received',
        format('Hi %s, your loan application (Ref: %s) has been received. We''ll review it and get back to you within 24-48 hours. - Phindu Finance', 
               NEW.full_name, LEFT(NEW.id::TEXT, 8)),
        format('Loan Application Received - Ref: %s', LEFT(NEW.id::TEXT, 8)),
        'application_submitted'
      );
    END IF;
    
    -- SMS notification
    IF NEW.phone IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        NEW.user_id,
        'sms',
        NEW.phone,
        'Application Received',
        format('Hi %s, your loan application has been received. Ref: %s. We''ll contact you within 24-48 hours. - Phindu Finance', 
               NEW.full_name, LEFT(NEW.id::TEXT, 8)),
        NULL,
        'application_submitted'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new applications
DROP TRIGGER IF EXISTS trigger_notify_application_submitted ON loan_applications;
CREATE TRIGGER trigger_notify_application_submitted
  AFTER INSERT ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_application_submitted();

COMMENT ON FUNCTION notify_application_submitted IS 'Automatically sends confirmation when a new loan application is submitted';

-- ============================================================================
-- 5. CREATE NOTIFICATION TRIGGER FOR COURT CASES
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_court_case_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loan RECORD;
BEGIN
  -- Get loan details
  SELECT la.user_id, la.email, la.phone, la.full_name, la.total_repayment
  INTO v_loan
  FROM loan_applications la
  WHERE la.id = NEW.loan_id;
  
  -- Email notification
  IF v_loan.email IS NOT NULL THEN
    PERFORM send_notification_via_edge_function(
      v_loan.user_id,
      'email',
      v_loan.email,
      'Legal Notice',
      format('LEGAL NOTICE: Dear %s, due to non-payment, legal proceedings have been initiated. Case Number: %s. Please contact our legal department immediately. - Phindu Finance Legal', 
             v_loan.full_name, NEW.case_number),
      format('LEGAL NOTICE - Case %s', NEW.case_number),
      'court_case'
    );
  END IF;
  
  -- SMS notification
  IF v_loan.phone IS NOT NULL THEN
    PERFORM send_notification_via_edge_function(
      v_loan.user_id,
      'sms',
      v_loan.phone,
      'Legal Notice',
      format('LEGAL NOTICE: Dear %s, legal proceedings initiated. Case: %s. Contact us immediately. - Phindu Finance Legal', 
             v_loan.full_name, NEW.case_number),
      NULL,
      'court_case'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for court cases (only if court_cases table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_cases') THEN
    DROP TRIGGER IF EXISTS trigger_notify_court_case_created ON court_cases;
    CREATE TRIGGER trigger_notify_court_case_created
      AFTER INSERT ON court_cases
      FOR EACH ROW
      EXECUTE FUNCTION notify_court_case_created();
  END IF;
END;
$$;

COMMENT ON FUNCTION notify_court_case_created IS 'Automatically sends notification when a court case is created';

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

-- Ensure authenticated users can read notification stats
GRANT SELECT ON notification_stats TO authenticated;

-- Update comment on notification_logs table
COMMENT ON TABLE notification_logs IS 'Logs all notification attempts via Twilio (SMS, WhatsApp) and SendGrid (Email)';


-- ========== 20260130090915_5daea430-644f-4f1c-a37e-8a9cd5172162.sql ==========

-- Create table to store OTP codes
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  purpose TEXT NOT NULL DEFAULT 'signup' -- signup, login, verify
);

-- Create index for phone number lookups
CREATE INDEX idx_otp_codes_phone ON public.otp_codes (phone);

-- Create index for cleanup of expired codes
CREATE INDEX idx_otp_codes_expires_at ON public.otp_codes (expires_at);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow insert from service role and anonymous (for signup flow)
CREATE POLICY "Allow OTP creation" 
ON public.otp_codes 
FOR INSERT 
WITH CHECK (true);

-- Allow select for verification (service role will handle this)
CREATE POLICY "Allow OTP verification" 
ON public.otp_codes 
FOR SELECT 
USING (true);

-- Allow update for marking as verified
CREATE POLICY "Allow OTP update" 
ON public.otp_codes 
FOR UPDATE 
USING (true);

-- Allow delete for cleanup
CREATE POLICY "Allow OTP deletion" 
ON public.otp_codes 
FOR DELETE 
USING (true);

-- Create function to clean up expired OTPs (can be called by cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.otp_codes WHERE expires_at < now();
END;
$$;

-- ========== 20260201185600_d260a2fe-efc3-4409-815e-11b567fb88e3.sql ==========

-- Add source_account_id to disbursements table for account deduction tracking
ALTER TABLE public.disbursements 
ADD COLUMN IF NOT EXISTS source_account_id uuid REFERENCES public.accounts(id);

-- Add contract signing tracking fields to loan_applications
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS borrower_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS borrower_signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS admin_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS admin_signed_by uuid;

-- Create index for faster lookups on contract signing status
CREATE INDEX IF NOT EXISTS idx_loan_applications_contract_signing 
ON public.loan_applications (borrower_signed, admin_signed) 
WHERE status = 'approved';

-- ========== 20260202142123_f7e5a3cd-1d0e-4346-842d-8d2f7fbe57d0.sql ==========

-- Fix 1: Remove public access to otp_codes table - OTP verification must only happen via edge functions
-- This prevents attackers from reading active OTP codes and hijacking accounts

DROP POLICY IF EXISTS "Allow OTP creation" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow OTP verification" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow OTP update" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow OTP deletion" ON public.otp_codes;

-- No RLS policies needed for otp_codes - only service role (edge functions) should access this table
-- The send-otp and verify-otp edge functions use SUPABASE_SERVICE_ROLE_KEY to bypass RLS

-- Fix 2: Restrict system_settings access - prevent public access to notification_config containing API keys

DROP POLICY IF EXISTS "Everyone can read system settings" ON public.system_settings;

-- Allow public to read only non-sensitive configuration keys
CREATE POLICY "Public can read non-sensitive settings" 
ON public.system_settings 
FOR SELECT 
USING (
  key IN ('general_config', 'company_info', 'lending_rules')
);

-- Staff/Admin can read all settings including API keys
CREATE POLICY "Staff can read all settings" 
ON public.system_settings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- ========== 20260202171314_0018d35b-fee8-4ed0-98ad-a15883d3b09d.sql ==========

-- Fix DEFINER_OR_RPC_BYPASS: Add authorization checks to SECURITY DEFINER functions

-- 1. Update calculate_repayment_penalty with authorization
CREATE OR REPLACE FUNCTION public.calculate_repayment_penalty(p_repayment_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_due_date date;
  v_amount numeric;
  v_loan_id uuid;
  v_penalty_rate numeric;
  v_days_overdue integer;
  v_penalty numeric;
  v_user_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- Get calling user
  v_user_id := auth.uid();
  
  -- Get repayment details
  SELECT due_date, amount, loan_id INTO v_due_date, v_amount, v_loan_id
  FROM public.loan_repayments
  WHERE id = p_repayment_id AND status = 'pending';
  
  IF v_due_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Check authorization: staff roles OR loan owner
  v_is_authorized := (
    public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'super_admin'::app_role)
    OR public.has_role(v_user_id, 'collections_officer'::app_role)
    OR public.has_role(v_user_id, 'loan_officer'::app_role)
    OR public.has_role(v_user_id, 'finance_officer'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.loan_applications 
      WHERE id = v_loan_id AND user_id = v_user_id
    )
  );
  
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to access this loan';
  END IF;
  
  -- Calculate days overdue
  v_days_overdue := CURRENT_DATE - v_due_date;
  
  IF v_days_overdue <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Get penalty rate from loan product
  SELECT COALESCE(lp.late_payment_penalty_percent, 5) INTO v_penalty_rate
  FROM public.loan_applications la
  LEFT JOIN public.loan_products lp ON la.loan_product_id = lp.id
  WHERE la.id = v_loan_id;
  
  -- Calculate penalty (monthly rate applied per month overdue)
  v_penalty := v_amount * (v_penalty_rate / 100) * CEIL(v_days_overdue::numeric / 30);
  
  -- Update the repayment record with penalty
  UPDATE public.loan_repayments
  SET penalty_amount = v_penalty
  WHERE id = p_repayment_id;
  
  RETURN v_penalty;
END;
$function$;

-- 2. Update apply_loan_penalties with authorization
CREATE OR REPLACE FUNCTION public.apply_loan_penalties(p_loan_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_penalty numeric := 0;
  v_repayment record;
  v_user_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- Get calling user
  v_user_id := auth.uid();
  
  -- Check authorization: staff roles OR loan owner
  v_is_authorized := (
    public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'super_admin'::app_role)
    OR public.has_role(v_user_id, 'collections_officer'::app_role)
    OR public.has_role(v_user_id, 'loan_officer'::app_role)
    OR public.has_role(v_user_id, 'finance_officer'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.loan_applications 
      WHERE id = p_loan_id AND user_id = v_user_id
    )
  );
  
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to access this loan';
  END IF;

  FOR v_repayment IN 
    SELECT id FROM public.loan_repayments 
    WHERE loan_id = p_loan_id 
    AND status = 'pending' 
    AND due_date < CURRENT_DATE
  LOOP
    v_total_penalty := v_total_penalty + public.calculate_repayment_penalty(v_repayment.id);
  END LOOP;
  
  -- Update total penalties on loan
  UPDATE public.loan_applications
  SET total_penalties = v_total_penalty
  WHERE id = p_loan_id;
  
  RETURN v_total_penalty;
END;
$function$;

-- 3. Update calculate_early_settlement with authorization
CREATE OR REPLACE FUNCTION public.calculate_early_settlement(p_loan_id uuid)
RETURNS TABLE(outstanding_principal numeric, outstanding_interest numeric, total_penalties numeric, early_settlement_fee numeric, total_payoff_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loan record;
  v_product record;
  v_total_paid numeric;
  v_total_due numeric;
  v_outstanding numeric;
  v_early_fee_rate numeric;
  v_early_fee numeric;
  v_penalties numeric;
  v_user_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- Get calling user
  v_user_id := auth.uid();
  
  -- Get loan details
  SELECT * INTO v_loan FROM public.loan_applications WHERE id = p_loan_id;
  
  IF v_loan IS NULL THEN
    RETURN;
  END IF;
  
  -- Check authorization: staff roles OR loan owner
  v_is_authorized := (
    public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'super_admin'::app_role)
    OR public.has_role(v_user_id, 'collections_officer'::app_role)
    OR public.has_role(v_user_id, 'loan_officer'::app_role)
    OR public.has_role(v_user_id, 'finance_officer'::app_role)
    OR public.has_role(v_user_id, 'credit_officer'::app_role)
    OR (v_loan.user_id = v_user_id)
  );
  
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to access this loan';
  END IF;
  
  -- Get product early repayment fee
  SELECT COALESCE(early_repayment_fee_percent, 0) INTO v_early_fee_rate
  FROM public.loan_products WHERE id = v_loan.loan_product_id;
  
  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.loan_repayments
  WHERE loan_id = p_loan_id AND status = 'paid';
  
  -- Calculate outstanding
  v_outstanding := v_loan.total_repayment - v_total_paid;
  
  -- Calculate penalties
  SELECT COALESCE(SUM(penalty_amount), 0) INTO v_penalties
  FROM public.loan_repayments
  WHERE loan_id = p_loan_id AND status = 'pending';
  
  -- Calculate early settlement fee on remaining principal
  v_early_fee := (v_loan.loan_amount - v_total_paid) * (v_early_fee_rate / 100);
  IF v_early_fee < 0 THEN v_early_fee := 0; END IF;
  
  RETURN QUERY SELECT 
    GREATEST(v_loan.loan_amount - v_total_paid, 0)::numeric as outstanding_principal,
    GREATEST(v_outstanding - (v_loan.loan_amount - v_total_paid), 0)::numeric as outstanding_interest,
    v_penalties::numeric as total_penalties,
    v_early_fee::numeric as early_settlement_fee,
    GREATEST(v_outstanding + v_penalties + v_early_fee, 0)::numeric as total_payoff_amount;
END;
$function$;

-- Fix STORAGE_EXPOSURE: Remove the unused insecure 'loan_documents' bucket

-- Drop the insecure policies first
DROP POLICY IF EXISTS "Allow authenticated users to upload loan documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view own loan documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to view all loan documents" ON storage.objects;

-- Delete any objects in the bucket (if any)
DELETE FROM storage.objects WHERE bucket_id = 'loan_documents';

-- Remove the bucket itself
DELETE FROM storage.buckets WHERE id = 'loan_documents';

-- ========== 20260204100000_fix_disbursement_account_trigger.sql ==========

-- Fix disbursement account trigger: single deduction when status = completed, balance check, balance_before, notes column
-- Ensures account is deducted only once (when marking disbursement completed) and transaction row is valid.

CREATE OR REPLACE FUNCTION update_account_on_disbursement()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before DECIMAL(15, 2);
  v_balance_after DECIMAL(15, 2);
BEGIN
  -- Only process if source_account_id is set and status is completed
  IF NEW.source_account_id IS NOT NULL AND NEW.status = 'completed' THEN
    -- For new disbursements or status changes to completed
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'completed') THEN
      -- Get current balance and validate before deducting (especially when marking pending -> completed)
      SELECT balance INTO v_balance_before
      FROM accounts
      WHERE id = NEW.source_account_id;

      IF v_balance_before IS NULL THEN
        RAISE EXCEPTION 'Source account not found for disbursement';
      END IF;
      IF v_balance_before < NEW.amount THEN
        RAISE EXCEPTION 'Insufficient balance in source account. Available: %, Required: %', v_balance_before, NEW.amount;
      END IF;

      v_balance_after := v_balance_before - NEW.amount;

      -- Deduct from source account
      UPDATE accounts
      SET balance = v_balance_after,
          updated_at = NOW()
      WHERE id = NEW.source_account_id;

      -- Record transaction with balance_before and balance_after (notes column per schema)
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        notes
      )
      VALUES (
        NEW.source_account_id,
        'disbursement',
        NEW.amount,
        v_balance_before,
        v_balance_after,
        'loan_disbursement',
        NEW.id,
        'Loan disbursement for loan ID: ' || NEW.loan_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_account_on_disbursement() IS 'Deducts from source account and records transaction only when disbursement status is completed (single deduction, balance check, correct columns)';


-- ========== 20260206_application_documents_system.sql ==========

-- =====================================================
-- PHINDU LOANS: Application Documents System
-- Date: 2026-02-06
-- Purpose: Fix document storage limitations and enable
--          dynamic, product-specific document requirements
-- =====================================================

-- 1. Create Application Documents Table
-- This replaces the hardcoded nrc_front_url, nrc_back_url, etc.
CREATE TABLE IF NOT EXISTS public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  loan_product_id UUID REFERENCES public.loan_products(id),
  
  -- Document metadata
  doc_type TEXT NOT NULL, -- e.g., 'NRC_FRONT', 'NRC_BACK', 'SELFIE', 'PAYSLIP', 'BANK_STATEMENT', 'EMPLOYER_LETTER', 'COLLATERAL_DOC', 'GUARANTOR_DOC', 'CONTRACT_SIGNED', 'CONTRACT_UNSIGNED', 'PROOF_OF_RESIDENCE', 'OTHER'
  doc_label TEXT NOT NULL, -- Human-readable label
  month_tag TEXT, -- For payslips: 'YYYY-MM' (e.g., '2024-01')
  
  -- File information
  file_url TEXT NOT NULL, -- Storage path
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  
  -- Upload tracking
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by TEXT CHECK (uploaded_by IN ('borrower', 'admin')) DEFAULT 'borrower',
  
  -- Payslip password (only for payslip docs)
  payslip_password TEXT,
  
  -- Document status and verification
  is_required BOOLEAN DEFAULT true,
  status TEXT CHECK (status IN ('uploaded', 'verified', 'rejected', 'pending_review')) DEFAULT 'uploaded',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT, -- Admin notes for rejection/verification
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX idx_app_docs_application ON public.application_documents(application_id);
CREATE INDEX idx_app_docs_borrower ON public.application_documents(borrower_id);
CREATE INDEX idx_app_docs_type ON public.application_documents(doc_type);
CREATE INDEX idx_app_docs_status ON public.application_documents(status);

-- Enable RLS
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Borrowers can view their own documents
CREATE POLICY "Borrowers can view own documents"
  ON public.application_documents FOR SELECT
  USING (auth.uid() = borrower_id);

-- Borrowers can insert their own documents
CREATE POLICY "Borrowers can upload documents"
  ON public.application_documents FOR INSERT
  WITH CHECK (auth.uid() = borrower_id);

-- Admins can view all documents
CREATE POLICY "Admins can view all documents"
  ON public.application_documents FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
  );

-- Admins can update document status (verify/reject)
CREATE POLICY "Admins can verify/reject documents"
  ON public.application_documents FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
  );

-- Admins can insert documents on behalf of borrowers
CREATE POLICY "Admins can upload documents for borrowers"
  ON public.application_documents FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
  );

-- 2. Add updated_at trigger
CREATE TRIGGER update_application_documents_updated_at
  BEFORE UPDATE ON public.application_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Migrate existing documents from loan_applications to application_documents
-- This will preserve existing uploads
DO $$
DECLARE
  app_record RECORD;
  new_doc_id UUID;
BEGIN
  FOR app_record IN 
    SELECT id, user_id, loan_product_id, nrc_front_url, nrc_back_url, payslip_url, selfie_url, created_at
    FROM public.loan_applications
    WHERE nrc_front_url IS NOT NULL OR nrc_back_url IS NOT NULL OR payslip_url IS NOT NULL OR selfie_url IS NOT NULL
  LOOP
    -- Migrate NRC Front
    IF app_record.nrc_front_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'NRC_FRONT', 'NRC Front', app_record.nrc_front_url, 
        substring(app_record.nrc_front_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;

    -- Migrate NRC Back
    IF app_record.nrc_back_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'NRC_BACK', 'NRC Back', app_record.nrc_back_url, 
        substring(app_record.nrc_back_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;

    -- Migrate Payslip
    IF app_record.payslip_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'PAYSLIP', 'Latest Payslip', app_record.payslip_url, 
        substring(app_record.payslip_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;

    -- Migrate Selfie
    IF app_record.selfie_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'SELFIE', 'Selfie Photo', app_record.selfie_url, 
        substring(app_record.selfie_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;
  END LOOP;
END $$;

-- 4. Add required_documents JSONB field to loan_products if it doesn't exist
-- This will store the list of required documents per product
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'loan_products' 
    AND column_name = 'required_documents'
  ) THEN
    ALTER TABLE public.loan_products ADD COLUMN required_documents JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 5. Set default required documents for existing loan products
UPDATE public.loan_products
SET required_documents = '[
  {"doc_type": "NRC_FRONT", "doc_label": "NRC Front", "is_mandatory": true, "display_order": 1},
  {"doc_type": "NRC_BACK", "doc_label": "NRC Back", "is_mandatory": true, "display_order": 2},
  {"doc_type": "SELFIE", "doc_label": "Selfie Photo", "is_mandatory": true, "display_order": 3},
  {"doc_type": "PAYSLIP", "doc_label": "Latest Payslip", "is_mandatory": true, "display_order": 4, "allow_multiple": true, "max_count": 3},
  {"doc_type": "BANK_STATEMENT", "doc_label": "Bank Statement (3 months)", "is_mandatory": false, "display_order": 5},
  {"doc_type": "EMPLOYER_LETTER", "doc_label": "Employment Letter", "is_mandatory": false, "display_order": 6}
]'::jsonb
WHERE required_documents IS NULL OR required_documents = '[]'::jsonb;

-- 6. Create Borrower Document Vault table
-- This allows borrowers to store documents permanently and reuse them
CREATE TABLE IF NOT EXISTS public.borrower_document_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  doc_type TEXT NOT NULL,
  doc_label TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_borrower ON public.borrower_document_vault(borrower_id);
CREATE INDEX idx_vault_type ON public.borrower_document_vault(doc_type);

-- Enable RLS for vault
ALTER TABLE public.borrower_document_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Borrowers can manage their vault"
  ON public.borrower_document_vault FOR ALL
  USING (auth.uid() = borrower_id);

CREATE POLICY "Admins can view all vaults"
  ON public.borrower_document_vault FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
  );

-- Add updated_at trigger
CREATE TRIGGER update_borrower_document_vault_updated_at
  BEFORE UPDATE ON public.borrower_document_vault
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Add comment for documentation
COMMENT ON TABLE public.application_documents IS 'Stores all documents uploaded for loan applications. Replaces hardcoded nrc_front_url, nrc_back_url, etc. fields in loan_applications table.';
COMMENT ON TABLE public.borrower_document_vault IS 'Permanent document storage for borrowers. Allows reuse of verified documents across multiple applications.';
COMMENT ON COLUMN public.loan_products.required_documents IS 'JSONB array of required documents for this loan product. Each element has: doc_type, doc_label, is_mandatory, display_order, allow_multiple (optional), max_count (optional).';


-- ========== 20260206142108_8fcb0863-eb0c-478a-916f-7689462bc405.sql ==========


-- =====================================================
-- PHINDU LOANS: Application Documents System
-- Date: 2026-02-06
-- Purpose: Fix document storage limitations and enable
--          dynamic, product-specific document requirements
-- =====================================================

-- 1. Create Application Documents Table
CREATE TABLE IF NOT EXISTS public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  loan_product_id UUID REFERENCES public.loan_products(id),
  doc_type TEXT NOT NULL,
  doc_label TEXT NOT NULL,
  month_tag TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by TEXT CHECK (uploaded_by IN ('borrower', 'admin')) DEFAULT 'borrower',
  payslip_password TEXT,
  is_required BOOLEAN DEFAULT true,
  status TEXT CHECK (status IN ('uploaded', 'verified', 'rejected', 'pending_review')) DEFAULT 'uploaded',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_docs_application ON public.application_documents(application_id);
CREATE INDEX idx_app_docs_borrower ON public.application_documents(borrower_id);
CREATE INDEX idx_app_docs_type ON public.application_documents(doc_type);
CREATE INDEX idx_app_docs_status ON public.application_documents(status);

ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Borrowers can view own documents"
ON public.application_documents FOR SELECT
USING (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can upload documents"
ON public.application_documents FOR INSERT
WITH CHECK (auth.uid() = borrower_id);

CREATE POLICY "Admins can view all documents"
ON public.application_documents FOR SELECT
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
);

CREATE POLICY "Admins can verify/reject documents"
ON public.application_documents FOR UPDATE
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
);

CREATE POLICY "Admins can upload documents for borrowers"
ON public.application_documents FOR INSERT
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
);

CREATE TRIGGER update_application_documents_updated_at
BEFORE UPDATE ON public.application_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Migrate existing documents
DO $$
DECLARE
  app_record RECORD;
BEGIN
  FOR app_record IN 
    SELECT id, user_id, loan_product_id, nrc_front_url, nrc_back_url, payslip_url, selfie_url, created_at
    FROM public.loan_applications
    WHERE nrc_front_url IS NOT NULL OR nrc_back_url IS NOT NULL OR payslip_url IS NOT NULL OR selfie_url IS NOT NULL
  LOOP
    IF app_record.nrc_front_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'NRC_FRONT', 'NRC Front', app_record.nrc_front_url, 
        substring(app_record.nrc_front_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;

    IF app_record.nrc_back_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'NRC_BACK', 'NRC Back', app_record.nrc_back_url, 
        substring(app_record.nrc_back_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;

    IF app_record.payslip_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'PAYSLIP', 'Latest Payslip', app_record.payslip_url, 
        substring(app_record.payslip_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;

    IF app_record.selfie_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'SELFIE', 'Selfie Photo', app_record.selfie_url, 
        substring(app_record.selfie_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;
  END LOOP;
END $$;

-- 4. Add required_documents JSONB field to loan_products
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'loan_products' 
    AND column_name = 'required_documents'
  ) THEN
    ALTER TABLE public.loan_products ADD COLUMN required_documents JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 5. Set default required documents for existing loan products
UPDATE public.loan_products
SET required_documents = '[
  {"doc_type": "NRC_FRONT", "doc_label": "NRC Front", "is_mandatory": true, "display_order": 1},
  {"doc_type": "NRC_BACK", "doc_label": "NRC Back", "is_mandatory": true, "display_order": 2},
  {"doc_type": "SELFIE", "doc_label": "Selfie Photo", "is_mandatory": true, "display_order": 3},
  {"doc_type": "PAYSLIP", "doc_label": "Latest Payslip", "is_mandatory": true, "display_order": 4, "allow_multiple": true, "max_count": 3},
  {"doc_type": "BANK_STATEMENT", "doc_label": "Bank Statement (3 months)", "is_mandatory": false, "display_order": 5},
  {"doc_type": "EMPLOYER_LETTER", "doc_label": "Employment Letter", "is_mandatory": false, "display_order": 6}
]'::jsonb
WHERE required_documents IS NULL OR required_documents = '[]'::jsonb;

-- 6. Create Borrower Document Vault table
CREATE TABLE IF NOT EXISTS public.borrower_document_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_label TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_borrower ON public.borrower_document_vault(borrower_id);
CREATE INDEX idx_vault_type ON public.borrower_document_vault(doc_type);

ALTER TABLE public.borrower_document_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Borrowers can manage their vault"
ON public.borrower_document_vault FOR ALL
USING (auth.uid() = borrower_id);

CREATE POLICY "Admins can view all vaults"
ON public.borrower_document_vault FOR SELECT
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
);

CREATE TRIGGER update_borrower_document_vault_updated_at
BEFORE UPDATE ON public.borrower_document_vault
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.application_documents IS 'Stores all documents uploaded for loan applications.';
COMMENT ON TABLE public.borrower_document_vault IS 'Permanent document storage for borrowers.';
COMMENT ON COLUMN public.loan_products.required_documents IS 'JSONB array of required documents for this loan product.';


-- ========== 20260209_blacklist_expires_at.sql ==========

-- Optional blacklist duration: expiry date for temporary blacklist
-- Date: 2026-02-09

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blacklist_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.blacklist_expires_at IS 'When blacklist expires (null = permanent). If set and in the past, treat as not blacklisted.';


-- ========== 20260209_log_auth_events.sql ==========

-- Log login/signup to audit_logs with IP and optional device info
-- Date: 2026-02-09

CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_action TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    ip_address,
    details
  ) VALUES (
    auth.uid(),
    p_action,
    'user',
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    p_ip_address,
    CASE WHEN p_device_info IS NOT NULL THEN jsonb_build_object('device_info', p_device_info) ELSE NULL END
  );
END;
$$;

COMMENT ON FUNCTION public.log_auth_event(TEXT, TEXT, JSONB) IS 'Records login/signup in audit_logs with IP and optional device info. Call after auth success.';


-- ========== 20260209_profile_verification_status.sql ==========

-- Add verification timestamps to profiles for admin display
-- Date: 2026-02-09

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.email_verified_at IS 'When email was verified (e.g. first password login or email confirmation)';
COMMENT ON COLUMN public.profiles.phone_verified_at IS 'When phone was verified (e.g. OTP sign-in)';


-- ========== 20260209_unique_nrc_phone_profiles.sql ==========

-- Prevent duplicate NRC + phone combinations on profiles
-- Date: 2026-02-09

-- Partial unique index: only enforce when both nrc_number and phone are set
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nrc_phone_unique
  ON public.profiles (nrc_number, phone)
  WHERE nrc_number IS NOT NULL AND phone IS NOT NULL;

COMMENT ON INDEX public.idx_profiles_nrc_phone_unique IS 'Ensures no two profiles share the same NRC number and phone combination.';
