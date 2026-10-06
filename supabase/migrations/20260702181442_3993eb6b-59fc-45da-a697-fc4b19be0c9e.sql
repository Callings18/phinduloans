-- Restrict permission definitions to staff only
DROP POLICY IF EXISTS "Staff can view permissions" ON public.permissions;
CREATE POLICY "Staff can view permissions"
ON public.permissions
FOR SELECT
USING (public.is_staff(auth.uid()));

-- Allow document owners to delete their own loan documents
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'loan-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);