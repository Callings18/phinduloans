-- Product Document Requirements table
CREATE TABLE public.product_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_product_id UUID NOT NULL REFERENCES public.loan_products(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  allowed_file_types TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png', 'application/pdf'],
  max_file_size_mb INTEGER DEFAULT 10,
  validity_days INTEGER,
  can_reuse_previous BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(loan_product_id, document_type)
);

ALTER TABLE public.product_document_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read product document requirements"
  ON public.product_document_requirements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'loan_officer'::app_role)
    OR public.has_role(auth.uid(), 'credit_officer'::app_role)
    OR public.has_role(auth.uid(), 'finance_officer'::app_role)
  );

CREATE POLICY "Admins can manage product document requirements"
  ON public.product_document_requirements FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER update_product_doc_req_updated_at
  BEFORE UPDATE ON public.product_document_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();