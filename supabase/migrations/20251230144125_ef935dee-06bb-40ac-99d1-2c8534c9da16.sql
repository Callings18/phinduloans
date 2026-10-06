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
CREATE INDEX IF NOT EXISTS idx_crb_requests_borrower ON public.crb_requests(borrower_id);
CREATE INDEX IF NOT EXISTS idx_crb_requests_loan ON public.crb_requests(loan_application_id);
CREATE INDEX IF NOT EXISTS idx_crb_requests_nrc ON public.crb_requests(nrc_number);
CREATE INDEX IF NOT EXISTS idx_guarantees_loan ON public.guarantees(loan_id);
CREATE INDEX IF NOT EXISTS idx_guarantees_status ON public.guarantees(status);

-- Add trigger for guarantees updated_at
DROP TRIGGER IF EXISTS update_guarantees_updated_at ON public.guarantees;
CREATE TRIGGER update_guarantees_updated_at
  BEFORE UPDATE ON public.guarantees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();