-- One-off: remove mistaken Salary Advance house loans (recreate under SALARY_ADVANCE_STAFF).
-- Run in Supabase SQL Editor (Lovable) — STEP 1 preview, STEP 2 delete after IDs look correct.

-- ========== STEP 1: PREVIEW (run alone first) ==========
SELECT
  la.id,
  la.full_name,
  la.status,
  la.loan_amount,
  la.created_at::date AS created,
  lp.product_code
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE lp.product_code = 'SALARY_ADVANCE'
  AND la.status NOT IN ('disbursed', 'active', 'completed', 'defaulted')
  AND (
    la.full_name ILIKE '%Mwango%Ngosa%'
    OR la.full_name ILIKE '%Bupe%Kabinda%'
    OR la.full_name ILIKE '%Musuku%Kabinda%'
    OR la.full_name ILIKE '%Mathews%Tembo%'
    OR la.full_name ILIKE '%Twiza%Nankamba%'
    OR la.full_name ILIKE '%Mulenga%Mwale%'
    OR la.full_name ILIKE '%Rueben%Mwale%'
    OR la.full_name ILIKE '%Reuben%Mwale%'
    OR la.full_name ILIKE '%Suwilanji%Nankamba%'
  )
ORDER BY la.created_at;

-- ========== STEP 2: DELETE (after preview matches ~4 rows) ==========
-- Runs as postgres in SQL Editor (no auth.uid() needed).

DO $$
DECLARE
  v_loan_ids uuid[];
  v_id uuid;
  v_disb_ids uuid[];
  v_repay_ids uuid[];
BEGIN
  SELECT array_agg(la.id) INTO v_loan_ids
  FROM public.loan_applications la
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE lp.product_code = 'SALARY_ADVANCE'
    AND la.status NOT IN ('disbursed', 'active', 'completed', 'defaulted')
    AND (
      la.full_name ILIKE '%Mwango%Ngosa%'
      OR la.full_name ILIKE '%Bupe%Kabinda%'
      OR la.full_name ILIKE '%Musuku%Kabinda%'
      OR la.full_name ILIKE '%Mathews%Tembo%'
      OR la.full_name ILIKE '%Twiza%Nankamba%'
      OR la.full_name ILIKE '%Mulenga%Mwale%'
      OR la.full_name ILIKE '%Rueben%Mwale%'
      OR la.full_name ILIKE '%Reuben%Mwale%'
      OR la.full_name ILIKE '%Suwilanji%Nankamba%'
    );

  IF v_loan_ids IS NULL OR array_length(v_loan_ids, 1) IS NULL THEN
    RAISE NOTICE 'No matching loans to delete.';
    RETURN;
  END IF;

  FOREACH v_id IN ARRAY v_loan_ids LOOP
    SELECT array_agg(id) INTO v_disb_ids FROM public.disbursements WHERE loan_id = v_id;
    SELECT array_agg(id) INTO v_repay_ids FROM public.loan_repayments WHERE loan_id = v_id;

    DELETE FROM public.account_transactions
    WHERE (reference_type = 'disbursement' AND reference_id = ANY(COALESCE(v_disb_ids, ARRAY[]::uuid[])))
       OR (reference_type = 'repayment' AND reference_id = ANY(COALESCE(v_repay_ids, ARRAY[]::uuid[])))
       OR (reference_type = 'loan' AND reference_id = v_id);

    DELETE FROM public.loan_repayments WHERE loan_id = v_id;
    DELETE FROM public.disbursements WHERE loan_id = v_id;
    DELETE FROM public.payment_claims WHERE loan_id = v_id;
    DELETE FROM public.loan_events WHERE loan_id = v_id;
    DELETE FROM public.loan_status_transitions WHERE loan_id = v_id;
    DELETE FROM public.application_documents WHERE application_id = v_id;
    DELETE FROM public.loan_borrowers WHERE loan_application_id = v_id;
    DELETE FROM public.loan_notes WHERE loan_id = v_id;
    DELETE FROM public.loan_applications WHERE id = v_id;

    RAISE NOTICE 'Deleted loan %', v_id;
  END LOOP;
END $$;

-- Verify gone from Salary Advance house:
SELECT count(*) AS remaining
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE lp.product_code = 'SALARY_ADVANCE'
  AND (
    la.full_name ILIKE '%Ngosa%'
    OR la.full_name ILIKE '%Kabinda%'
    OR la.full_name ILIKE '%Tembo%'
    OR la.full_name ILIKE '%Nankamba%'
    OR la.full_name ILIKE '%Mwale%'
  );
