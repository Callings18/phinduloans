-- Create storage bucket for loan documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('loan-documents', 'loan-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for loan-documents bucket
DROP POLICY IF EXISTS "Admins can access all loan documents" ON storage.objects;
CREATE POLICY "Admins can access all loan documents"
ON storage.objects FOR ALL
USING (bucket_id = 'loan-documents' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own loan documents" ON storage.objects;
CREATE POLICY "Users can view their own loan documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'loan-documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can upload their own loan documents" ON storage.objects;
CREATE POLICY "Users can upload their own loan documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'loan-documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Add collateral and contract columns to loan_applications if not exists
ALTER TABLE loan_applications 
ADD COLUMN IF NOT EXISTS contract_url text,
ADD COLUMN IF NOT EXISTS collateral_description text,
ADD COLUMN IF NOT EXISTS collateral_value numeric,
ADD COLUMN IF NOT EXISTS admin_notes text;

-- Add DELETE policy for loan_applications for admins
DROP POLICY IF EXISTS "Admins can delete applications" ON loan_applications;
CREATE POLICY "Admins can delete applications"
ON loan_applications FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));