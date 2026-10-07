-- Purge live loans for named borrowers (full cascade — same as admin_purge_loan_application).
-- Project: seobilifwyxhtjvsgqpc — run in Supabase Dashboard → SQL Editor as postgres.
--
-- Targets all loans matching the named borrowers (any status). Preview first; then run the DO block.

-- ========== STEP 0: ALL LOANS FOR THESE NAMES (any status) ==========
SELECT la.status, count(*) AS n
FROM public.loan_applications la
WHERE (
    la.full_name ILIKE '%Mwango%Ngosa%'
    OR la.full_name ILIKE '%Cynthia%Ngosa%'
    OR la.full_name ILIKE '%Bupe%Kabinda%'
    OR la.full_name ILIKE '%Musuku%Kabinda%'
    OR la.full_name ILIKE '%Mathews%Tembo%'
    OR la.full_name ILIKE '%Matthew%Tembo%'
    OR la.full_name ILIKE '%Twiza%Nankamba%'
    OR la.full_name ILIKE '%Mulenga%Mwale%'
    OR la.full_name ILIKE '%Rueben%Mwale%'
    OR la.full_name ILIKE '%Reuben%Mwale%'
    OR la.full_name ILIKE '%Suwilanji%Nankamba%'
  )
GROUP BY la.status
ORDER BY la.status;

-- ========== STEP 1: PREVIEW (rows that will be purged) ==========
SELECT
  la.id,
  la.full_name,
  la.status,
  la.loan_amount,
  la.created_at::date AS created,
  COALESCE(lp.product_code, '(no product)') AS product_code
FROM public.loan_applications la
LEFT JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE (
    la.full_name ILIKE '%Mwango%Ngosa%'
    OR la.full_name ILIKE '%Cynthia%Ngosa%'
    OR la.full_name ILIKE '%Bupe%Kabinda%'
    OR la.full_name ILIKE '%Musuku%Kabinda%'
    OR la.full_name ILIKE '%Mathews%Tembo%'
    OR la.full_name ILIKE '%Matthew%Tembo%'
    OR la.full_name ILIKE '%Twiza%Nankamba%'
    OR la.full_name ILIKE '%Mulenga%Mwale%'
    OR la.full_name ILIKE '%Rueben%Mwale%'
    OR la.full_name ILIKE '%Reuben%Mwale%'
    OR la.full_name ILIKE '%Suwilanji%Nankamba%'
  )
ORDER BY la.full_name, la.created_at;

-- ========== STEP 2: PURGE ==========
DO $$
DECLARE
  v_loan_ids uuid[];
  v_id uuid;
  v_disb_ids uuid[];
  v_repay_ids uuid[];
  v_status text;
BEGIN
  SELECT array_agg(la.id ORDER BY la.created_at) INTO v_loan_ids
  FROM public.loan_applications la
  WHERE (
      la.full_name ILIKE '%Mwango%Ngosa%'
      OR la.full_name ILIKE '%Cynthia%Ngosa%'
      OR la.full_name ILIKE '%Bupe%Kabinda%'
      OR la.full_name ILIKE '%Musuku%Kabinda%'
      OR la.full_name ILIKE '%Mathews%Tembo%'
      OR la.full_name ILIKE '%Matthew%Tembo%'
      OR la.full_name ILIKE '%Twiza%Nankamba%'
      OR la.full_name ILIKE '%Mulenga%Mwale%'
      OR la.full_name ILIKE '%Rueben%Mwale%'
      OR la.full_name ILIKE '%Reuben%Mwale%'
      OR la.full_name ILIKE '%Suwilanji%Nankamba%'
    );

  IF v_loan_ids IS NULL OR array_length(v_loan_ids, 1) IS NULL THEN
    RAISE NOTICE 'No matching active/disbursed loans to delete.';
    RETURN;
  END IF;

  FOREACH v_id IN ARRAY v_loan_ids LOOP
    SELECT status INTO v_status FROM public.loan_applications WHERE id = v_id;

    SELECT array_agg(id) INTO v_disb_ids FROM public.disbursements WHERE loan_id = v_id;
    SELECT array_agg(id) INTO v_repay_ids FROM public.loan_repayments WHERE loan_id = v_id;

    DELETE FROM public.account_transactions
    WHERE (reference_type = 'disbursement' AND reference_id = ANY(COALESCE(v_disb_ids, ARRAY[]::uuid[])))
       OR (reference_type = 'repayment' AND reference_id = ANY(COALESCE(v_repay_ids, ARRAY[]::uuid[])))
       OR (reference_type = 'loan' AND reference_id = v_id);

    BEGIN DELETE FROM public.loan_repayments_history WHERE loan_id = v_id; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM public.loan_repayments WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.disbursements WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.payment_claims WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.loan_events WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.loan_status_transitions WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.application_documents WHERE application_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.loan_borrowers WHERE loan_application_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.loan_notes WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.loan_documents WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.loan_collateral WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.loan_reviews WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.loan_assignments WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.notifications WHERE related_loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.approval_workflow_steps WHERE loan_id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;

    DELETE FROM public.loan_applications WHERE id = v_id;

    RAISE NOTICE 'Purged loan % (was %)', v_id, v_status;
  END LOOP;
END $$;

-- ========== STEP 3: VERIFY ==========
SELECT count(*) AS remaining
FROM public.loan_applications la
WHERE (
    la.full_name ILIKE '%Ngosa%'
    OR la.full_name ILIKE '%Kabinda%'
    OR la.full_name ILIKE '%Tembo%'
    OR la.full_name ILIKE '%Nankamba%'
    OR la.full_name ILIKE '%Mwale%'
  );
