-- Drop the old conflicting ALL policy (uses 'public' role, not 'authenticated')
DROP POLICY IF EXISTS "Borrowers can manage their vault" ON public.borrower_document_vault;

-- Fix storage: allow uploads to kyc/ subfolder paths
-- The current policies require foldername[1] = auth.uid(), but uploads go to kyc/{userId}/...
-- Add a policy that allows authenticated users to upload to kyc/{their_uid}/ paths
DROP POLICY IF EXISTS "Users can upload KYC documents" ON storage.objects;
CREATE POLICY "Users can upload KYC documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'loan-documents' 
  AND (storage.foldername(name))[1] = 'kyc' 
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view KYC documents" ON storage.objects;
CREATE POLICY "Users can view KYC documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'loan-documents' 
  AND (storage.foldername(name))[1] = 'kyc' 
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);