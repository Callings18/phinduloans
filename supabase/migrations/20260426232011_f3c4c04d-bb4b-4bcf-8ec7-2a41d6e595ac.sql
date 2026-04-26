-- Option C: Strictest duplicate-block policy
-- Block new loan applications if ANY of these match an existing loan in active pipeline statuses:
--   1. user_id matches
--   2. normalized NRC matches (when NEW.nrc_number is present)
--   3. normalized phone matches (when NEW.phone is present)

CREATE OR REPLACE FUNCTION public.block_duplicate_active_loan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing RECORD;
  v_open_statuses text[] := ARRAY[
    'pending','under_review','approved','contract_signing',
    'awaiting_disbursement','disbursed','active'
  ];
  v_norm_nrc text;
  v_norm_phone text;
  v_self_id uuid := COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
  v_norm_nrc := lower(regexp_replace(COALESCE(NEW.nrc_number, ''), '\s+', '', 'g'));
  v_norm_phone := regexp_replace(COALESCE(NEW.phone, ''), '\s+', '', 'g');

  SELECT id, status::text AS status_text, full_name, nrc_number, phone, user_id, created_at,
         CASE
           WHEN user_id = NEW.user_id THEN 'user_id'
           WHEN v_norm_nrc <> '' AND lower(regexp_replace(COALESCE(nrc_number, ''), '\s+', '', 'g')) = v_norm_nrc THEN 'nrc'
           WHEN v_norm_phone <> '' AND regexp_replace(COALESCE(phone, ''), '\s+', '', 'g') = v_norm_phone THEN 'phone'
           ELSE 'unknown'
         END AS match_reason
    INTO v_existing
  FROM public.loan_applications
  WHERE id <> v_self_id
    AND status::text = ANY (v_open_statuses)
    AND (
      user_id = NEW.user_id
      OR (v_norm_nrc <> '' AND lower(regexp_replace(COALESCE(nrc_number, ''), '\s+', '', 'g')) = v_norm_nrc)
      OR (v_norm_phone <> '' AND regexp_replace(COALESCE(phone, ''), '\s+', '', 'g') = v_norm_phone)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Borrower already has an open loan (matched_by=%, existing_id=%, status=%). Finish, complete, reject, or default it before creating a new application.',
      v_existing.match_reason, v_existing.id, v_existing.status_text
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;