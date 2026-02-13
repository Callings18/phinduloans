-- Fix: Allow loan_officer and credit_officer to view KYC documents in storage
DROP POLICY IF EXISTS "Users can view KYC documents" ON storage.objects;
CREATE POLICY "Users can view KYC documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'loan-documents'
  AND (storage.foldername(name))[1] = 'kyc'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
  )
);

-- Also update general document view policy to include staff roles
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
CREATE POLICY "Users can view their own documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'loan-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
  )
);

-- Update the ALL policy to include staff roles too
DROP POLICY IF EXISTS "Admins can access all loan documents" ON storage.objects;
CREATE POLICY "Staff can access all loan documents" ON storage.objects
FOR ALL USING (
  bucket_id = 'loan-documents'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
  )
);