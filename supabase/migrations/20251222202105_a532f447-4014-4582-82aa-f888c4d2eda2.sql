-- Update RLS policy to allow anyone to view active loan products (truly public)
DROP POLICY IF EXISTS "Anyone can view active loan products" ON public.loan_products;

CREATE POLICY "Anyone can view active loan products" 
ON public.loan_products 
FOR SELECT 
USING (is_active = true);