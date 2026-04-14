-- Product-scoped access mapping for house modules

CREATE TABLE IF NOT EXISTS public.user_product_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_product_access_product_code_check'
  ) THEN
    ALTER TABLE public.user_product_access
      ADD CONSTRAINT user_product_access_product_code_check
      CHECK (product_code IN ('SALARY_ADVANCE', 'PAYDAY_SOFT', 'COLLATERAL', 'BUSINESS', 'MOTOR_VEHICLE', 'MARKETEER'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_product_access_user_product_idx
  ON public.user_product_access(user_id, product_code);

INSERT INTO public.user_product_access (user_id, product_code, is_active)
SELECT ur.user_id, lp.product_code, true
FROM public.user_roles ur
CROSS JOIN public.loan_products lp
WHERE ur.role IN ('admin', 'super_admin')
  AND lp.product_code IS NOT NULL
ON CONFLICT (user_id, product_code) DO UPDATE
SET is_active = EXCLUDED.is_active;

ALTER TABLE public.user_product_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_product_access_select_own_or_admin" ON public.user_product_access;
CREATE POLICY "user_product_access_select_own_or_admin"
  ON public.user_product_access
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
