-- Migration: Unified Application Documents (Phase 1)
-- Extends loan_application_documents for single-doc-model and admin visibility
-- Date: 2026-01-22

-- ============================================================================
-- 1. EXTEND loan_application_documents
-- ============================================================================

ALTER TABLE public.loan_application_documents
  ADD COLUMN IF NOT EXISTS borrower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS doc_label TEXT,
  ADD COLUMN IF NOT EXISTS month_tag TEXT,
  ADD COLUMN IF NOT EXISTS payslip_password TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT DEFAULT 'borrower',
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT;

COMMENT ON COLUMN public.loan_application_documents.borrower_id IS 'Borrower who uploaded (for vault linkage)';
COMMENT ON COLUMN public.loan_application_documents.doc_label IS 'Human-readable label for display';
COMMENT ON COLUMN public.loan_application_documents.month_tag IS 'For payslips: YYYY-MM';
COMMENT ON COLUMN public.loan_application_documents.payslip_password IS 'Password for secured payslip PDFs; admin-only visible';
COMMENT ON COLUMN public.loan_application_documents.uploaded_by IS 'borrower | admin or user id';
COMMENT ON COLUMN public.loan_application_documents.mime_type IS 'e.g. application/pdf, image/jpeg';
COMMENT ON COLUMN public.loan_application_documents.file_name IS 'Original file name';

-- Allow file_url to be nullable for draft/placeholder rows if needed
ALTER TABLE public.loan_application_documents
  ALTER COLUMN file_url DROP NOT NULL;

-- Index for admin listing by application
CREATE INDEX IF NOT EXISTS idx_loan_application_documents_borrower
  ON public.loan_application_documents(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loan_application_documents_type
  ON public.loan_application_documents(loan_application_id, document_type);

-- ============================================================================
-- 2. RLS: Admin can read all docs for applications they can access
-- ============================================================================

-- Ensure staff roles can SELECT (already have "Admins can manage all" which includes SELECT)
-- Add explicit SELECT for credit_officer, finance_officer, auditor if needed
DROP POLICY IF EXISTS "Admins can manage all loan_application_documents" ON public.loan_application_documents;
CREATE POLICY "Admins can manage all loan_application_documents" ON public.loan_application_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'loan_officer', 'credit_officer', 'finance_officer', 'auditor')
    )
  );

-- ============================================================================
-- 3. notification_logs / email log support (for Phase 4 Email Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email_logs" ON public.email_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer', 'credit_officer'))
  );

CREATE POLICY "Service can insert email_logs" ON public.email_logs
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.email_logs IS 'Log of email send attempts for admin Email Log view';

-- ============================================================================
-- 4. BORROWER DOCUMENT VAULT (permanent storage for reuse)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.borrower_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_borrower_documents_user ON public.borrower_documents(user_id);

ALTER TABLE public.borrower_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own borrower_documents" ON public.borrower_documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view borrower_documents" ON public.borrower_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'loan_officer', 'credit_officer'))
  );

COMMENT ON TABLE public.borrower_documents IS 'Borrower document vault for NRC, proof of residence, etc.; reuse from vault on new applications';
