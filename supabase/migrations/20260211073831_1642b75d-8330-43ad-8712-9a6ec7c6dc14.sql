
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
