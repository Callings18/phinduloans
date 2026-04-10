-- AUTO-GENERATED: concatenated supabase migrations in filename order
-- Generated at: 2026-04-07T08:39:59

-- ===================================================================
-- FILE: 20251220150928_836f93ae-56b3-4efc-ae04-556bee0ea696.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251220152035_a5e88813-725e-4fc7-887c-c58f82da2462.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251220153807_b889731f-36a5-4b5e-8e8e-0315c2442c14.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251221165218_6129b5da-98bd-4f26-859d-04f6acfbda31.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251222202105_a532f447-4014-4582-82aa-f888c4d2eda2.sql
-- ===================================================================
-- Update RLS policy to allow anyone to view active loan products (truly public)
DROP POLICY IF EXISTS "Anyone can view active loan products" ON public.loan_products;

CREATE POLICY "Anyone can view active loan products" 
ON public.loan_products 
FOR SELECT 
USING (is_active = true);

-- ===================================================================
-- FILE: 20251222203242_aa899278-2162-4ede-827f-12de8581a665.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251222204310_d1320c3d-5069-46fb-9232-c41d1e11e51c.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251222210143_2124c6ae-5bf2-410e-982c-a86c57808702.sql
-- ===================================================================
-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- ===================================================================
-- FILE: 20251222221204_0183b7b3-dc3a-43bd-a4b5-082b10c75400.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251223154711_85016cc7-7323-4587-8c62-592385a24f3a.sql
-- ===================================================================
-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'loan_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'credit_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collections_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';

-- ===================================================================
-- FILE: 20251223154741_25b87651-46d3-48be-9262-df023007006e.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251223160312_533e03f0-e33b-4917-9d07-8ee03d3b70dc.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251223165300_enhanced_lms_schema.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20251223170406_8880dd62-ac54-4a08-9bcd-97a8cc6027a7.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251223170500_add_assigned_to.sql
-- ===================================================================
-- Add assigned_to column to loan_applications for staff assignment
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Add policy or update existing policies to allow assigned staff to view/update
-- (Existing admin policies already cover viewing/updating everything, but this column helps in filtering)

-- Create an index to speed up filtering by assigned staff
CREATE INDEX IF NOT EXISTS idx_loan_applications_assigned_to ON public.loan_applications(assigned_to);


-- ===================================================================
-- FILE: 20251223171500_storage_setup.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20251223172500_audit_triggers.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20251223173303_9a9100ca-0312-46d8-a5ef-4f3d2ffa379d.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251223174050_bf5f1909-cc0f-4e3c-8814-27c4ae88ecba.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251223174110_98d213cd-edd2-43f7-89a3-9107903147f4.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251223175000_fix_profile_rls.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20251223175018_5f115179-eea2-496e-a847-9599084453dc.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251223181000_collection_activities.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20251223184500_update_role_policies.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20251223185500_add_product_to_loans.sql
-- ===================================================================
-- Add product_id to loan_applications to track which product was used
ALTER TABLE public.loan_applications ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.loan_products(id);

-- Update index for performance
CREATE INDEX IF NOT EXISTS idx_loan_applications_product_id ON public.loan_applications(product_id);


-- ===================================================================
-- FILE: 20251225210230_ec4984d7-9668-49f1-9a1c-bd2de88c0138.sql
-- ===================================================================
-- Add policy to allow admins and staff to create loan applications for any user
CREATE POLICY "Admins can create loan applications" 
ON public.loan_applications 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role)
);

-- ===================================================================
-- FILE: 20251228203815_d704ee8f-7ea0-4562-8ebc-ca0d7f9db1d6.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251229094634_976bd5c2-0a15-4002-8a89-f5824a87a23f.sql
-- ===================================================================
-- Enable realtime for loan_applications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_applications;

-- ===================================================================
-- FILE: 20251229101844_a6d3400a-5bd5-4e0f-9f9c-12269cfb7197.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251229221616_238f9db5-94c0-41a2-9abb-b2a96cbbd700.sql
-- ===================================================================
-- Add new document and collateral columns for enhanced loan applications
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS collateral_image_url TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS bank_statement_url TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS payslip_2_url TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS payslip_3_url TEXT;

-- ===================================================================
-- FILE: 20251230144125_ef935dee-06bb-40ac-99d1-2c8534c9da16.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20251230163201_515bd1b1-1225-4d5b-9b2f-6e47e0c9d5f1.sql
-- ===================================================================
-- PMIC (Payroll Management Integration Center) Tables

-- 1. PMIC Config (Single row for lender settings)
CREATE TABLE public.pmic_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_authority TEXT, -- PMEC, PSPF, NAPSA, PRIVATE
  deduction_code TEXT, -- Assigned by authority (e.g., MFI-123)
  deduction_code_assigned_date DATE,
  max_deduction_percent NUMERIC DEFAULT 33, -- Max % of salary deductible
  min_net_pay_percent NUMERIC DEFAULT 50, -- Employee must retain this %
  max_loan_multiplier NUMERIC DEFAULT 36, -- Max loan = salary Ã— multiplier
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

-- ===================================================================
-- FILE: 2026_01_03_loan_engine_enhancements.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260101161808_715ee19c-703b-470a-8e38-65d1338d3472.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260108_account_based_transactions.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260108_notification_providers.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260108_remove_funding_pool_setting.sql
-- ===================================================================
-- Remove deprecated static funding_pool setting in favor of real account balances
delete from system_settings where key = 'funding_pool';



-- ===================================================================
-- FILE: 20260108_wallet_and_court_system.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260108171013_68fb6947-6cc4-4eb3-8e58-7d2d0511db79.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260109100148_f6e6ee77-64b0-4979-97a1-071c2d043aef.sql
-- ===================================================================
-- Add term_unit column to loan_products table to support daily/weekly/monthly/yearly terms
ALTER TABLE public.loan_products 
ADD COLUMN IF NOT EXISTS term_unit text NOT NULL DEFAULT 'months';

-- Add comment for documentation
COMMENT ON COLUMN public.loan_products.term_unit IS 'Unit for loan term: days, weeks, months, or years';

-- Also add term_unit to loan_applications to store the selected unit when loan is created
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS term_unit text NOT NULL DEFAULT 'months';

COMMENT ON COLUMN public.loan_applications.term_unit IS 'Unit for loan term: days, weeks, months, or years';

-- ===================================================================
-- FILE: 20260109230807_8a3ea80c-ff21-46d4-9d04-f2bbde29cd7d.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260110174344_9c2511f8-76c4-4421-b7bb-9a84f2ef7350.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260112183357_f24f7235-69bb-4d65-86ca-f3f22fd1c07e.sql
-- ===================================================================
-- Update loan products to set the 10% legal fee (platform_fee_percent)
UPDATE public.loan_products 
SET platform_fee_percent = 10 
WHERE is_active = true AND (platform_fee_percent IS NULL OR platform_fee_percent = 0);

-- Ensure processing fee is set correctly (2.5%)
UPDATE public.loan_products 
SET processing_fee_percent = 2.5 
WHERE is_active = true AND (processing_fee_percent IS NULL OR processing_fee_percent = 0);

-- ===================================================================
-- FILE: 20260115_hr_payroll_system.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260115_user_notification_preferences.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260116214243_81bc24eb-30cf-4300-8e30-65c3d8f7c606.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260117_auto_notifications_and_enhancements.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260117_fix_weekly_payments_and_deletions.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260117_notification_queue_enhancements.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260121104933_9a9ba221-80e9-469a-8296-eefbbbc778db.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260121105011_e7e9dee2-9ae7-425e-b2d7-4f4faf25b4f6.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260122_unified_application_documents.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260126_twilio_notification_enhancements.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260130090915_5daea430-644f-4f1c-a37e-8a9cd5172162.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260201185600_d260a2fe-efc3-4409-815e-11b567fb88e3.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260202142123_f7e5a3cd-1d0e-4346-842d-8d2f7fbe57d0.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260202171314_0018d35b-fee8-4ed0-98ad-a15883d3b09d.sql
-- ===================================================================
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

-- ===================================================================
-- FILE: 20260204100000_fix_disbursement_account_trigger.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260206_application_documents_system.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260206142108_8fcb0863-eb0c-478a-916f-7689462bc405.sql
-- ===================================================================

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


-- ===================================================================
-- FILE: 20260209_blacklist_expires_at.sql
-- ===================================================================
-- Optional blacklist duration: expiry date for temporary blacklist
-- Date: 2026-02-09

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blacklist_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.blacklist_expires_at IS 'When blacklist expires (null = permanent). If set and in the past, treat as not blacklisted.';


-- ===================================================================
-- FILE: 20260209_log_auth_events.sql
-- ===================================================================
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


-- ===================================================================
-- FILE: 20260209_payment_claims.sql
-- ===================================================================
-- Borrower payment claims: borrower reports payment with reference (and optional receipt) for admin verification.
-- Admin records actual payment in loan_repayments and marks claim as verified.

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

-- Borrowers can insert their own claims (user_id = auth.uid()) and read their own.
create policy "Borrowers can insert own payment claims"
  on public.payment_claims for insert
  with check (auth.uid() = user_id);

create policy "Borrowers can read own payment claims"
  on public.payment_claims for select
  using (auth.uid() = user_id);

-- Staff can read/update all claims (for verification).
create policy "Staff can read all payment claims"
  on public.payment_claims for select
  using (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'loan_officer'::app_role)
    or public.has_role(auth.uid(), 'finance_officer'::app_role)
    or public.has_role(auth.uid(), 'collections_officer'::app_role)
  );

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


-- ===================================================================
-- FILE: 20260209_profile_verification_status.sql
-- ===================================================================
-- Add verification timestamps to profiles for admin display
-- Date: 2026-02-09

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.email_verified_at IS 'When email was verified (e.g. first password login or email confirmation)';
COMMENT ON COLUMN public.profiles.phone_verified_at IS 'When phone was verified (e.g. OTP sign-in)';


-- ===================================================================
-- FILE: 20260209_unique_nrc_phone_profiles.sql
-- ===================================================================
-- Prevent duplicate NRC + phone combinations on profiles
-- Date: 2026-02-09

-- Partial unique index: only enforce when both nrc_number and phone are set
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nrc_phone_unique
  ON public.profiles (nrc_number, phone)
  WHERE nrc_number IS NOT NULL AND phone IS NOT NULL;

COMMENT ON INDEX public.idx_profiles_nrc_phone_unique IS 'Ensures no two profiles share the same NRC number and phone combination.';


-- ===================================================================
-- FILE: 20260209084552_fbc11cb0-b520-4c72-9a12-6d32d684e984.sql
-- ===================================================================

-- Unique NRC + phone on profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nrc_phone_unique
  ON public.profiles (nrc_number, phone)
  WHERE nrc_number IS NOT NULL AND phone IS NOT NULL;

-- Log auth events function
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
    user_id, action, entity_type, entity_id, ip_address, details
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

-- Profile verification columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Blacklist expiry
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blacklist_expires_at TIMESTAMPTZ;


-- ===================================================================
-- FILE: 20260209090425_cdaf13bf-3de7-48f3-b29f-5f26cb9de016.sql
-- ===================================================================
-- Add contract_signing to the loan_status enum
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'contract_signing' AFTER 'approved';

-- ===================================================================
-- FILE: 20260209214050_f8199511-0675-4385-a6e5-3a1f22ae07c4.sql
-- ===================================================================
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS contract_fully_signed_at timestamptz;

COMMENT ON COLUMN loan_applications.contract_fully_signed_at IS 'Set when both borrower and admin have signed; optional audit field.';

-- ===================================================================
-- FILE: 20260209232412_99a8520f-6fc2-42f1-ab10-d83b05d5faef.sql
-- ===================================================================

-- =============================================================================
-- 1. audit_logs module column
-- =============================================================================
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module TEXT;

-- =============================================================================
-- 2. RBAC: roles, permissions, role_permissions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage roles" ON public.roles FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can view roles" ON public.roles FOR SELECT
    USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (module, action)
);
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage permissions" ON public.permissions FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can view permissions" ON public.permissions FOR SELECT
    USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL REFERENCES public.roles(name) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (role_name, permission_id)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can view role_permissions" ON public.role_permissions FOR SELECT
    USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.permissions (module, action, description) VALUES
  ('loans', 'view', 'View loan applications'),
  ('loans', 'create', 'Create loan applications'),
  ('loans', 'update', 'Update loan applications'),
  ('loans', 'delete', 'Delete loan applications'),
  ('loans', 'approve', 'Approve loan applications'),
  ('loans', 'verify_documents', 'Verify loan documents'),
  ('loans', 'finance_approve', 'Finance approval for loans'),
  ('disbursement', 'view', 'View disbursements'),
  ('disbursement', 'create', 'Create disbursements'),
  ('disbursement', 'approve', 'Approve disbursements'),
  ('repayments', 'view', 'View repayments'),
  ('repayments', 'create', 'Record repayments'),
  ('repayments', 'reverse', 'Reverse repayments'),
  ('collections', 'view', 'View collections'),
  ('collections', 'manage', 'Manage collections'),
  ('products', 'view', 'View loan products'),
  ('products', 'create', 'Create loan products'),
  ('products', 'update', 'Update loan products'),
  ('products', 'delete', 'Delete loan products'),
  ('borrowers', 'view', 'View borrowers'),
  ('borrowers', 'manage', 'Manage borrowers'),
  ('borrowers', 'blacklist', 'Blacklist borrowers'),
  ('reports', 'view', 'View reports'),
  ('reports', 'export', 'Export reports'),
  ('audit', 'view', 'View audit logs'),
  ('settings', 'view', 'View settings'),
  ('settings', 'manage', 'Manage settings'),
  ('staff', 'view', 'View staff'),
  ('staff', 'manage', 'Manage staff'),
  ('expenses', 'view', 'View expenses'),
  ('expenses', 'create', 'Create expenses'),
  ('expenses', 'approve', 'Approve expenses'),
  ('payroll', 'view', 'View payroll'),
  ('payroll', 'manage', 'Manage payroll'),
  ('wallets', 'view', 'View wallets/accounts'),
  ('wallets', 'manage', 'Manage wallets/accounts')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO public.roles (name, description, is_system) VALUES
  ('super_admin', 'Full system access', true),
  ('admin', 'Administrative access', true),
  ('loan_officer', 'Loan processing and document verification', true),
  ('credit_officer', 'Credit assessment and risk evaluation', true),
  ('finance_officer', 'Disbursement and repayment management', true),
  ('collections_officer', 'Overdue account management', true),
  ('auditor', 'Read-only audit access', true),
  ('support', 'Customer support access', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'super_admin', id FROM public.permissions ON CONFLICT (role_name, permission_id) DO NOTHING;
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'admin', id FROM public.permissions ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'loan_officer', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('loans','create'),('loans','update'),('loans','verify_documents'),
  ('borrowers','view'),('borrowers','manage'),('disbursement','view'),('repayments','view'),
  ('repayments','create'),('collections','view'),('reports','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'credit_officer', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('loans','update'),('loans','approve'),('borrowers','view'),('reports','view'),('collections','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'finance_officer', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('loans','finance_approve'),('disbursement','view'),('disbursement','create'),
  ('disbursement','approve'),('repayments','view'),('repayments','create'),('repayments','reverse'),
  ('expenses','view'),('expenses','create'),('expenses','approve'),('wallets','view'),('wallets','manage'),
  ('reports','view'),('reports','export'),('payroll','view'),('payroll','manage')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'collections_officer', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('collections','view'),('collections','manage'),('borrowers','view'),('repayments','view'),('reports','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'auditor', id FROM public.permissions WHERE (module, action) IN (
  ('audit','view'),('reports','view'),('loans','view'),('repayments','view'),('disbursement','view'),('expenses','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'support', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('borrowers','view'),('repayments','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_name = ur.role::text
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id AND p.module = _module AND p.action = _action
) $$;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(module TEXT, action TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_name = ur.role::text
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid() $$;

-- =============================================================================
-- 3. Approval workflow columns + loan_notes
-- =============================================================================
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS document_verified_by UUID,
  ADD COLUMN IF NOT EXISTS document_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finance_verified_by UUID,
  ADD COLUMN IF NOT EXISTS finance_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursed_by UUID,
  ADD COLUMN IF NOT EXISTS approval_stage TEXT DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.loan_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note TEXT NOT NULL,
  note_type TEXT DEFAULT 'general',
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Staff can view loan notes" ON public.loan_notes FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'loan_officer'::app_role) OR has_role(auth.uid(), 'credit_officer'::app_role)
      OR has_role(auth.uid(), 'finance_officer'::app_role) OR has_role(auth.uid(), 'collections_officer'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can insert loan notes" ON public.loan_notes FOR INSERT
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'loan_officer'::app_role) OR has_role(auth.uid(), 'credit_officer'::app_role)
      OR has_role(auth.uid(), 'finance_officer'::app_role) OR has_role(auth.uid(), 'collections_officer'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can update own notes" ON public.loan_notes FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can delete notes" ON public.loan_notes FOR DELETE
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. transition_loan_status RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.transition_loan_status(p_loan_id UUID, p_action TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_loan RECORD; v_user_id UUID := auth.uid(); v_new_stage TEXT;
BEGIN
  SELECT * INTO v_loan FROM public.loan_applications WHERE id = p_loan_id;
  IF v_loan IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Loan not found'); END IF;
  IF p_action = 'verify_documents' THEN
    IF NOT has_permission(v_user_id, 'loans', 'verify_documents') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET document_verified_by = v_user_id, document_verified_at = now(), approval_stage = 'documents_verified', updated_at = now() WHERE id = p_loan_id;
    v_new_stage := 'documents_verified';
  ELSIF p_action = 'finance_approve' THEN
    IF NOT has_permission(v_user_id, 'loans', 'finance_approve') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET finance_verified_by = v_user_id, finance_verified_at = now(), approval_stage = 'finance_approved', updated_at = now() WHERE id = p_loan_id;
    v_new_stage := 'finance_approved';
  ELSIF p_action = 'approve' THEN
    IF NOT has_permission(v_user_id, 'loans', 'approve') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET status = 'approved', reviewed_by = v_user_id, reviewed_at = now(), approval_stage = 'approved', updated_at = now() WHERE id = p_loan_id;
    v_new_stage := 'approved';
  ELSE RETURN jsonb_build_object('success', false, 'error', 'Unknown action: ' || p_action); END IF;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_user_id, p_action, 'loan_application', p_loan_id, 'loans', jsonb_build_object('approval_stage', v_new_stage));
  RETURN jsonb_build_object('success', true, 'stage', v_new_stage);
END; $$;

-- =============================================================================
-- 5. Restrict loan deletes
-- =============================================================================
DROP POLICY IF EXISTS "Admins can delete applications" ON public.loan_applications;
CREATE POLICY "Staff can delete applications in early stages"
  ON public.loan_applications FOR DELETE
  USING (
    ( status IN ('pending', 'rejected', 'under_review') AND public.has_permission(auth.uid(), 'loans', 'delete') )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- =============================================================================
-- 6. Employees table + commission & branch
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  position TEXT,
  hire_date DATE,
  salary NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage employees" ON public.employees FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch TEXT;

-- =============================================================================
-- 7. Commission calculations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  loan_id UUID REFERENCES public.loan_applications(id),
  loan_amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_employee ON public.commission_calculations(employee_id);
CREATE INDEX IF NOT EXISTS idx_commission_period ON public.commission_calculations(period_start, period_end);
ALTER TABLE public.commission_calculations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage commissions" ON public.commission_calculations FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_officer'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 8. officer_loan_stats & portfolio_at_risk
-- =============================================================================
CREATE OR REPLACE FUNCTION public.officer_loan_stats(p_period_start DATE, p_period_end DATE)
RETURNS TABLE(officer_id UUID, officer_name TEXT, total_applications BIGINT, approved_count BIGINT, rejected_count BIGINT, total_disbursed NUMERIC, total_collected NUMERIC, approval_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT la.assigned_to, COALESCE(p.full_name, 'Unassigned'),
  COUNT(*), COUNT(*) FILTER (WHERE la.status IN ('approved','active','completed')),
  COUNT(*) FILTER (WHERE la.status = 'rejected'),
  COALESCE(SUM(la.loan_amount) FILTER (WHERE la.status IN ('active','completed','approved')), 0),
  0::NUMERIC,
  CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE la.status IN ('approved','active','completed'))::NUMERIC / COUNT(*)::NUMERIC * 100, 1) ELSE 0 END
  FROM public.loan_applications la LEFT JOIN public.profiles p ON p.id = la.assigned_to
  WHERE la.created_at::date BETWEEN p_period_start AND p_period_end AND la.assigned_to IS NOT NULL
  GROUP BY la.assigned_to, p.full_name $$;

CREATE OR REPLACE FUNCTION public.portfolio_at_risk(p_as_of_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(total_outstanding NUMERIC, par_30 NUMERIC, par_60 NUMERIC, par_90 NUMERIC, par_30_pct NUMERIC, par_60_pct NUMERIC, par_90_pct NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ WITH lb AS (
  SELECT la.id, COALESCE(la.total_repayment,0) - COALESCE((SELECT SUM(lr.amount) FROM public.loan_repayments lr WHERE lr.loan_id=la.id AND lr.status='paid'),0) AS outstanding,
    COALESCE((SELECT MIN(lr.due_date) FROM public.loan_repayments lr WHERE lr.loan_id=la.id AND lr.status='pending' AND lr.due_date<p_as_of_date), p_as_of_date) AS earliest_overdue
  FROM public.loan_applications la WHERE la.status='active'
) SELECT COALESCE(SUM(outstanding),0), COALESCE(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=30),0),
  COALESCE(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=60),0),
  COALESCE(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=90),0),
  CASE WHEN SUM(outstanding)>0 THEN ROUND(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=30)/SUM(outstanding)*100,2) ELSE 0 END,
  CASE WHEN SUM(outstanding)>0 THEN ROUND(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=60)/SUM(outstanding)*100,2) ELSE 0 END,
  CASE WHEN SUM(outstanding)>0 THEN ROUND(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=90)/SUM(outstanding)*100,2) ELSE 0 END
FROM lb $$;


-- ===================================================================
-- FILE: 20260210_approval_workflow_and_loan_notes.sql
-- ===================================================================
-- Phase 2.1: Multi-level approval workflow columns + loan_notes table
-- loan_applications: document_verified_by, document_verified_at, finance_verified_by, finance_verified_at, disbursed_by, approval_stage
-- loan_notes: id, loan_id, user_id, note, type (internal | borrower_visible), created_at

-- 1. Add columns to loan_applications
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS document_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finance_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finance_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_stage TEXT;

COMMENT ON COLUMN public.loan_applications.document_verified_by IS 'User who verified documents (loan officer)';
COMMENT ON COLUMN public.loan_applications.document_verified_at IS 'When documents were verified';
COMMENT ON COLUMN public.loan_applications.finance_verified_by IS 'User who approved finance (accounts officer)';
COMMENT ON COLUMN public.loan_applications.finance_verified_at IS 'When finance was approved';
COMMENT ON COLUMN public.loan_applications.disbursed_by IS 'User who performed disbursement';
COMMENT ON COLUMN public.loan_applications.approval_stage IS 'Workflow stage: submitted, under_review, documents_verified, finance_approved, approved, contract_signing, disbursed, active, completed';

-- 2. loan_notes table
CREATE TABLE IF NOT EXISTS public.loan_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'internal' CHECK (type IN ('internal', 'borrower_visible')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_notes_loan_id ON public.loan_notes(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_notes_created_at ON public.loan_notes(created_at);

ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;

-- Staff (any role in user_roles) can read all notes; borrowers can read only borrower_visible for their loans
CREATE POLICY "Staff can view all loan notes"
  ON public.loan_notes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

CREATE POLICY "Borrowers can view borrower_visible notes for their loans"
  ON public.loan_notes FOR SELECT TO authenticated
  USING (
    type = 'borrower_visible'
    AND EXISTS (
      SELECT 1 FROM public.loan_applications la
      WHERE la.id = loan_notes.loan_id AND la.user_id = auth.uid()
    )
  );

-- Only staff can insert/update/delete (use permission or role check)
CREATE POLICY "Staff can insert loan notes"
  ON public.loan_notes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

CREATE POLICY "Staff can update loan notes"
  ON public.loan_notes FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

CREATE POLICY "Staff can delete loan notes"
  ON public.loan_notes FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

COMMENT ON TABLE public.loan_notes IS 'Internal and borrower-visible notes on loan applications; RLS restricts borrowers to borrower_visible only for their loans';


-- ===================================================================
-- FILE: 20260210_audit_logs_module.sql
-- ===================================================================
-- Add optional module column to audit_logs for RBAC/reporting
-- Date: 2026-02-10

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module TEXT;

COMMENT ON COLUMN public.audit_logs.module IS 'Module/category for the action (e.g. loans, disbursement, products). Can mirror entity_type.';


-- ===================================================================
-- FILE: 20260210_commission_calculations.sql
-- ===================================================================
-- Phase 3.2: Commission calculations audit table
-- Stores computed commission per employee per period for audit and payroll
-- Date: 2026-02-10

CREATE TABLE IF NOT EXISTS public.commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  loan_ids UUID[] DEFAULT '{}',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  formula_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_calculations_employee ON public.commission_calculations(employee_id);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_period ON public.commission_calculations(period_start, period_end);

ALTER TABLE public.commission_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission_calculations"
  ON public.commission_calculations FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  );

COMMENT ON TABLE public.commission_calculations IS 'Audit of commission computed per employee per period; formula_used describes calculation (e.g. % of interest on loans processed)';


-- ===================================================================
-- FILE: 20260210_employees_commission_branch.sql
-- ===================================================================
-- Phase 3.1: Add commission_percentage and branch to employees for payroll/commission linking
-- Date: 2026-02-10

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch TEXT;

COMMENT ON COLUMN public.employees.commission_percentage IS 'Commission % on loans processed by this employee (e.g. interest earned or disbursed amount)';
COMMENT ON COLUMN public.employees.branch IS 'Branch or location for reporting and filtering';


-- ===================================================================
-- FILE: 20260210_loan_applications_delete_policy.sql
-- ===================================================================
-- Phase 1.4: Delete policy for loan_applications
-- Only allow delete when: (status is pending/rejected/under_review AND user has loans.delete)
-- OR user is super_admin (with audit in app layer).

DROP POLICY IF EXISTS "Admins can delete applications" ON public.loan_applications;

CREATE POLICY "Staff can delete applications in early stages"
  ON public.loan_applications FOR DELETE
  USING (
    (
      status IN ('pending', 'rejected', 'under_review')
      AND public.has_permission(auth.uid(), 'loans', 'delete')
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

COMMENT ON POLICY "Staff can delete applications in early stages" ON public.loan_applications IS
  'Delete allowed only for pending/rejected/under_review when user has loans.delete, or for super_admin on any row.';


-- ===================================================================
-- FILE: 20260210_officer_loan_stats_rpc.sql
-- ===================================================================
-- Phase 4.1: Officer-level loan stats RPC for performance dashboards
-- Returns per-officer (by assigned_to) metrics for a period
-- Date: 2026-02-10

CREATE OR REPLACE FUNCTION public.officer_loan_stats(p_period_start DATE, p_period_end DATE)
RETURNS TABLE (
  officer_id UUID,
  applications_submitted BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  disbursed_count BIGINT,
  approval_rate NUMERIC,
  default_count BIGINT,
  default_rate NUMERIC,
  avg_loan_size NUMERIC,
  portfolio_outstanding NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period_loans AS (
    SELECT
      la.assigned_to AS officer_id,
      la.id,
      la.status,
      la.loan_amount
    FROM public.loan_applications la
    WHERE la.assigned_to IS NOT NULL
      AND la.created_at::date >= p_period_start
      AND la.created_at::date <= p_period_end
  ),
  outstanding AS (
    SELECT
      la.assigned_to AS officer_id,
      COALESCE(SUM(la.loan_amount) - COALESCE(SUM(rep.paid), 0), 0) AS outstanding
    FROM public.loan_applications la
    LEFT JOIN (
      SELECT loan_id, SUM(amount) AS paid
      FROM public.loan_repayments
      WHERE status = 'paid'
      GROUP BY loan_id
    ) rep ON rep.loan_id = la.id
    WHERE la.assigned_to IS NOT NULL
      AND la.status IN ('disbursed', 'active', 'defaulted')
    GROUP BY la.assigned_to
  ),
  defaults AS (
    SELECT assigned_to AS officer_id, COUNT(*) AS cnt
    FROM public.loan_applications
    WHERE assigned_to IS NOT NULL AND status = 'defaulted'
      AND created_at::date >= p_period_start AND created_at::date <= p_period_end
    GROUP BY assigned_to
  ),
  agg AS (
    SELECT
      pl.officer_id,
      COUNT(*)::BIGINT AS applications_submitted,
      COUNT(*) FILTER (WHERE pl.status = 'approved')::BIGINT AS approved_count,
      COUNT(*) FILTER (WHERE pl.status = 'rejected')::BIGINT AS rejected_count,
      COUNT(*) FILTER (WHERE pl.status = 'disbursed')::BIGINT AS disbursed_count,
      AVG(pl.loan_amount) AS avg_loan_size
    FROM period_loans pl
    GROUP BY pl.officer_id
  )
  SELECT
    a.officer_id,
    a.applications_submitted,
    a.approved_count,
    a.rejected_count,
    a.disbursed_count,
    CASE WHEN a.applications_submitted > 0 THEN ROUND(100.0 * (a.approved_count + a.disbursed_count) / a.applications_submitted, 2) ELSE 0 END AS approval_rate,
    COALESCE(d.cnt, 0)::BIGINT AS default_count,
    CASE WHEN a.applications_submitted > 0 THEN ROUND(100.0 * COALESCE(d.cnt, 0) / a.applications_submitted, 2) ELSE 0 END AS default_rate,
    ROUND(a.avg_loan_size::numeric, 2) AS avg_loan_size,
    COALESCE(o.outstanding, 0)::numeric AS portfolio_outstanding
  FROM agg a
  LEFT JOIN defaults d ON d.officer_id = a.officer_id
  LEFT JOIN outstanding o ON o.officer_id = a.officer_id
$$;

COMMENT ON FUNCTION public.officer_loan_stats(DATE, DATE) IS 'Per-officer loan stats for a date range (by assigned_to): applications, approved, rejected, disbursed, approval rate, default rate, avg loan size, portfolio outstanding';

-- PAR (portfolio at risk): overdue balance / total outstanding
CREATE OR REPLACE FUNCTION public.portfolio_at_risk(p_as_of_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_outstanding NUMERIC,
  overdue_balance NUMERIC,
  par_percent NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH outstanding_loans AS (
    SELECT la.id, la.loan_amount, la.total_repayment
    FROM public.loan_applications la
    WHERE la.status IN ('disbursed', 'active', 'defaulted')
  ),
  repaid AS (
    SELECT loan_id, SUM(amount) AS paid FROM public.loan_repayments WHERE status = 'paid' GROUP BY loan_id
  ),
  overdue AS (
    SELECT SUM(lr.amount) AS bal
    FROM public.loan_repayments lr
    WHERE lr.status = 'pending' AND lr.due_date < p_as_of_date
  )
  SELECT
    COALESCE(SUM(ol.loan_amount) - COALESCE(SUM(r.paid), 0), 0)::numeric AS total_outstanding,
    COALESCE((SELECT bal FROM overdue), 0)::numeric AS overdue_balance,
    CASE
      WHEN SUM(ol.loan_amount) - COALESCE(SUM(r.paid), 0) > 0
      THEN ROUND(100.0 * COALESCE((SELECT bal FROM overdue), 0) / (SUM(ol.loan_amount) - COALESCE(SUM(r.paid), 0)), 2)
      ELSE 0
    END::numeric AS par_percent
  FROM outstanding_loans ol
  LEFT JOIN repaid r ON r.loan_id = ol.id
$$;

COMMENT ON FUNCTION public.portfolio_at_risk(DATE) IS 'Portfolio at risk: total outstanding, overdue balance, PAR %';


-- ===================================================================
-- FILE: 20260210_rbac_repayments_collections_writeoffs_court.sql
-- ===================================================================
-- Add permissions for repayments, collections, writeoffs, court (Phase 5 RBAC)
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

-- super_admin and admin: all new permissions (repayments, collections, writeoffs, court)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module IN ('repayments', 'collections', 'writeoffs', 'court') AND p.action IN ('view', 'manage', 'record'))
WHERE r.code IN ('super_admin', 'admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- finance_officer and collections_officer: repayments view + record
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'repayments' AND p.action IN ('view', 'record'))
WHERE r.code IN ('finance_officer', 'collections_officer')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- collections_officer: collections view + manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'collections' AND p.action IN ('view', 'manage'))
WHERE r.code = 'collections_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- super_admin and admin: writeoffs, court (view + manage)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module IN ('writeoffs', 'court') AND p.action IN ('view', 'manage'))
WHERE r.code IN ('super_admin', 'admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- loan_officer: repayments view + record (so they can record payments)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'repayments' AND p.action IN ('view', 'record'))
WHERE r.code = 'loan_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ===================================================================
-- FILE: 20260210_rbac_roles_permissions.sql
-- ===================================================================
-- RBAC: roles, permissions, role_permissions, has_permission
-- Phase 1.1 - Run after app_role and user_roles exist
-- Date: 2026-02-10
--
-- NOTE: If your database was already migrated with 20260209232412, tables use
-- role_permissions(role_name, permission_id) and roles(name). This file's
-- alternate shape is skipped by IF NOT EXISTS; apply 20260407120000_rbac_canonical_permission_functions.sql
-- so has_permission / get_my_permissions match the role_name model.

-- 1. roles table (display name + code matching app_role for join)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. permissions table (module + action)
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module, action)
);

-- 3. role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

-- 4. RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read roles/permissions (for UI)
CREATE POLICY "Authenticated can read roles"
  ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Only super_admin/admin can manage (optional; add when needed)
CREATE POLICY "Admins can manage roles"
  ON public.roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage permissions"
  ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 5. has_permission RPC: user_id, module, action -> boolean
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_module TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.code = ur.role::text
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND p.module = p_module
      AND p.action = p_action
  )
$$;

COMMENT ON FUNCTION public.has_permission(UUID, TEXT, TEXT) IS 'Returns true if user has the given permission via any of their roles';

-- 5b. get_my_permissions: returns (module, action) for current user (for usePermissions hook)
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(module TEXT, action TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.roles r ON r.code = ur.role::text
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid()
$$;

COMMENT ON FUNCTION public.get_my_permissions() IS 'Returns all (module, action) permissions for the current user';

-- 6. Seed permissions (fixed set)
INSERT INTO public.permissions (module, action, description) VALUES
  ('loans', 'view', 'View loan applications and loans'),
  ('loans', 'approve', 'Approve or reject loan applications'),
  ('loans', 'verify_documents', 'Mark documents as verified'),
  ('loans', 'finance_approve', 'Approve finance / credit check'),
  ('loans', 'edit', 'Edit loan application details'),
  ('loans', 'delete', 'Delete loan applications (pending/under_review only)'),
  ('loans', 'assign', 'Assign applications to staff'),
  ('disbursement', 'view', 'View disbursements'),
  ('disbursement', 'disburse', 'Create and complete disbursements'),
  ('products', 'view', 'View loan products'),
  ('products', 'edit', 'Create and edit loan products'),
  ('products', 'delete', 'Delete loan products'),
  ('reports', 'view', 'View reports'),
  ('reports', 'export', 'Export reports (CSV/PDF/Excel)'),
  ('payroll', 'view', 'View payroll'),
  ('payroll', 'manage', 'Manage payroll periods and runs'),
  ('audit', 'view', 'View audit logs'),
  ('borrowers', 'view', 'View borrowers'),
  ('borrowers', 'edit', 'Edit borrower profiles'),
  ('settings', 'manage', 'Manage system settings')
ON CONFLICT (module, action) DO NOTHING;

-- 7. Seed roles (match app_role enum: admin, user, employer, super_admin, loan_officer, credit_officer, finance_officer, collections_officer, auditor, support)
INSERT INTO public.roles (code, name, description, is_system_role) VALUES
  ('super_admin', 'Super Admin', 'Full platform access', true),
  ('admin', 'Admin', 'Administrative access', true),
  ('loan_officer', 'Loan Officer', 'Process applications, verify documents', true),
  ('credit_officer', 'Credit Officer', 'Credit and risk assessment', true),
  ('finance_officer', 'Finance / Accounts Officer', 'Finance approval, disbursement', true),
  ('collections_officer', 'Collections Officer', 'Collections and recovery', true),
  ('auditor', 'Auditor', 'View audit logs and reports', true),
  ('support', 'Support', 'Support and view access', true),
  ('user', 'User', 'Borrower / customer', true),
  ('employer', 'Employer', 'Employer portal', true)
ON CONFLICT (code) DO NOTHING;

-- 8. Map role_permissions
-- super_admin: all
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.code = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- admin: all except maybe some super_admin-only (treat same as super_admin for now)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.code = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- loan_officer: loans view, verify_documents, assign, edit (application details); borrowers view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'loans' AND p.action IN ('view', 'verify_documents', 'assign', 'edit')) OR (p.module = 'borrowers' AND p.action = 'view')
WHERE r.code = 'loan_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- credit_officer: loans view, assign; reports view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON (p.module = 'loans' AND p.action IN ('view', 'assign')) OR (p.module = 'reports' AND p.action = 'view') OR (p.module = 'borrowers' AND p.action = 'view')
WHERE r.code = 'credit_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- finance_officer: loans view, finance_approve; disbursement view, disburse; reports view, export
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'loans' AND p.action IN ('view', 'finance_approve', 'assign')) OR (p.module = 'disbursement') OR (p.module = 'reports') OR (p.module = 'borrowers' AND p.action = 'view')
WHERE r.code = 'finance_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- collections_officer: loans view, borrowers view, reports view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'loans' AND p.action = 'view') OR (p.module = 'borrowers' AND p.action = 'view') OR (p.module = 'reports' AND p.action = 'view')
WHERE r.code = 'collections_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- auditor: reports view, export; audit view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON p.module IN ('reports', 'audit') AND p.action IN ('view', 'export')
WHERE r.code = 'auditor'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- support: loans view, borrowers view (read-only)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'loans' AND p.action = 'view') OR (p.module = 'borrowers' AND p.action = 'view')
WHERE r.code = 'support'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Trigger for roles updated_at
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ===================================================================
-- FILE: 20260210_transition_loan_status_rpc.sql
-- ===================================================================
-- Phase 2.2: RPC to transition loan status with permission checks
-- transition_loan_status(loan_id, action) where action in ('verify_documents', 'finance_approve', 'approve')

CREATE OR REPLACE FUNCTION public.transition_loan_status(
  p_loan_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
  v_uid UUID := auth.uid();
  v_updated RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, status, document_verified_by, document_verified_at, finance_verified_by, finance_verified_at
    INTO v_loan
    FROM public.loan_applications
    WHERE id = p_loan_id;

  IF v_loan.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Loan not found');
  END IF;

  CASE p_action
    WHEN 'verify_documents' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'verify_documents') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.verify_documents');
      END IF;
      UPDATE public.loan_applications
      SET
        document_verified_by = v_uid,
        document_verified_at = now(),
        approval_stage = 'documents_verified',
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'DOCUMENTS_VERIFIED', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('document_verified_by', v_uid, 'document_verified_at', now()));

    WHEN 'finance_approve' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'finance_approve') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.finance_approve');
      END IF;
      UPDATE public.loan_applications
      SET
        finance_verified_by = v_uid,
        finance_verified_at = now(),
        approval_stage = 'finance_approved',
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'FINANCE_APPROVED', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('finance_verified_by', v_uid, 'finance_verified_at', now()));

    WHEN 'approve' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'approve') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.approve');
      END IF;
      IF v_loan.document_verified_at IS NULL OR v_loan.finance_verified_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Both document verification and finance approval are required before final approval');
      END IF;
      UPDATE public.loan_applications
      SET
        status = 'approved',
        approval_stage = 'approved',
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'STATUS_UPDATE', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('status', 'approved', 'approval_stage', 'approved'));

    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid action: ' || COALESCE(p_action, ''));
  END CASE;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.transition_loan_status(UUID, TEXT) IS 'Transition loan workflow: verify_documents, finance_approve, or approve (with permission and stage checks)';


-- ===================================================================
-- FILE: 20260210000107_a4c2b2af-0d02-438d-9b06-89a3d111d371.sql
-- ===================================================================

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

create policy "Borrowers can insert own payment claims"
  on public.payment_claims for insert
  with check (auth.uid() = user_id);

create policy "Borrowers can read own payment claims"
  on public.payment_claims for select
  using (auth.uid() = user_id);

create policy "Staff can read all payment claims"
  on public.payment_claims for select
  using (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'loan_officer'::app_role)
    or public.has_role(auth.uid(), 'finance_officer'::app_role)
    or public.has_role(auth.uid(), 'collections_officer'::app_role)
  );

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


-- ===================================================================
-- FILE: 20260210021720_0f476d9b-2dd3-4772-8e9f-d4a883ff2878.sql
-- ===================================================================
-- Allow borrowers to update contract signing fields on their own loans
DROP POLICY IF EXISTS "Borrowers can sign their own contracts" ON public.loan_applications;

CREATE POLICY "Borrowers can sign their own contracts"
  ON public.loan_applications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===================================================================
-- FILE: 20260210030740_ec7cb523-e4cf-4503-a294-13290643697e.sql
-- ===================================================================
-- Add awaiting_disbursement to the loan_status enum
ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'awaiting_disbursement' AFTER 'contract_signing';

-- ===================================================================
-- FILE: 20260211_compute_commission_rpc.sql
-- ===================================================================
-- RPC to compute commission for a payroll period; returns per-employee commission (optionally write to commission_calculations via app)
-- Uses employees.commission_percentage and loans processed (assigned_to) disbursed in period
-- Date: 2026-02-11

CREATE OR REPLACE FUNCTION public.compute_commission_for_period(
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  commission_percentage NUMERIC,
  loans_count BIGINT,
  interest_earned NUMERIC,
  commission_amount NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH emp_loans AS (
    SELECT
      e.id AS employee_id,
      (e.first_name || ' ' || e.last_name) AS employee_name,
      COALESCE(e.commission_percentage, 0)::numeric AS commission_percentage,
      COUNT(la.id)::bigint AS loans_count,
      COALESCE(SUM(la.total_repayment - la.loan_amount), 0)::numeric AS interest_earned
    FROM public.employees e
    LEFT JOIN public.loan_applications la
      ON la.assigned_to = e.user_id
      AND la.status IN ('disbursed', 'active', 'completed')
      AND la.disbursed_at IS NOT NULL
      AND (la.disbursed_at::date >= p_period_start AND la.disbursed_at::date <= p_period_end)
    WHERE e.is_active = true AND COALESCE(e.commission_percentage, 0) > 0
    GROUP BY e.id, e.first_name, e.last_name, e.commission_percentage
  )
  SELECT
    el.employee_id,
    el.employee_name,
    el.commission_percentage,
    el.loans_count,
    el.interest_earned,
    ROUND((el.interest_earned * el.commission_percentage / 100.0)::numeric, 2) AS commission_amount
  FROM emp_loans el;
$$;

COMMENT ON FUNCTION public.compute_commission_for_period(DATE, DATE) IS 'Compute commission per employee for period from interest on loans (assigned_to) disbursed in period';


-- ===================================================================
-- FILE: 20260211_rbac_disbursements_products_rls.sql
-- ===================================================================
-- RBAC: RLS policies for disbursements and loan_products using has_permission
-- Ensures only users with correct permissions can view/create/update/delete
-- Date: 2026-02-11

-- Disbursements: view for disbursement.view; insert/update for disbursement.disburse
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disbursements') THEN
    RETURN;
  END IF;
  ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  NULL; -- table may already have RLS
END $$;

-- Drop legacy policies if they exist
DROP POLICY IF EXISTS "Users can view their loan disbursements" ON public.disbursements;
DROP POLICY IF EXISTS "Admins can manage disbursements" ON public.disbursements;
DROP POLICY IF EXISTS "disbursements_select_policy" ON public.disbursements;
CREATE POLICY "disbursements_select_policy"
  ON public.disbursements FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'disbursement', 'view'));

DROP POLICY IF EXISTS "disbursements_insert_policy" ON public.disbursements;
CREATE POLICY "disbursements_insert_policy"
  ON public.disbursements FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'disbursement', 'disburse'));

DROP POLICY IF EXISTS "disbursements_update_policy" ON public.disbursements;
CREATE POLICY "disbursements_update_policy"
  ON public.disbursements FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'disbursement', 'disburse'));

-- Disbursements: no delete for audit trail (or only super_admin)
DROP POLICY IF EXISTS "disbursements_delete_policy" ON public.disbursements;
CREATE POLICY "disbursements_delete_policy"
  ON public.disbursements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Loan products: view for products.view; insert/update for products.edit; delete for products.delete
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_products') THEN
    RETURN;
  END IF;
  ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Drop legacy policies if they exist
DROP POLICY IF EXISTS "Anyone can view active loan products" ON public.loan_products;
DROP POLICY IF EXISTS "loan_products_select_policy" ON public.loan_products;
CREATE POLICY "loan_products_select_policy"
  ON public.loan_products FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'view') OR public.has_role(auth.uid(), 'user'::app_role) OR public.has_role(auth.uid(), 'employer'::app_role));

DROP POLICY IF EXISTS "loan_products_insert_policy" ON public.loan_products;
CREATE POLICY "loan_products_insert_policy"
  ON public.loan_products FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'products', 'edit'));

DROP POLICY IF EXISTS "loan_products_update_policy" ON public.loan_products;
CREATE POLICY "loan_products_update_policy"
  ON public.loan_products FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'edit'));

DROP POLICY IF EXISTS "loan_products_delete_policy" ON public.loan_products;
CREATE POLICY "loan_products_delete_policy"
  ON public.loan_products FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'delete'));

COMMENT ON POLICY "disbursements_select_policy" ON public.disbursements IS 'View disbursements with disbursement.view';
COMMENT ON POLICY "disbursements_insert_policy" ON public.disbursements IS 'Create disbursements with disbursement.disburse';
COMMENT ON POLICY "loan_products_select_policy" ON public.loan_products IS 'View products with products.view or borrower roles';
COMMENT ON POLICY "loan_products_insert_policy" ON public.loan_products IS 'Create products with products.edit';


-- ===================================================================
-- FILE: 20260211_transition_loan_status_reject.sql
-- ===================================================================
-- Extend transition_loan_status to support 'reject' action with reason (audited)
-- Date: 2026-02-11

CREATE OR REPLACE FUNCTION public.transition_loan_status(
  p_loan_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, status, document_verified_by, document_verified_at, finance_verified_by, finance_verified_at
    INTO v_loan
    FROM public.loan_applications
    WHERE id = p_loan_id;

  IF v_loan.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Loan not found');
  END IF;

  CASE p_action
    WHEN 'verify_documents' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'verify_documents') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.verify_documents');
      END IF;
      UPDATE public.loan_applications
      SET
        document_verified_by = v_uid,
        document_verified_at = now(),
        approval_stage = 'documents_verified',
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'DOCUMENTS_VERIFIED', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('document_verified_by', v_uid, 'document_verified_at', now()));

    WHEN 'finance_approve' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'finance_approve') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.finance_approve');
      END IF;
      UPDATE public.loan_applications
      SET
        finance_verified_by = v_uid,
        finance_verified_at = now(),
        approval_stage = 'finance_approved',
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'FINANCE_APPROVED', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('finance_verified_by', v_uid, 'finance_verified_at', now()));

    WHEN 'approve' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'approve') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.approve');
      END IF;
      IF v_loan.document_verified_at IS NULL OR v_loan.finance_verified_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Both document verification and finance approval are required before final approval');
      END IF;
      UPDATE public.loan_applications
      SET
        status = 'approved',
        approval_stage = 'approved',
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'STATUS_UPDATE', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('status', 'approved', 'approval_stage', 'approved'));

    WHEN 'reject' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'approve') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.approve required to reject');
      END IF;
      UPDATE public.loan_applications
      SET
        status = 'rejected',
        rejection_reason = COALESCE(p_reason, rejection_reason),
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'REJECTED', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('status', 'rejected', 'rejection_reason', COALESCE(p_reason, '')));

    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid action: ' || COALESCE(p_action, ''));
  END CASE;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.transition_loan_status(UUID, TEXT, TEXT) IS 'Transition loan workflow: verify_documents, finance_approve, approve, reject (with optional reason). Permission-gated and audited.';


-- ===================================================================
-- FILE: 20260211055521_eaa9d1c3-41c8-4869-ab43-a0c9c7e1c5f1.sql
-- ===================================================================

-- Allow borrowers to insert their own KYC documents
CREATE POLICY "Borrowers can insert own documents"
ON public.borrower_document_vault
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = borrower_id);

-- Allow borrowers to view their own documents
CREATE POLICY "Borrowers can select own documents"
ON public.borrower_document_vault
FOR SELECT
TO authenticated
USING (auth.uid() = borrower_id);


-- ===================================================================
-- FILE: 20260211060303_4b6f00e8-0716-48ec-86c0-a1af17ee5e11.sql
-- ===================================================================

-- Borrower KYC information (financial, next of kin)
CREATE TABLE public.borrower_kyc_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL,
  
  -- Bank Account
  bank_name text,
  bank_account_number text,
  bank_account_holder_name text,
  bank_branch text,
  account_type text DEFAULT 'savings',
  
  -- Mobile Money
  airtel_money_number text,
  mtn_mobile_money_number text,
  zamtel_kwacha_number text,
  mobile_money_account_name text,
  
  -- Next of Kin
  nok_full_name text,
  nok_relationship text,
  nok_nrc_number text,
  nok_phone text,
  nok_alt_phone text,
  nok_address text,
  nok_district text,
  
  -- Verification
  is_verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  admin_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT borrower_kyc_info_borrower_unique UNIQUE (borrower_id)
);

ALTER TABLE public.borrower_kyc_info ENABLE ROW LEVEL SECURITY;

-- Borrowers can manage their own KYC info
CREATE POLICY "Borrowers can insert own kyc info"
ON public.borrower_kyc_info FOR INSERT TO authenticated
WITH CHECK (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can select own kyc info"
ON public.borrower_kyc_info FOR SELECT TO authenticated
USING (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can update own kyc info"
ON public.borrower_kyc_info FOR UPDATE TO authenticated
USING (auth.uid() = borrower_id);

-- Staff can view and manage all
CREATE POLICY "Staff can view all kyc info"
ON public.borrower_kyc_info FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role) OR 
  has_role(auth.uid(), 'credit_officer'::app_role)
);

CREATE POLICY "Staff can update all kyc info"
ON public.borrower_kyc_info FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_borrower_kyc_info_updated_at
BEFORE UPDATE ON public.borrower_kyc_info
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Borrower references table
CREATE TABLE public.borrower_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL,
  
  full_name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  alt_phone text,
  address text,
  years_known integer,
  occupation text,
  
  is_verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  verification_notes text,
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.borrower_references ENABLE ROW LEVEL SECURITY;

-- Borrowers can manage their own references
CREATE POLICY "Borrowers can insert own references"
ON public.borrower_references FOR INSERT TO authenticated
WITH CHECK (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can select own references"
ON public.borrower_references FOR SELECT TO authenticated
USING (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can update own references"
ON public.borrower_references FOR UPDATE TO authenticated
USING (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can delete own references"
ON public.borrower_references FOR DELETE TO authenticated
USING (auth.uid() = borrower_id);

-- Staff can view and manage all references
CREATE POLICY "Staff can view all references"
ON public.borrower_references FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role) OR 
  has_role(auth.uid(), 'credit_officer'::app_role)
);

CREATE POLICY "Staff can update all references"
ON public.borrower_references FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role)
);


-- ===================================================================
-- FILE: 20260211061257_468404ba-66e4-486e-bfb7-7cabde2f1c90.sql
-- ===================================================================
-- Drop the old conflicting ALL policy (uses 'public' role, not 'authenticated')
DROP POLICY IF EXISTS "Borrowers can manage their vault" ON public.borrower_document_vault;

-- Fix storage: allow uploads to kyc/ subfolder paths
-- The current policies require foldername[1] = auth.uid(), but uploads go to kyc/{userId}/...
-- Add a policy that allows authenticated users to upload to kyc/{their_uid}/ paths
CREATE POLICY "Users can upload KYC documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'loan-documents' 
  AND (storage.foldername(name))[1] = 'kyc' 
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can view KYC documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'loan-documents' 
  AND (storage.foldername(name))[1] = 'kyc' 
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- ===================================================================
-- FILE: 20260211073831_1642b75d-8330-43ad-8712-9a6ec7c6dc14.sql
-- ===================================================================

-- 1. Add missing approval workflow columns to loan_applications
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS recommended_by UUID,
  ADD COLUMN IF NOT EXISTS recommended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.loan_applications.recommended_by IS 'Staff who recommended the loan for approval';
COMMENT ON COLUMN public.loan_applications.recommended_at IS 'When the loan was recommended';
COMMENT ON COLUMN public.loan_applications.approved_by IS 'Staff who gave final approval';
COMMENT ON COLUMN public.loan_applications.approved_at IS 'When the loan was finally approved';
COMMENT ON COLUMN public.loan_applications.disbursed_at IS 'When the loan was disbursed';

-- 2. loan_notes already exists with column "loan_id" - add RLS policies if missing
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Staff can view all loan notes" ON public.loan_notes;
DROP POLICY IF EXISTS "Staff can insert loan notes" ON public.loan_notes;
DROP POLICY IF EXISTS "Borrowers can view visible notes on their loans" ON public.loan_notes;
DROP POLICY IF EXISTS "Staff can view loan notes" ON public.loan_notes;
DROP POLICY IF EXISTS "Staff can create loan notes" ON public.loan_notes;

ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;

-- Staff can read all loan notes
CREATE POLICY "Staff can view all loan notes"
  ON public.loan_notes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'loan_officer'::app_role)
    OR public.has_role(auth.uid(), 'credit_officer'::app_role)
    OR public.has_role(auth.uid(), 'finance_officer'::app_role)
    OR public.has_role(auth.uid(), 'collections_officer'::app_role)
    OR public.has_role(auth.uid(), 'auditor'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
  );

-- Staff can insert notes
CREATE POLICY "Staff can insert loan notes"
  ON public.loan_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'loan_officer'::app_role)
      OR public.has_role(auth.uid(), 'credit_officer'::app_role)
      OR public.has_role(auth.uid(), 'finance_officer'::app_role)
      OR public.has_role(auth.uid(), 'collections_officer'::app_role)
      OR public.has_role(auth.uid(), 'support'::app_role)
    )
  );

-- Borrowers can only see notes marked visible_to_borrower on their own loans
CREATE POLICY "Borrowers can view visible notes on their loans"
  ON public.loan_notes FOR SELECT
  TO authenticated
  USING (
    note_type = 'visible_to_borrower'
    AND EXISTS (
      SELECT 1 FROM public.loan_applications la
      WHERE la.id = loan_id AND la.user_id = auth.uid()
    )
  );


-- ===================================================================
-- FILE: 20260211075154_c7e9f624-fd1b-4310-83c3-5aa6a6f48b09.sql
-- ===================================================================

-- ============================================================
-- PAYROLL RECORDS: monthly payroll runs per employee
-- ============================================================
CREATE TABLE public.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- Period
  payroll_month integer NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year integer NOT NULL CHECK (payroll_year >= 2020),
  
  -- Gross components
  basic_salary numeric NOT NULL DEFAULT 0,
  housing_allowance numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  lunch_allowance numeric NOT NULL DEFAULT 0,
  other_allowances numeric NOT NULL DEFAULT 0,
  overtime_pay numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,

  -- Statutory deductions
  paye_tax numeric NOT NULL DEFAULT 0,
  nhima_employee numeric NOT NULL DEFAULT 0,
  nhima_employer numeric NOT NULL DEFAULT 0,
  napsa_employee numeric NOT NULL DEFAULT 0,
  napsa_employer numeric NOT NULL DEFAULT 0,
  
  -- Other deductions
  loan_deduction numeric NOT NULL DEFAULT 0,
  pension_deduction numeric NOT NULL DEFAULT 0,
  union_dues numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  
  -- Totals
  total_deductions numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  total_employer_cost numeric NOT NULL DEFAULT 0,

  -- Status & meta
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  notes text,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One record per employee per month
  UNIQUE (employee_id, payroll_month, payroll_year)
);

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- RLS: Admins full access
CREATE POLICY "Admins can manage payroll records"
  ON public.payroll_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- RLS: Finance officers can view
CREATE POLICY "Finance can view payroll records"
  ON public.payroll_records FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'finance_officer'));

-- RLS: Finance can insert/update draft payroll
CREATE POLICY "Finance can manage draft payroll"
  ON public.payroll_records FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Finance can update draft payroll"
  ON public.payroll_records FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'finance_officer') AND status = 'draft');

-- ============================================================
-- PAYROLL TAX CONFIG: Zambian PAYE bands + statutory rates
-- ============================================================
CREATE TABLE public.payroll_tax_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type text NOT NULL, -- 'paye_band', 'nhima', 'napsa', 'general'
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  
  -- PAYE band fields
  band_min numeric,
  band_max numeric,
  rate_percent numeric,
  
  -- Statutory rate fields
  employee_rate_percent numeric,
  employer_rate_percent numeric,
  ceiling_amount numeric, -- e.g. NAPSA ceiling
  
  label text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_tax_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tax config"
  ON public.payroll_tax_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view tax config"
  ON public.payroll_tax_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'loan_officer'));

-- ============================================================
-- SEED: 2026 Zambian PAYE tax bands (monthly)
-- ============================================================
INSERT INTO public.payroll_tax_config (config_type, label, band_min, band_max, rate_percent, effective_from, notes) VALUES
  ('paye_band', 'Band 1: 0%',         0,      5100,   0,    '2026-01-01', 'Tax-free threshold'),
  ('paye_band', 'Band 2: 20%',     5100.01,   7100,  20,    '2026-01-01', 'First taxable band'),
  ('paye_band', 'Band 3: 30%',     7100.01,   9200,  30,    '2026-01-01', 'Middle band'),
  ('paye_band', 'Band 4: 37.5%',   9200.01,   NULL,  37.5,  '2026-01-01', 'Top rate on excess');

-- NHIMA rates (1% each side)
INSERT INTO public.payroll_tax_config (config_type, label, employee_rate_percent, employer_rate_percent, effective_from, notes) VALUES
  ('nhima', 'NHIMA Contribution', 1, 1, '2026-01-01', 'National Health Insurance - 1% employee, 1% employer');

-- NAPSA rates (5% each, ceiling K30,408.80/month for 2026)
INSERT INTO public.payroll_tax_config (config_type, label, employee_rate_percent, employer_rate_percent, ceiling_amount, effective_from, notes) VALUES
  ('napsa', 'NAPSA Contribution', 5, 5, 30408.80, '2026-01-01', 'National Pension - 5% each, ceiling K30,408.80/month');

-- ============================================================
-- PAYROLL RUNS: batch processing log
-- ============================================================
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_month integer NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year integer NOT NULL CHECK (payroll_year >= 2020),
  total_employees integer NOT NULL DEFAULT 0,
  total_gross numeric NOT NULL DEFAULT 0,
  total_paye numeric NOT NULL DEFAULT 0,
  total_nhima numeric NOT NULL DEFAULT 0,
  total_napsa numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  total_employer_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_month, payroll_year)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll runs"
  ON public.payroll_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Finance can view payroll runs"
  ON public.payroll_runs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Finance can insert payroll runs"
  ON public.payroll_runs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Finance can update draft payroll runs"
  ON public.payroll_runs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'finance_officer') AND status = 'draft');

-- Add payroll_run_id reference to payroll_records
ALTER TABLE public.payroll_records ADD COLUMN payroll_run_id uuid REFERENCES public.payroll_runs(id);

-- ============================================================
-- Add allowance columns to employees table
-- ============================================================
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS housing_allowance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_allowance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowances numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS napsa_number text,
  ADD COLUMN IF NOT EXISTS nhima_number text,
  ADD COLUMN IF NOT EXISTS tpin text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'bank_transfer';

-- Updated_at trigger for new tables
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_payroll_records_updated_at
  BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_tax_config_updated_at
  BEFORE UPDATE ON public.payroll_tax_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_runs_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ===================================================================
-- FILE: 20260211085246_252e1217-38f0-4ae9-b1e3-f2d225072ea4.sql
-- ===================================================================

-- Add missing columns to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_number text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS nrc_number text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_birth text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'permanent';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_start_date text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS city text;


-- ===================================================================
-- FILE: 20260211180558_e43e750d-5a7d-4b50-be9c-fae941879794.sql
-- ===================================================================
-- Allow admins and staff to update borrower_document_vault (approve/reject)
CREATE POLICY "Staff can update vault documents"
ON public.borrower_document_vault
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

-- Also allow loan officers and credit officers to view vault documents
CREATE POLICY "Staff can view all vaults"
ON public.borrower_document_vault
FOR SELECT
USING (
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

-- ===================================================================
-- FILE: 20260213053402_9716c0a1-b87f-49d6-9dfb-5fa3b558553b.sql
-- ===================================================================
-- Fix: Allow loan_officer and credit_officer to view KYC documents in storage
DROP POLICY IF EXISTS "Users can view KYC documents" ON storage.objects;
CREATE POLICY "Users can view KYC documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'loan-documents'
  AND (storage.foldername(name))[1] = 'kyc'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
  )
);

-- Also update general document view policy to include staff roles
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
CREATE POLICY "Users can view their own documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'loan-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
  )
);

-- Update the ALL policy to include staff roles too
DROP POLICY IF EXISTS "Admins can access all loan documents" ON storage.objects;
CREATE POLICY "Staff can access all loan documents" ON storage.objects
FOR ALL USING (
  bucket_id = 'loan-documents'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
  )
);

-- ===================================================================
-- FILE: 20260213054239_5c241bbb-1d52-44fe-be04-873e850056c9.sql
-- ===================================================================
-- Fix: Convert INSERT policies on loan_applications from RESTRICTIVE to PERMISSIVE
-- RESTRICTIVE policies require ALL to pass, and without a PERMISSIVE policy, nothing passes

-- Drop the restrictive INSERT policies
DROP POLICY IF EXISTS "Users can create applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Admins can create loan applications" ON public.loan_applications;

-- Recreate as PERMISSIVE (default) - OR logic, so either borrower OR admin can insert
CREATE POLICY "Users can create applications"
ON public.loan_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can create loan applications"
ON public.loan_applications
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'loan_officer'::app_role)
);

-- ===================================================================
-- FILE: 20260213060637_9a9c2948-de1b-4e69-814c-85bb00ebffac.sql
-- ===================================================================
-- Fix UPDATE policies on loan_applications: change from RESTRICTIVE to PERMISSIVE
-- Drop existing restrictive UPDATE policies
DROP POLICY IF EXISTS "Borrowers can sign their own contracts" ON public.loan_applications;
DROP POLICY IF EXISTS "Staff and Admins can update all applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Users can update their pending applications" ON public.loan_applications;

-- Recreate as PERMISSIVE (default) so any ONE matching policy grants access
CREATE POLICY "Borrowers can sign their own contracts"
ON public.loan_applications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff and Admins can update all applications"
ON public.loan_applications
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

CREATE POLICY "Users can update their pending applications"
ON public.loan_applications
FOR UPDATE
USING (
  (auth.uid() = user_id AND status = 'pending'::loan_status) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- ===================================================================
-- FILE: 20260213061350_80a3a33a-192f-4abd-8378-0b347b80a9b2.sql
-- ===================================================================

-- Fix the uploaded_by CHECK constraint to allow UUID values (actual user IDs)
ALTER TABLE public.application_documents DROP CONSTRAINT IF EXISTS application_documents_uploaded_by_check;

-- Expand admin INSERT policy to include loan_officer and credit_officer
DROP POLICY IF EXISTS "Admins can upload documents for borrowers" ON public.application_documents;
CREATE POLICY "Admins can upload documents for borrowers"
ON public.application_documents
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);


-- ===================================================================
-- FILE: 20260213175828_b890f112-a970-4b39-9cd6-4bb1171c139a.sql
-- ===================================================================
-- Fix: Convert loan_applications UPDATE policies to PERMISSIVE
-- Currently all 3 UPDATE policies are RESTRICTIVE (AND logic), which means
-- admin must ALSO satisfy borrower-only policies, blocking rejection/approval.

-- Drop the existing RESTRICTIVE UPDATE policies
DROP POLICY IF EXISTS "Borrowers can sign their own contracts" ON public.loan_applications;
DROP POLICY IF EXISTS "Staff and Admins can update all applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Users can update their pending applications" ON public.loan_applications;

-- Recreate as PERMISSIVE (OR logic) â€” any ONE policy passing grants access
CREATE POLICY "Borrowers can sign their own contracts"
ON public.loan_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff and Admins can update all applications"
ON public.loan_applications
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

CREATE POLICY "Users can update their pending applications"
ON public.loan_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending'::loan_status)
WITH CHECK (auth.uid() = user_id AND status = 'pending'::loan_status);

-- ===================================================================
-- FILE: 20260216003253_da68dfd1-25e0-4e5a-983c-52f5ee36092c.sql
-- ===================================================================
-- Add KYC permanent detail fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employer_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type text; -- permanent, contract, casual, other
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_in_employment integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS net_income numeric;

-- ===================================================================
-- FILE: 20260216004253_6fa77773-2ce6-49c3-8898-a666eef03ef4.sql
-- ===================================================================

-- Update disbursement trigger to SMS only
CREATE OR REPLACE FUNCTION public.notify_disbursement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_user_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT la.phone, la.full_name, la.user_id
    INTO v_borrower_phone, v_borrower_name, v_user_id
    FROM loan_applications la WHERE la.id = NEW.loan_id;
    
    IF v_borrower_phone IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id, 'sms', v_borrower_phone, 'Disbursement Confirmation',
        format('Dear %s, K%s has been disbursed to your account. Ref: %s. Your first repayment will be due in 30 days. - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, COALESCE(NEW.transaction_reference, 'N/A')),
        NULL, 'disbursement'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update loan status change trigger: on approval send SMS + Email + contract
CREATE OR REPLACE FUNCTION public.notify_loan_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_loan_amount NUMERIC;
  v_contract_url TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_borrower_email := NEW.email;
    v_borrower_phone := NEW.phone;
    v_borrower_name := NEW.full_name;
    v_loan_amount := NEW.loan_amount;
    v_contract_url := NEW.contract_url;
    
    -- APPROVED: SMS + Email + Contract
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Approved',
          format('Congratulations %s! Your loan application for K%s has been APPROVED. Please review and sign your loan contract. Check your email for the contract document. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          format('Loan Approved - K%s', v_loan_amount::TEXT), 'loan_approval'
        );
      END IF;
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Approved',
          format('Congratulations %s! Your loan for K%s has been APPROVED. Please check your email for the loan contract. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          NULL, 'loan_approval'
        );
      END IF;
    END IF;

    -- CONTRACT SIGNING: Send contract document via Email + SMS
    IF NEW.status = 'contract_signing' AND (OLD.status IS NULL OR OLD.status != 'contract_signing') THEN
      IF v_borrower_email IS NOT NULL AND v_contract_url IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Contract Ready',
          format('Dear %s, your loan contract for K%s is ready for signing. Please review the attached contract document and sign it. Contract: %s - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT, v_contract_url),
          format('Loan Contract - K%s', v_loan_amount::TEXT), 'contract_signing'
        );
      END IF;
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Contract Ready',
          format('Dear %s, your loan contract for K%s is ready. Please check your email for the contract document to sign. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          NULL, 'contract_signing'
        );
      END IF;
    END IF;
    
    -- REJECTED: Email + SMS
    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Application Update',
          format('Dear %s, we regret to inform you that your loan application was not approved at this time. Please contact us for more information. - Phindu Finance', v_borrower_name),
          'Loan Application Update', 'loan_rejection'
        );
      END IF;
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Application Update',
          format('Dear %s, please check your email regarding your loan application status. - Phindu Finance', v_borrower_name),
          NULL, 'loan_rejection'
        );
      END IF;
    END IF;
    
    -- COMPLETED: Email + SMS
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Completed',
          format('Congratulations %s! You have successfully completed all loan repayments. Your account is now clear. Thank you for banking with Phindu Finance!', v_borrower_name),
          'Loan Completed - Congratulations!', 'loan_completion'
        );
      END IF;
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Completed',
          format('Congratulations %s! Your loan has been fully repaid. Check your email for clearance certificate. - Phindu Finance', v_borrower_name),
          NULL, 'loan_completion'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;


-- ===================================================================
-- FILE: 20260216005802_4653ff77-7a15-4715-a764-e0ae995bbc86.sql
-- ===================================================================

-- Allow staff to INSERT into borrower_document_vault on behalf of borrowers
CREATE POLICY "Staff can insert vault documents"
ON public.borrower_document_vault
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

-- Allow staff to INSERT into borrower_kyc_info on behalf of borrowers
CREATE POLICY "Staff can insert kyc info"
ON public.borrower_kyc_info
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

-- Allow staff to INSERT references on behalf of borrowers
CREATE POLICY "Staff can insert references"
ON public.borrower_references
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

-- Allow staff to UPDATE references
CREATE POLICY "Staff can update references"
ON public.borrower_references
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role)
);

-- Allow staff to DELETE references
CREATE POLICY "Staff can delete references"
ON public.borrower_references
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);


-- ===================================================================
-- FILE: 20260225151249_dabd08f0-6e7f-4219-8b42-8dce8a6989cd.sql
-- ===================================================================

-- 1. Allow loan_officer to read system_settings (operational keys only)
CREATE POLICY "Loan officers can read operational settings"
  ON public.system_settings FOR SELECT
  USING (
    has_role(auth.uid(), 'loan_officer'::app_role)
    AND key IN (
      'contract_templates', 'company_info', 'general_config', 'lending_rules',
      'notification_settings', 'notification_providers', 'brevo_settings'
    )
  );

-- 2. Allow loan_officer to read contract_templates table
CREATE POLICY "Loan officers can view contract templates"
  ON public.contract_templates FOR SELECT
  USING (
    has_role(auth.uid(), 'loan_officer'::app_role)
  );

-- 3. Allow loan_officer to view all disbursements
CREATE POLICY "Staff can view all disbursements"
  ON public.disbursements FOR SELECT
  USING (
    has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'collections_officer'::app_role)
  );

-- 4. Allow loan_officer to view all repayments
CREATE POLICY "Staff can view all repayments"
  ON public.loan_repayments FOR SELECT
  USING (
    has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'collections_officer'::app_role)
  );


-- ===================================================================
-- FILE: 20260305182326_81d4523d-91fc-4d6f-8e76-6114fdd39e4f.sql
-- ===================================================================
-- Enable realtime for repayments and disbursements (loan_applications already enabled)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_repayments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disbursements;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ===================================================================
-- FILE: 20260305182346_289253f5-c264-41b5-81d7-dddd3c0002d2.sql
-- ===================================================================
-- Product Document Requirements table
CREATE TABLE public.product_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_product_id UUID NOT NULL REFERENCES public.loan_products(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  allowed_file_types TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png', 'application/pdf'],
  max_file_size_mb INTEGER DEFAULT 10,
  validity_days INTEGER,
  can_reuse_previous BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(loan_product_id, document_type)
);

ALTER TABLE public.product_document_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read product document requirements"
  ON public.product_document_requirements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'loan_officer'::app_role)
    OR public.has_role(auth.uid(), 'credit_officer'::app_role)
    OR public.has_role(auth.uid(), 'finance_officer'::app_role)
  );

CREATE POLICY "Admins can manage product document requirements"
  ON public.product_document_requirements FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER update_product_doc_req_updated_at
  BEFORE UPDATE ON public.product_document_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===================================================================
-- FILE: 20260305182503_030eba0d-e7dd-4686-8676-ea7856d33e09.sql
-- ===================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ===================================================================
-- FILE: 20260317122250_cda91193-bb1d-421d-930d-4ffadd05ab61.sql
-- ===================================================================

-- Add parent_loan_id to loan_applications for reloan chaining
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS parent_loan_id uuid REFERENCES public.loan_applications(id);

-- Create index for fast chain lookups
CREATE INDEX IF NOT EXISTS idx_loan_applications_parent_loan_id ON public.loan_applications(parent_loan_id);

-- Create loan_events table for full audit trail of actions
CREATE TABLE public.loan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'reloan', 'top_up', 'restructure', 'disbursement', 'early_settlement', 'penalty_applied', 'payment_reversal'
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  
  -- Before/after snapshots
  previous_values jsonb, -- { principal, interest_rate, term, total_repayment, monthly_payment, ... }
  new_values jsonb,      -- { principal, interest_rate, term, total_repayment, monthly_payment, ... }
  
  -- Action-specific metadata
  reason text,
  source_account_id uuid REFERENCES public.accounts(id),
  amount numeric,                -- e.g. top-up additional amount, disbursement amount
  fees_charged numeric DEFAULT 0,
  net_amount numeric,            -- amount after fees
  
  -- Linked records
  new_loan_id uuid REFERENCES public.loan_applications(id), -- for reloans: the new loan created
  document_url text,             -- auto-generated amended contract/schedule PDF
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loan_events ENABLE ROW LEVEL SECURITY;

-- Staff can view loan events
CREATE POLICY "Staff can view loan events"
ON public.loan_events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role) OR
  has_role(auth.uid(), 'finance_officer'::app_role) OR
  has_role(auth.uid(), 'collections_officer'::app_role) OR
  has_role(auth.uid(), 'auditor'::app_role)
);

-- Staff can insert loan events
CREATE POLICY "Staff can insert loan events"
ON public.loan_events
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role) OR
  has_role(auth.uid(), 'finance_officer'::app_role)
);

-- Borrowers can view events on their own loans
CREATE POLICY "Borrowers can view own loan events"
ON public.loan_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loan_applications la
    WHERE la.id = loan_events.loan_id AND la.user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX idx_loan_events_loan_id ON public.loan_events(loan_id);
CREATE INDEX idx_loan_events_event_type ON public.loan_events(event_type);
CREATE INDEX idx_loan_events_new_loan_id ON public.loan_events(new_loan_id);


-- ===================================================================
-- FILE: 20260317184852_37d90ac2-f634-4cec-a83e-dc78cc473ea4.sql
-- ===================================================================

ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS product_specific_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_loan_applications_product_data
ON public.loan_applications USING gin (product_specific_data);


-- ===================================================================
-- FILE: 20260318080339_b359c698-a01f-41d8-8ab7-e894eb17817b.sql
-- ===================================================================
-- Fix penalty calculation: use loan principal (loan_amount) instead of installment amount
CREATE OR REPLACE FUNCTION public.calculate_repayment_penalty(p_repayment_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan_id uuid;
  v_due_date date;
  v_days_overdue integer;
  v_penalty_rate numeric;
  v_grace_period integer;
  v_penalty numeric;
  v_loan_amount numeric;  -- principal sum
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get repayment details
  SELECT loan_id, due_date
  INTO v_loan_id, v_due_date
  FROM public.loan_repayments
  WHERE id = p_repayment_id;
  
  IF v_loan_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate days overdue
  v_days_overdue := CURRENT_DATE - v_due_date;
  IF v_days_overdue <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Get penalty rate, grace period, and PRINCIPAL from loan product
  SELECT 
    COALESCE(lp.late_payment_penalty_percent, 5),
    COALESCE(lp.grace_period_days, 0),
    la.loan_amount  -- Use principal sum, not installment amount
  INTO v_penalty_rate, v_grace_period, v_loan_amount
  FROM public.loan_applications la
  LEFT JOIN public.loan_products lp ON la.loan_product_id = lp.id
  WHERE la.id = v_loan_id;
  
  -- Apply grace period
  v_days_overdue := v_days_overdue - v_grace_period;
  IF v_days_overdue <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Calculate penalty on PRINCIPAL (monthly rate applied per month overdue)
  v_penalty := v_loan_amount * (v_penalty_rate / 100) * CEIL(v_days_overdue::numeric / 30);
  
  -- Update the repayment record with calculated penalty
  UPDATE public.loan_repayments
  SET penalty_amount = v_penalty
  WHERE id = p_repayment_id;
  
  RETURN v_penalty;
END;
$$;

-- ===================================================================
-- FILE: 20260318082511_160a740b-a1aa-4867-80fb-6a1d9805dfe6.sql
-- ===================================================================
-- Fix Business Loan required_documents: add proper document_type values
UPDATE public.loan_products
SET required_documents = '[
  {"document_type": "nrc_front", "document_name": "NRC Front", "is_mandatory": true, "display_order": 1},
  {"document_type": "nrc_back", "document_name": "NRC Back", "is_mandatory": true, "display_order": 2},
  {"document_type": "selfie_holding_nrc", "document_name": "Selfie Holding NRC", "is_mandatory": true, "display_order": 3},
  {"document_type": "certificate_of_incorporation", "document_name": "Certificate of Incorporation", "is_mandatory": true, "display_order": 4},
  {"document_type": "shareholders_details", "document_name": "Shareholders Details", "is_mandatory": true, "display_order": 5},
  {"document_type": "proof_of_business", "document_name": "Proof of Place of Business", "is_mandatory": true, "display_order": 6},
  {"document_type": "financial_statement", "document_name": "Financial Statement", "is_mandatory": true, "display_order": 7}
]'::jsonb
WHERE name = 'Business Loan';

-- Fix Collateral Based Loan required_documents
UPDATE public.loan_products
SET required_documents = '[
  {"document_type": "nrc_front", "document_name": "NRC Front", "is_mandatory": true, "display_order": 1},
  {"document_type": "nrc_back", "document_name": "NRC Back", "is_mandatory": true, "display_order": 2},
  {"document_type": "selfie_holding_nrc", "document_name": "Selfie Holding NRC", "is_mandatory": true, "display_order": 3},
  {"document_type": "collateral_full_details", "document_name": "Collateral Full Details", "is_mandatory": true, "display_order": 4},
  {"document_type": "collateral_pictures", "document_name": "Collateral Pictures", "is_mandatory": true, "display_order": 5},
  {"document_type": "collateral_value_estimate", "document_name": "Estimated Value of Collateral", "is_mandatory": true, "display_order": 6},
  {"document_type": "proof_of_residence", "document_name": "Proof of Residence", "is_mandatory": true, "display_order": 7}
]'::jsonb
WHERE name = 'Collateral Based Loan';

-- Fix Salary Advance Loan required_documents
UPDATE public.loan_products
SET required_documents = '[
  {"document_type": "nrc_front", "document_name": "NRC Front", "is_mandatory": true, "display_order": 1},
  {"document_type": "nrc_back", "document_name": "NRC Back", "is_mandatory": true, "display_order": 2},
  {"document_type": "selfie_holding_nrc", "document_name": "Selfie Holding NRC", "is_mandatory": true, "display_order": 3},
  {"document_type": "bank_statement_1", "document_name": "Bank Statement - Month 1", "is_mandatory": true, "display_order": 4},
  {"document_type": "bank_statement_2", "document_name": "Bank Statement - Month 2", "is_mandatory": true, "display_order": 5},
  {"document_type": "bank_statement_3", "document_name": "Bank Statement - Month 3", "is_mandatory": true, "display_order": 6},
  {"document_type": "payslip_1", "document_name": "Payslip 1 (Latest)", "is_mandatory": true, "display_order": 7},
  {"document_type": "payslip_2", "document_name": "Payslip 2", "is_mandatory": true, "display_order": 8},
  {"document_type": "payslip_3", "document_name": "Payslip 3", "is_mandatory": true, "display_order": 9},
  {"document_type": "proof_of_residence", "document_name": "Proof of Residence (Utility Bill)", "is_mandatory": true, "display_order": 10}
]'::jsonb
WHERE name = 'Salary Advance Loan';

-- ===================================================================
-- FILE: 20260324054920_e9a0a9a5-d0c5-4060-ac3f-2f74ad5f00b5.sql
-- ===================================================================

CREATE OR REPLACE FUNCTION public.cancel_repayments_on_loan_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('rejected', 'defaulted', 'completed') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('rejected', 'defaulted', 'completed')) THEN
    
    UPDATE public.loan_repayments
    SET status = 'cancelled'
    WHERE loan_id = NEW.id
    AND status IN ('pending', 'overdue');
    
    UPDATE public.notification_logs
    SET status = 'cancelled'
    WHERE user_id = NEW.user_id
    AND status = 'pending'
    AND title IN ('Overdue Payment Reminder', 'Payment Due Reminder', 'Payment Due Soon');
    
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_repayments_on_closure ON public.loan_applications;
CREATE TRIGGER trg_cancel_repayments_on_closure
  AFTER UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_repayments_on_loan_closure();

UPDATE public.loan_repayments
SET status = 'cancelled'
WHERE loan_id IN (
  SELECT id FROM public.loan_applications 
  WHERE status IN ('rejected', 'defaulted')
)
AND status IN ('pending', 'overdue');

UPDATE public.notification_logs
SET status = 'cancelled'
WHERE user_id IN (
  SELECT user_id FROM public.loan_applications 
  WHERE status IN ('rejected', 'defaulted')
)
AND status = 'pending'
AND title IN ('Overdue Payment Reminder', 'Payment Due Reminder', 'Payment Due Soon');


-- ===================================================================
-- FILE: 20260327071753_bc00083f-ce8c-4b2b-8301-272a27b07b15.sql
-- ===================================================================

ALTER TABLE public.loan_applications 
  ADD COLUMN IF NOT EXISTS penalty_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defaulted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS legal_referred_at timestamp with time zone;


-- ===================================================================
-- FILE: 20260401100607_3a020eb0-8c06-41a7-8300-55726f14fc6b.sql
-- ===================================================================
ALTER TABLE public.loan_products
ADD COLUMN IF NOT EXISTS flat_interest_mode text
CHECK (flat_interest_mode IN ('recurring', 'one_time'));

-- ===================================================================
-- FILE: 20260401101329_d23f1e56-3ec9-45a7-8f0e-8f76d226df66.sql
-- ===================================================================

-- 1) Prevent negative repayment amount
ALTER TABLE public.loan_repayments
  ADD CONSTRAINT loan_repayments_amount_non_negative
  CHECK (amount >= 0);

-- 2) Prevent negative principal_paid
ALTER TABLE public.loan_repayments
  ADD CONSTRAINT loan_repayments_principal_paid_non_negative
  CHECK (coalesce(principal_paid, 0) >= 0);

-- 3) Keep principal_paid within original amount when original_amount exists
ALTER TABLE public.loan_repayments
  ADD CONSTRAINT loan_repayments_principal_paid_not_over_original
  CHECK (
    original_amount IS NULL
    OR coalesce(principal_paid, 0) <= original_amount
  );

-- 4) Prevent negative account balances
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_balance_non_negative
  CHECK (balance >= 0);


-- ===================================================================
-- FILE: 20260401120000_phase4_financial_hardening.sql
-- ===================================================================
-- Phase 4 hardening: invariants + idempotency guards for critical financial operations.

-- 1) Numeric safety constraints (added as NOT VALID to avoid blocking deployment on legacy rows).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_balance_non_negative'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_balance_non_negative CHECK (balance >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_repayments_amount_non_negative'
  ) THEN
    ALTER TABLE public.loan_repayments
      ADD CONSTRAINT loan_repayments_amount_non_negative CHECK (amount >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_repayments_principal_paid_non_negative'
  ) THEN
    ALTER TABLE public.loan_repayments
      ADD CONSTRAINT loan_repayments_principal_paid_non_negative CHECK (COALESCE(principal_paid, 0) >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_repayments_principal_paid_not_over_amount'
  ) THEN
    ALTER TABLE public.loan_repayments
      ADD CONSTRAINT loan_repayments_principal_paid_not_over_amount CHECK (COALESCE(principal_paid, 0) <= amount) NOT VALID;
  END IF;
END $$;

-- 2) Idempotency for borrower claim submissions: one pending claim per borrower+repayment.
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_claims_pending_per_user_repayment
  ON public.payment_claims (user_id, repayment_id)
  WHERE status = 'pending';

-- 3) Idempotency for disbursement transaction references once completed.
CREATE UNIQUE INDEX IF NOT EXISTS ux_disbursements_completed_txn_reference
  ON public.disbursements (transaction_reference)
  WHERE status = 'completed' AND transaction_reference IS NOT NULL;

-- 4) Idempotency for disbursement ledger posting.
CREATE UNIQUE INDEX IF NOT EXISTS ux_account_transactions_disbursement_reference
  ON public.account_transactions (reference_id)
  WHERE transaction_type = 'disbursement' AND reference_id IS NOT NULL;

-- 5) Normalize notes visibility query pattern.
CREATE INDEX IF NOT EXISTS idx_loan_notes_visibility
  ON public.loan_notes (loan_id, is_internal, created_at DESC);


-- ===================================================================
-- FILE: 20260406091500_phase1_workflow_backbone.sql
-- ===================================================================
-- Phase 1 workflow backbone
-- Adds lifecycle transition audit table, timeline visibility, and payment claim review fields.

-- 1) Explicit transition audit table
CREATE TABLE IF NOT EXISTS public.loan_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('borrower', 'admin', 'system')),
  actor_id uuid REFERENCES auth.users(id),
  reason_code text,
  reason_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_status_transitions_loan_id
  ON public.loan_status_transitions (loan_id, created_at DESC);

ALTER TABLE public.loan_status_transitions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'loan_status_transitions'
      AND policyname = 'Staff can read loan status transitions'
  ) THEN
    CREATE POLICY "Staff can read loan status transitions"
      ON public.loan_status_transitions FOR SELECT TO authenticated
      USING (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'loan_officer'::app_role)
        OR has_role(auth.uid(), 'credit_officer'::app_role)
        OR has_role(auth.uid(), 'finance_officer'::app_role)
        OR has_role(auth.uid(), 'collections_officer'::app_role)
        OR has_role(auth.uid(), 'auditor'::app_role)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'loan_status_transitions'
      AND policyname = 'Borrowers can read own loan status transitions'
  ) THEN
    CREATE POLICY "Borrowers can read own loan status transitions"
      ON public.loan_status_transitions FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.loan_applications la
          WHERE la.id = loan_status_transitions.loan_id
            AND la.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 2) Timeline visibility column for borrower/admin scopes
ALTER TABLE public.loan_events
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'both'
  CHECK (visibility IN ('borrower', 'admin', 'both'));

CREATE INDEX IF NOT EXISTS idx_loan_events_visibility ON public.loan_events(visibility);

-- 3) Payment claim handshake fields
ALTER TABLE public.payment_claims
  ADD COLUMN IF NOT EXISTS review_comment text,
  ADD COLUMN IF NOT EXISTS decision_reason_code text;

-- Expand state model while staying backward-compatible
DO $$
BEGIN
  ALTER TABLE public.payment_claims
    DROP CONSTRAINT IF EXISTS payment_claims_status_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.payment_claims
  ADD CONSTRAINT payment_claims_status_check
  CHECK (status IN ('pending', 'pending_review', 'needs_more_info', 'approved', 'verified', 'rejected'));

-- Prevent duplicate pending claims for same repayment/user
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_claims_unique_pending
  ON public.payment_claims (repayment_id, user_id)
  WHERE status IN ('pending', 'pending_review', 'needs_more_info');


-- ===================================================================
-- FILE: 20260406104457_ed690046-699d-4cf3-b17f-535df865d820.sql
-- ===================================================================

CREATE OR REPLACE FUNCTION public.enforce_loan_application_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('under_review', 'rejected', 'crb_failed', 'pmic_pending') THEN
    RETURN NEW;
  ELSIF OLD.status = 'under_review' AND NEW.status IN ('approved', 'rejected', 'crb_failed', 'pmic_pending', 'contract_signing') THEN
    RETURN NEW;
  ELSIF OLD.status = 'approved' AND NEW.status IN ('contract_signing', 'awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'contract_signing' AND NEW.status IN ('awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'awaiting_disbursement' AND NEW.status IN ('disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'disbursed' AND NEW.status IN ('active', 'completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'active' AND NEW.status IN ('completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'defaulted' AND NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid loan_applications status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_loan_application_status_transition ON public.loan_applications;
CREATE TRIGGER trg_enforce_loan_application_status_transition
BEFORE UPDATE OF status ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_loan_application_status_transition();

CREATE OR REPLACE FUNCTION public.enforce_disbursement_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid disbursements status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_disbursement_status_transition ON public.disbursements;
CREATE TRIGGER trg_enforce_disbursement_status_transition
BEFORE UPDATE OF status ON public.disbursements
FOR EACH ROW
EXECUTE FUNCTION public.enforce_disbursement_status_transition();

CREATE OR REPLACE FUNCTION public.enforce_payroll_run_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status IN ('approved', 'cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'approved' AND NEW.status IN ('paid', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid payroll_runs status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payroll_run_status_transition ON public.payroll_runs;
CREATE TRIGGER trg_enforce_payroll_run_status_transition
BEFORE UPDATE OF status ON public.payroll_runs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payroll_run_status_transition();


-- ===================================================================
-- FILE: 20260406104506_3a65d6df-a962-4908-a642-46d5642dcf9d.sql
-- ===================================================================

ALTER FUNCTION public.enforce_loan_application_status_transition() SET search_path = public;
ALTER FUNCTION public.enforce_disbursement_status_transition() SET search_path = public;
ALTER FUNCTION public.enforce_payroll_run_status_transition() SET search_path = public;


-- ===================================================================
-- FILE: 20260406130000_workflow_transition_guards.sql
-- ===================================================================
-- Enforce server-side status transition integrity for critical workflows.
-- Date: 2026-04-06

CREATE OR REPLACE FUNCTION public.enforce_loan_application_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('under_review', 'rejected', 'crb_failed', 'pmic_pending') THEN
    RETURN NEW;
  ELSIF OLD.status = 'under_review' AND NEW.status IN ('approved', 'rejected', 'crb_failed', 'pmic_pending', 'contract_signing') THEN
    RETURN NEW;
  ELSIF OLD.status = 'approved' AND NEW.status IN ('contract_signing', 'awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'contract_signing' AND NEW.status IN ('awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'awaiting_disbursement' AND NEW.status IN ('disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'disbursed' AND NEW.status IN ('active', 'completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'active' AND NEW.status IN ('completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'defaulted' AND NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid loan_applications status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_loan_application_status_transition ON public.loan_applications;
CREATE TRIGGER trg_enforce_loan_application_status_transition
BEFORE UPDATE OF status ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_loan_application_status_transition();

CREATE OR REPLACE FUNCTION public.enforce_disbursement_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid disbursements status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_disbursement_status_transition ON public.disbursements;
CREATE TRIGGER trg_enforce_disbursement_status_transition
BEFORE UPDATE OF status ON public.disbursements
FOR EACH ROW
EXECUTE FUNCTION public.enforce_disbursement_status_transition();

CREATE OR REPLACE FUNCTION public.enforce_payroll_run_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status IN ('approved', 'cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'approved' AND NEW.status IN ('paid', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid payroll_runs status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payroll_run_status_transition ON public.payroll_runs;
CREATE TRIGGER trg_enforce_payroll_run_status_transition
BEFORE UPDATE OF status ON public.payroll_runs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payroll_run_status_transition();


-- ===================================================================
-- FILE: 20260407120000_rbac_canonical_permission_functions.sql
-- ===================================================================
-- Canonical RBAC functions for role_permissions(role_name, permission_id) + roles(name)
-- Re-applies the 20260209 join model so UI get_my_permissions / has_permission stay aligned
-- after any migration that may have replaced these with a code/role_id variant.

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_name = ur.role::text
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.module = _module
      AND p.action = _action
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(module TEXT, action TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_name = ur.role::text
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.has_permission(UUID, TEXT, TEXT) IS 'True if user has permission via role_permissions.role_name matching user_roles.role';
COMMENT ON FUNCTION public.get_my_permissions() IS 'Distinct (module, action) for current user via role_name RBAC model';


-- ===================================================================
-- FILE: 20260408120000_admin_expense_status_rpc.sql
-- ===================================================================
-- Atomic expense approve / reject / paid with ledger posting (single transaction)

CREATE OR REPLACE FUNCTION public.admin_set_expense_status(
  p_expense_id uuid,
  p_new_status text,
  p_reject_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  e RECORD;
  acc RECORD;
  v_new_bal numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_new_status NOT IN ('approved', 'rejected', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  IF NOT public.has_permission(v_uid, 'expenses', 'approve') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  SELECT * INTO e FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expense not found');
  END IF;

  IF p_new_status = 'approved' AND e.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending expenses can be approved');
  END IF;
  IF p_new_status = 'rejected' AND e.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending expenses can be rejected');
  END IF;
  IF p_new_status = 'paid' AND e.status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only approved expenses can be marked paid');
  END IF;

  IF p_new_status = 'approved' THEN
    UPDATE public.expenses
    SET
      status = 'approved',
      approved_at = now(),
      approved_by = v_uid,
      updated_at = now()
    WHERE id = p_expense_id;

  ELSIF p_new_status = 'rejected' THEN
    UPDATE public.expenses
    SET
      status = 'rejected',
      updated_at = now(),
      description = CASE
        WHEN p_reject_reason IS NOT NULL AND length(trim(p_reject_reason)) > 0 THEN
          concat_ws(E'\n', COALESCE(e.description, ''), concat('Rejected: ', trim(p_reject_reason)))
        ELSE COALESCE(e.description, '')
      END
    WHERE id = p_expense_id;

  ELSIF p_new_status = 'paid' THEN
    IF e.account_id IS NOT NULL THEN
      SELECT * INTO acc FROM public.accounts WHERE id = e.account_id FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Linked account not found');
      END IF;
      v_new_bal := acc.balance - e.amount;
      IF v_new_bal < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance in the linked account');
      END IF;

      UPDATE public.accounts
      SET balance = v_new_bal, updated_at = now()
      WHERE id = e.account_id;

      INSERT INTO public.account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        destination,
        reference_type,
        reference_id,
        notes
      ) VALUES (
        e.account_id,
        'expense',
        e.amount,
        acc.balance,
        v_new_bal,
        e.vendor_payee,
        'expense',
        e.id,
        format('Expense: %s - %s', e.expense_category, e.vendor_payee)
      );
    END IF;

    UPDATE public.expenses
    SET
      status = 'paid',
      paid_at = now(),
      updated_at = now()
    WHERE id = p_expense_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_set_expense_status(uuid, text, text) IS 'Approve/reject/paid for expenses with optional account ledger in one transaction';

GRANT EXECUTE ON FUNCTION public.admin_set_expense_status(uuid, text, text) TO authenticated;


-- ===================================================================
-- FILE: 20260408121000_admin_writeoff_rpcs.sql
-- ===================================================================
-- Atomic write-off approve / reject / recovery (audit + collection activity in one transaction)

CREATE OR REPLACE FUNCTION public.admin_approve_loan_writeoff(p_writeoff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  w RECORD;
  v_borrower text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Write-off not found');
  END IF;
  IF w.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending write-offs can be approved');
  END IF;

  SELECT la.full_name INTO v_borrower FROM public.loan_applications la WHERE la.id = w.loan_id;

  UPDATE public.loan_writeoffs
  SET
    status = 'approved',
    approved_at = now(),
    approved_by = v_uid,
    updated_at = now()
  WHERE id = p_writeoff_id;

  UPDATE public.loan_applications
  SET status = 'defaulted', updated_at = now()
  WHERE id = w.loan_id;

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, details, module
  ) VALUES (
    v_uid,
    'WRITEOFF_APPROVED',
    'loan_writeoff',
    p_writeoff_id,
    jsonb_build_object(
      'loan_id', w.loan_id,
      'amount', w.writeoff_amount,
      'borrower', v_borrower
    ),
    'writeoffs'
  );

  INSERT INTO public.collection_activities (
    loan_id, activity_type, notes, outcome
  ) VALUES (
    w.loan_id,
    'writeoff_approved',
    format('Write-off approved. Amount: K%s', to_char(w.writeoff_amount, 'FM999,999,999,990.00')),
    'Loan written off - marked as defaulted'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_loan_writeoff(p_writeoff_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  w RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Write-off not found');
  END IF;
  IF w.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending write-offs can be rejected');
  END IF;

  UPDATE public.loan_writeoffs
  SET
    status = 'rejected',
    recovery_notes = format('Rejected: %s', COALESCE(nullif(trim(p_reason), ''), 'no reason')),
    updated_at = now()
  WHERE id = p_writeoff_id;

  INSERT INTO public.collection_activities (
    loan_id, activity_type, notes, outcome
  ) VALUES (
    w.loan_id,
    'writeoff_rejected',
    format('Write-off rejected. Reason: %s', COALESCE(nullif(trim(p_reason), ''), 'n/a')),
    'Continue collection efforts'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_writeoff_recovery(
  p_writeoff_id uuid,
  p_amount numeric,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  w RECORD;
  v_new_recovery numeric;
  v_line text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid recovery amount');
  END IF;

  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Write-off not found');
  END IF;
  IF w.status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recovery only for approved write-offs');
  END IF;

  v_new_recovery := COALESCE(w.recovery_amount, 0) + p_amount;
  v_line := format(E'\n[%s] Recovered K%s: %s',
    to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
    to_char(p_amount, 'FM999,999,999,990.00'),
    COALESCE(nullif(trim(p_notes), ''), '')
  );

  UPDATE public.loan_writeoffs
  SET
    recovery_amount = v_new_recovery,
    recovery_notes = trim(both E'\n' from concat_ws(E'\n', COALESCE(w.recovery_notes, ''), v_line)),
    updated_at = now()
  WHERE id = p_writeoff_id;

  INSERT INTO public.collection_activities (
    loan_id, activity_type, notes, outcome
  ) VALUES (
    w.loan_id,
    'recovery_recorded',
    format('Recovery recorded: K%s. %s', to_char(p_amount, 'FM999,999,999,990.00'), COALESCE(nullif(trim(p_notes), ''), '')),
    format('Total recovered: K%s', to_char(v_new_recovery, 'FM999,999,999,990.00'))
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_approve_loan_writeoff(uuid) IS 'Approve pending write-off, mark loan defaulted, audit + activity';
COMMENT ON FUNCTION public.admin_reject_loan_writeoff(uuid, text) IS 'Reject pending write-off with reason';
COMMENT ON FUNCTION public.admin_record_writeoff_recovery(uuid, numeric, text) IS 'Append recovery amount/notes on approved write-off';

GRANT EXECUTE ON FUNCTION public.admin_approve_loan_writeoff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_loan_writeoff(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_writeoff_recovery(uuid, numeric, text) TO authenticated;


-- ===================================================================
-- FILE: 20260408122000_admin_mark_loan_defaulted.sql
-- ===================================================================
-- Mark active/disbursed loan as defaulted (audited, single transaction)

CREATE OR REPLACE FUNCTION public.admin_mark_loan_defaulted(
  p_loan_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  la RECORD;
  v_prev_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_permission(v_uid, 'loans', 'edit') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required (min 3 characters)');
  END IF;

  SELECT id, status INTO la FROM public.loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  v_prev_status := la.status::text;
  IF la.status::text NOT IN ('active', 'disbursed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only active or disbursed loans can be marked defaulted');
  END IF;

  UPDATE public.loan_applications
  SET status = 'defaulted', updated_at = now()
  WHERE id = p_loan_id;

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, module, details
  ) VALUES (
    v_uid,
    'MOVE_TO_DEFAULTED',
    'loan_application',
    p_loan_id,
    'loans',
    jsonb_build_object('reason', trim(p_reason), 'previous_status', v_prev_status)
  );

  INSERT INTO public.loan_events (
    loan_id, event_type, performed_by, reason, previous_values, new_values
  ) VALUES (
    p_loan_id,
    'manual_default',
    v_uid,
    trim(p_reason),
    jsonb_build_object('status', v_prev_status),
    jsonb_build_object('status', 'defaulted')
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_mark_loan_defaulted(uuid, text) IS 'Move loan to defaulted with reason; audit + loan_events';

GRANT EXECUTE ON FUNCTION public.admin_mark_loan_defaulted(uuid, text) TO authenticated;


-- ===================================================================
-- FILE: 20260408123000_crb_requests_rls_tighten.sql
-- ===================================================================
-- Tighten crb_requests policies to RBAC permissions (least privilege)

DROP POLICY IF EXISTS "Staff can view CRB requests" ON public.crb_requests;
CREATE POLICY "Staff can view CRB requests" ON public.crb_requests
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'loans', 'view')
    OR public.has_permission(auth.uid(), 'loans', 'finance_approve')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Staff can insert CRB requests" ON public.crb_requests;
CREATE POLICY "Staff can insert CRB requests" ON public.crb_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'loans', 'view')
    OR public.has_permission(auth.uid(), 'loans', 'finance_approve')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Staff can update CRB requests" ON public.crb_requests;
CREATE POLICY "Staff can update CRB requests" ON public.crb_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'loans', 'finance_approve')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );


-- ===================================================================
-- FILE: 20260408124000_reports_query_indexes.sql
-- ===================================================================
-- Support admin report filters (date ranges, disbursement timeline, repayment schedules)

CREATE INDEX IF NOT EXISTS idx_loan_applications_reports_created_at
  ON public.loan_applications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_applications_reports_disbursed_at
  ON public.loan_applications (disbursed_at DESC)
  WHERE disbursed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loan_repayments_reports_due_date
  ON public.loan_repayments (due_date);

CREATE INDEX IF NOT EXISTS idx_loan_repayments_reports_loan_id
  ON public.loan_repayments (loan_id);

