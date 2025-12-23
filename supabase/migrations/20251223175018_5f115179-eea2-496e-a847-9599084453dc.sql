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