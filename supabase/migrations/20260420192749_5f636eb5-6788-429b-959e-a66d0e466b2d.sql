DROP POLICY IF EXISTS "product_house_borrowers_select" ON public.product_house_borrowers;
CREATE POLICY "product_house_borrowers_select"
ON public.product_house_borrowers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = product_house_borrowers.borrower_id
      AND p.id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_product_access(auth.uid(), product_code)
);