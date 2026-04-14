-- Staged review metadata defaults for house queues

UPDATE public.loan_applications
SET
  approval_stage = COALESCE(approval_stage, 'loan_officer'),
  product_specific_data = COALESCE(product_specific_data, '{}'::jsonb)
    || jsonb_build_object(
      'approvals',
      COALESCE(product_specific_data->'approvals', jsonb_build_object(
        'loan_officer', jsonb_build_object('status', 'pending'),
        'finance', jsonb_build_object('status', 'pending'),
        'manager', jsonb_build_object('status', 'pending')
      ))
    )
WHERE product_specific_data IS NULL
   OR product_specific_data->'approvals' IS NULL
   OR approval_stage IS NULL;
