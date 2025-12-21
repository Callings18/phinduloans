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