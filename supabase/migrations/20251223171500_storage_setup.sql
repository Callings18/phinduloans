-- Create a bucket for loan documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('loan_documents', 'loan_documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload their own documents
CREATE POLICY "Allow authenticated users to upload loan documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'loan_documents');

-- Policy: Allow authenticated users to view their own documents
CREATE POLICY "Allow users to view own loan documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'loan_documents' AND (select auth.uid()) = owner);

-- Policy: Allow staff/admins to view all loan documents
CREATE POLICY "Allow staff to view all loan documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'loan_documents' AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE public.user_roles.user_id = auth.uid() 
    AND public.user_roles.role IN ('admin', 'super_admin', 'loan_officer', 'credit_officer', 'finance_officer', 'auditor')
  )
);
