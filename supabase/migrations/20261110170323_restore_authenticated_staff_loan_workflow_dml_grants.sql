-- Restore only the table DML grants used by the staff loan workflow.
-- RLS stays enabled and existing table policies remain the authorization boundary.
GRANT INSERT, UPDATE, DELETE ON TABLE public.loan_applications TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.loan_application_drafts TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.application_documents TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.borrower_document_vault TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.loan_borrowers TO authenticated;
