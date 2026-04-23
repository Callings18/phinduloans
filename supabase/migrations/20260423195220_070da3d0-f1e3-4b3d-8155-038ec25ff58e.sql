-- 1. Add legal fee columns to loan_products
ALTER TABLE public.loan_products
  ADD COLUMN IF NOT EXISTS legal_fee_percent numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legal_fee_deduction_mode text NOT NULL DEFAULT 'none';

ALTER TABLE public.loan_products
  DROP CONSTRAINT IF EXISTS loan_products_legal_fee_percent_check;
ALTER TABLE public.loan_products
  ADD CONSTRAINT loan_products_legal_fee_percent_check
  CHECK (legal_fee_percent >= 0 AND legal_fee_percent <= 100);

ALTER TABLE public.loan_products
  DROP CONSTRAINT IF EXISTS loan_products_legal_fee_deduction_mode_check;
ALTER TABLE public.loan_products
  ADD CONSTRAINT loan_products_legal_fee_deduction_mode_check
  CHECK (legal_fee_deduction_mode IN ('none','upfront_net','added_to_repayment'));

-- 2. Constrain interest_period values (allow legacy + new canonical names)
ALTER TABLE public.loan_products
  DROP CONSTRAINT IF EXISTS loan_products_interest_period_check;
ALTER TABLE public.loan_products
  ADD CONSTRAINT loan_products_interest_period_check
  CHECK (
    interest_period IS NULL OR interest_period IN (
      'per_day','per_week','per_month','per_year','per_loan',
      'daily','weekly','monthly','yearly'
    )
  );

-- 3. Duplicate / active loan block
CREATE OR REPLACE FUNCTION public.block_duplicate_active_loan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing RECORD;
  v_open_statuses text[] := ARRAY[
    'pending','under_review','approved','contract_signing',
    'awaiting_disbursement','disbursed','active'
  ];
  v_norm_nrc text;
  v_norm_phone text;
BEGIN
  v_norm_nrc := lower(regexp_replace(COALESCE(NEW.nrc_number, ''), '\s+', '', 'g'));
  v_norm_phone := regexp_replace(COALESCE(NEW.phone, ''), '\s+', '', 'g');

  IF v_norm_nrc = '' OR v_norm_phone = '' THEN
    RETURN NEW;
  END IF;

  SELECT id, status::text AS status_text, full_name, created_at
    INTO v_existing
  FROM public.loan_applications
  WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND lower(regexp_replace(COALESCE(nrc_number, ''), '\s+', '', 'g')) = v_norm_nrc
    AND regexp_replace(COALESCE(phone, ''), '\s+', '', 'g') = v_norm_phone
    AND status::text = ANY (v_open_statuses)
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Borrower already has an open loan (id=%, status=%). Finish, complete, reject, or default it before creating a new application.',
      v_existing.id, v_existing.status_text
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_duplicate_active_loan ON public.loan_applications;
CREATE TRIGGER trg_block_duplicate_active_loan
BEFORE INSERT ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.block_duplicate_active_loan();

-- 4. Helpful index for the lookup above
CREATE INDEX IF NOT EXISTS idx_loan_apps_nrc_phone_status
  ON public.loan_applications (nrc_number, phone, status);