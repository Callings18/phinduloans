-- One-off: remove ALL loans in the borrower Salary Advance house (wrong product).
-- Run in Supabase SQL Editor on the LIVE project (Lovable/yqrf) as postgres.
-- STEP 1: preview counts. STEP 2: uncomment and run the DO block after confirming.

-- ========== STEP 1: PREVIEW ==========
SELECT lp.product_code, la.status, count(*) AS n
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE lp.product_code = 'SALARY_ADVANCE'
GROUP BY 1, 2
ORDER BY 2;

SELECT la.id, la.full_name, la.status, la.loan_amount, la.created_at::date
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE lp.product_code = 'SALARY_ADVANCE'
ORDER BY la.created_at DESC;

/*
-- ========== STEP 2: PURGE (destructive) ==========
DO $$
DECLARE
  v_id uuid;
  v_disb_ids uuid[];
  v_repay_ids uuid[];
BEGIN
  FOR v_id IN
    SELECT la.id
    FROM public.loan_applications la
    JOIN public.loan_products lp ON lp.id = la.loan_product_id
    WHERE lp.product_code = 'SALARY_ADVANCE'
  LOOP
    SELECT array_agg(id) INTO v_disb_ids FROM public.disbursements WHERE loan_id = v_id;
    SELECT array_agg(id) INTO v_repay_ids FROM public.loan_repayments WHERE loan_id = v_id;

    DELETE FROM public.account_transactions
    WHERE (reference_type = 'disbursement' AND reference_id = ANY(COALESCE(v_disb_ids, ARRAY[]::uuid[])))
       OR (reference_type = 'repayment' AND reference_id = ANY(COALESCE(v_repay_ids, ARRAY[]::uuid[])))
       OR (reference_type = 'loan' AND reference_id = v_id)
       OR (reference_type = 'disbursement_reversal' AND reference_id = v_id);

    DELETE FROM public.collection_activities WHERE loan_id = v_id;
    DELETE FROM public.payment_claims WHERE loan_id = v_id;
    DELETE FROM public.loan_events WHERE loan_id = v_id;
    DELETE FROM public.loan_status_transitions WHERE loan_id = v_id;
    DELETE FROM public.application_documents WHERE application_id = v_id;
    DELETE FROM public.loan_borrowers WHERE loan_application_id = v_id;
    DELETE FROM public.loan_notes WHERE loan_id = v_id;
    DELETE FROM public.loan_repayments WHERE loan_id = v_id;
    DELETE FROM public.disbursements WHERE loan_id = v_id;
    DELETE FROM public.loan_applications WHERE id = v_id;

    RAISE NOTICE 'Purged loan %', v_id;
  END LOOP;
END $$;
*/
