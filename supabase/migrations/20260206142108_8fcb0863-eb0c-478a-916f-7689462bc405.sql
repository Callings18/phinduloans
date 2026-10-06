
-- =====================================================
-- PHINDU LOANS: Application Documents System
-- Date: 2026-02-06
-- Purpose: Fix document storage limitations and enable
--          dynamic, product-specific document requirements
-- =====================================================

-- 1. Create Application Documents Table
CREATE TABLE IF NOT EXISTS public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  loan_product_id UUID REFERENCES public.loan_products(id),
  doc_type TEXT NOT NULL,
  doc_label TEXT NOT NULL,
  month_tag TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by TEXT CHECK (uploaded_by IN ('borrower', 'admin')) DEFAULT 'borrower',
  payslip_password TEXT,
  is_required BOOLEAN DEFAULT true,
  status TEXT CHECK (status IN ('uploaded', 'verified', 'rejected', 'pending_review')) DEFAULT 'uploaded',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_docs_application ON public.application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_app_docs_borrower ON public.application_documents(borrower_id);
CREATE INDEX IF NOT EXISTS idx_app_docs_type ON public.application_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_app_docs_status ON public.application_documents(status);

ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Borrowers can view own documents" ON public.application_documents;
CREATE POLICY "Borrowers can view own documents"
ON public.application_documents FOR SELECT
USING (auth.uid() = borrower_id);

DROP POLICY IF EXISTS "Borrowers can upload documents" ON public.application_documents;
CREATE POLICY "Borrowers can upload documents"
ON public.application_documents FOR INSERT
WITH CHECK (auth.uid() = borrower_id);

DROP POLICY IF EXISTS "Admins can view all documents" ON public.application_documents;
CREATE POLICY "Admins can view all documents"
ON public.application_documents FOR SELECT
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
);

DROP POLICY IF EXISTS "Admins can verify/reject documents" ON public.application_documents;
CREATE POLICY "Admins can verify/reject documents"
ON public.application_documents FOR UPDATE
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
);

DROP POLICY IF EXISTS "Admins can upload documents for borrowers" ON public.application_documents;
CREATE POLICY "Admins can upload documents for borrowers"
ON public.application_documents FOR INSERT
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
);

DROP TRIGGER IF EXISTS update_application_documents_updated_at ON public.application_documents;
CREATE TRIGGER update_application_documents_updated_at
BEFORE UPDATE ON public.application_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Migrate existing documents
DO $$
DECLARE
  app_record RECORD;
BEGIN
  FOR app_record IN 
    SELECT id, user_id, loan_product_id, nrc_front_url, nrc_back_url, payslip_url, selfie_url, created_at
    FROM public.loan_applications
    WHERE nrc_front_url IS NOT NULL OR nrc_back_url IS NOT NULL OR payslip_url IS NOT NULL OR selfie_url IS NOT NULL
  LOOP
    IF app_record.nrc_front_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'NRC_FRONT', 'NRC Front', app_record.nrc_front_url, 
        substring(app_record.nrc_front_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;

    IF app_record.nrc_back_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'NRC_BACK', 'NRC Back', app_record.nrc_back_url, 
        substring(app_record.nrc_back_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;

    IF app_record.payslip_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'PAYSLIP', 'Latest Payslip', app_record.payslip_url, 
        substring(app_record.payslip_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;

    IF app_record.selfie_url IS NOT NULL THEN
      INSERT INTO public.application_documents (
        borrower_id, application_id, loan_product_id, doc_type, doc_label, 
        file_url, file_name, uploaded_at, uploaded_by, is_required, status
      ) VALUES (
        app_record.user_id, app_record.id, app_record.loan_product_id, 
        'SELFIE', 'Selfie Photo', app_record.selfie_url, 
        substring(app_record.selfie_url from '[^/]+$'), 
        app_record.created_at, 'borrower', true, 'uploaded'
      );
    END IF;
  END LOOP;
END $$;

-- 4. Add required_documents JSONB field to loan_products
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'loan_products' 
    AND column_name = 'required_documents'
  ) THEN
    ALTER TABLE public.loan_products ADD COLUMN required_documents JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 5. Set default required documents for existing loan products
UPDATE public.loan_products
SET required_documents = '[
  {"doc_type": "NRC_FRONT", "doc_label": "NRC Front", "is_mandatory": true, "display_order": 1},
  {"doc_type": "NRC_BACK", "doc_label": "NRC Back", "is_mandatory": true, "display_order": 2},
  {"doc_type": "SELFIE", "doc_label": "Selfie Photo", "is_mandatory": true, "display_order": 3},
  {"doc_type": "PAYSLIP", "doc_label": "Latest Payslip", "is_mandatory": true, "display_order": 4, "allow_multiple": true, "max_count": 3},
  {"doc_type": "BANK_STATEMENT", "doc_label": "Bank Statement (3 months)", "is_mandatory": false, "display_order": 5},
  {"doc_type": "EMPLOYER_LETTER", "doc_label": "Employment Letter", "is_mandatory": false, "display_order": 6}
]'::jsonb
WHERE required_documents IS NULL OR required_documents = '[]'::jsonb;

-- 6. Create Borrower Document Vault table
CREATE TABLE IF NOT EXISTS public.borrower_document_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_label TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_borrower ON public.borrower_document_vault(borrower_id);
CREATE INDEX IF NOT EXISTS idx_vault_type ON public.borrower_document_vault(doc_type);

ALTER TABLE public.borrower_document_vault ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Borrowers can manage their vault" ON public.borrower_document_vault;
CREATE POLICY "Borrowers can manage their vault"
ON public.borrower_document_vault FOR ALL
USING (auth.uid() = borrower_id);

DROP POLICY IF EXISTS "Admins can view all vaults" ON public.borrower_document_vault;
CREATE POLICY "Admins can view all vaults"
ON public.borrower_document_vault FOR SELECT
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
);

DROP TRIGGER IF EXISTS update_borrower_document_vault_updated_at ON public.borrower_document_vault;
CREATE TRIGGER update_borrower_document_vault_updated_at
BEFORE UPDATE ON public.borrower_document_vault
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.application_documents IS 'Stores all documents uploaded for loan applications.';
COMMENT ON TABLE public.borrower_document_vault IS 'Permanent document storage for borrowers.';
COMMENT ON COLUMN public.loan_products.required_documents IS 'JSONB array of required documents for this loan product.';
