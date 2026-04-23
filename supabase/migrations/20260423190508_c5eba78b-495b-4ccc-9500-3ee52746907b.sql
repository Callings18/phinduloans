-- 1. Normalise NRC + phone on write so spacing/case differences don't bypass the guard
CREATE OR REPLACE FUNCTION public.normalize_loan_application_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nrc_number IS NOT NULL THEN
    NEW.nrc_number := lower(regexp_replace(NEW.nrc_number, '\s+', '', 'g'));
  END IF;
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '\s+', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_loan_application_identity ON public.loan_applications;
CREATE TRIGGER trg_normalize_loan_application_identity
BEFORE INSERT OR UPDATE OF nrc_number, phone
ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.normalize_loan_application_identity();

-- Backfill existing rows once so the unique index can be built without conflicts on whitespace-only differences
UPDATE public.loan_applications
SET nrc_number = lower(regexp_replace(nrc_number, '\s+', '', 'g')),
    phone      = regexp_replace(phone, '\s+', '', 'g')
WHERE nrc_number ~ '\s' OR phone ~ '\s' OR nrc_number <> lower(nrc_number);

-- 2. Partial unique index — only one open application per (nrc, phone)
DROP INDEX IF EXISTS public.loan_applications_open_nrc_phone_uniq;
CREATE UNIQUE INDEX loan_applications_open_nrc_phone_uniq
ON public.loan_applications (nrc_number, phone)
WHERE status IN (
  'pending',
  'awaiting_disbursement',
  'contract_signing',
  'disbursed',
  'active'
);
