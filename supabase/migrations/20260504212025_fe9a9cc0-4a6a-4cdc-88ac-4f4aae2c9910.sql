-- 1. Add gender + marital_status to profiles for borrower auto-fill
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT;

-- 2. Drafts table for save-and-resume on loan creation
CREATE TABLE IF NOT EXISTS public.loan_application_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  borrower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_user_id, borrower_id, product_code)
);

CREATE INDEX IF NOT EXISTS idx_loan_app_drafts_staff ON public.loan_application_drafts(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_loan_app_drafts_borrower ON public.loan_application_drafts(borrower_id);

ALTER TABLE public.loan_application_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage own drafts" ON public.loan_application_drafts;
CREATE POLICY "Staff manage own drafts"
  ON public.loan_application_drafts
  FOR ALL
  TO authenticated
  USING (
    staff_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    staff_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER update_loan_app_drafts_updated_at
  BEFORE UPDATE ON public.loan_application_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
