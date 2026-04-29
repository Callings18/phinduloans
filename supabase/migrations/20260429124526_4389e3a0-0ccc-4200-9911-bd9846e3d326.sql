-- 1) Enum for borrower roles
DO $$ BEGIN
  CREATE TYPE public.loan_borrower_role AS ENUM (
    'PRIMARY_BORROWER', 'CO_BORROWER', 'ABSOLUTE_OWNER', 'GUARANTOR'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Table: loan_borrowers
CREATE TABLE IF NOT EXISTS public.loan_borrowers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  nrc_number text NOT NULL,
  phone text,
  address text,
  role public.loan_borrower_role NOT NULL,
  is_signatory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_loan_borrowers_application ON public.loan_borrowers(loan_application_id);
CREATE INDEX IF NOT EXISTS idx_loan_borrowers_role ON public.loan_borrowers(loan_application_id, role);

-- Only one PRIMARY_BORROWER per application
CREATE UNIQUE INDEX IF NOT EXISTS loan_borrowers_one_primary_per_loan
  ON public.loan_borrowers(loan_application_id)
  WHERE role = 'PRIMARY_BORROWER';

-- 3) updated_at trigger
DROP TRIGGER IF EXISTS trg_loan_borrowers_updated_at ON public.loan_borrowers;
CREATE TRIGGER trg_loan_borrowers_updated_at
  BEFORE UPDATE ON public.loan_borrowers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Safety trigger: only Collateral loans may have CO_BORROWER / ABSOLUTE_OWNER
CREATE OR REPLACE FUNCTION public.enforce_collateral_only_borrowers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_code text;
BEGIN
  IF NEW.role IN ('CO_BORROWER', 'ABSOLUTE_OWNER') THEN
    SELECT lp.product_code INTO v_product_code
    FROM public.loan_applications la
    LEFT JOIN public.loan_products lp ON lp.id = la.loan_product_id
    WHERE la.id = NEW.loan_application_id;

    IF v_product_code IS DISTINCT FROM 'COLLATERAL' THEN
      RAISE EXCEPTION 'Co-Borrowers and Absolute Owners are only allowed on Collateral loans (got product_code=%).', COALESCE(v_product_code, 'NULL');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_collateral_only_borrowers ON public.loan_borrowers;
CREATE TRIGGER trg_enforce_collateral_only_borrowers
  BEFORE INSERT OR UPDATE ON public.loan_borrowers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_collateral_only_borrowers();

-- 5) RLS
ALTER TABLE public.loan_borrowers ENABLE ROW LEVEL SECURITY;

-- Borrower (loan owner) can view their own
DROP POLICY IF EXISTS "Borrowers view own loan_borrowers" ON public.loan_borrowers;
CREATE POLICY "Borrowers view own loan_borrowers"
  ON public.loan_borrowers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.loan_applications la
      WHERE la.id = loan_application_id AND la.user_id = auth.uid()
    )
  );

-- Borrower can insert/update/delete while application is still editable
DROP POLICY IF EXISTS "Borrowers manage own loan_borrowers (editable states)" ON public.loan_borrowers;
CREATE POLICY "Borrowers manage own loan_borrowers (editable states)"
  ON public.loan_borrowers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loan_applications la
      WHERE la.id = loan_application_id
        AND la.user_id = auth.uid()
        AND la.status IN ('pending', 'under_review')
    )
  );

DROP POLICY IF EXISTS "Borrowers update own loan_borrowers (editable states)" ON public.loan_borrowers;
CREATE POLICY "Borrowers update own loan_borrowers (editable states)"
  ON public.loan_borrowers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.loan_applications la
      WHERE la.id = loan_application_id
        AND la.user_id = auth.uid()
        AND la.status IN ('pending', 'under_review')
    )
  );

DROP POLICY IF EXISTS "Borrowers delete own loan_borrowers (editable states)" ON public.loan_borrowers;
CREATE POLICY "Borrowers delete own loan_borrowers (editable states)"
  ON public.loan_borrowers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.loan_applications la
      WHERE la.id = loan_application_id
        AND la.user_id = auth.uid()
        AND la.status IN ('pending', 'under_review')
    )
  );

-- Staff full access
DROP POLICY IF EXISTS "Staff manage all loan_borrowers" ON public.loan_borrowers;
CREATE POLICY "Staff manage all loan_borrowers"
  ON public.loan_borrowers FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'loan_officer')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'loan_officer')
  );