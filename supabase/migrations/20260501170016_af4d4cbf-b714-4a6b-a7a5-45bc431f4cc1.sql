ALTER TABLE public.loan_applications
  DROP CONSTRAINT IF EXISTS loan_applications_source_check;

ALTER TABLE public.loan_applications
  ADD CONSTRAINT loan_applications_source_check
  CHECK (source = ANY (ARRAY[
    'website'::text,
    'internal'::text,
    'referral'::text,
    'reloan'::text,
    'topup'::text,
    'restructure'::text
  ]));