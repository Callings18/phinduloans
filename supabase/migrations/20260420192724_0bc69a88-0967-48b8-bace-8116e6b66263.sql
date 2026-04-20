CREATE TABLE IF NOT EXISTS public.product_house_borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL,
  borrower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_house_borrowers_product_code_borrower_id_key UNIQUE (product_code, borrower_id)
);

CREATE INDEX IF NOT EXISTS idx_product_house_borrowers_product_code
  ON public.product_house_borrowers (product_code);

CREATE INDEX IF NOT EXISTS idx_product_house_borrowers_borrower_id
  ON public.product_house_borrowers (borrower_id);

CREATE OR REPLACE FUNCTION public.set_product_house_borrowers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_house_borrowers_updated_at ON public.product_house_borrowers;
CREATE TRIGGER trg_product_house_borrowers_updated_at
BEFORE UPDATE ON public.product_house_borrowers
FOR EACH ROW
EXECUTE FUNCTION public.set_product_house_borrowers_updated_at();

INSERT INTO public.product_house_borrowers (product_code, borrower_id)
SELECT DISTINCT lp.product_code, p.id
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
JOIN public.profiles p ON p.id = la.user_id
WHERE lp.product_code IS NOT NULL
ON CONFLICT (product_code, borrower_id) DO NOTHING;

ALTER TABLE public.product_house_borrowers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_house_borrowers_select" ON public.product_house_borrowers;
CREATE POLICY "product_house_borrowers_select"
ON public.product_house_borrowers
FOR SELECT
TO authenticated
USING (
  borrower_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_product_access(auth.uid(), product_code)
);

DROP POLICY IF EXISTS "product_house_borrowers_insert" ON public.product_house_borrowers;
CREATE POLICY "product_house_borrowers_insert"
ON public.product_house_borrowers
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_product_access(auth.uid(), product_code)
);

DROP POLICY IF EXISTS "product_house_borrowers_update" ON public.product_house_borrowers;
CREATE POLICY "product_house_borrowers_update"
ON public.product_house_borrowers
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_product_access(auth.uid(), product_code)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_product_access(auth.uid(), product_code)
);

DROP POLICY IF EXISTS "product_house_borrowers_delete" ON public.product_house_borrowers;
CREATE POLICY "product_house_borrowers_delete"
ON public.product_house_borrowers
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_product_access(auth.uid(), product_code)
);