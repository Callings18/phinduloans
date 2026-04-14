-- House workflow RPC endpoints + write policies

CREATE OR REPLACE FUNCTION public.house_stage_review(
  p_loan_id UUID,
  p_stage TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_code TEXT;
  v_uid UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT lp.product_code
  INTO v_product_code
  FROM public.loan_applications la
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE la.id = p_loan_id;

  IF v_product_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Loan not found');
  END IF;

  IF NOT public.has_product_access(v_uid, v_product_code) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No product access');
  END IF;

  IF p_stage = 'loan_officer' THEN
    IF NOT public.has_permission(v_uid, 'house', 'review_officer_approve') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing house.review.officer_approve');
    END IF;
    UPDATE public.loan_applications
    SET
      status = 'under_review',
      approval_stage = 'loan_officer_approved',
      reviewed_by = v_uid,
      reviewed_at = v_now
    WHERE id = p_loan_id;
  ELSIF p_stage = 'finance' THEN
    IF NOT public.has_permission(v_uid, 'house', 'review_finance_approve') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing house.review.finance_approve');
    END IF;
    UPDATE public.loan_applications
    SET
      status = 'under_review',
      approval_stage = 'finance_approved',
      finance_verified_by = v_uid,
      finance_verified_at = v_now
    WHERE id = p_loan_id;
  ELSIF p_stage = 'manager' THEN
    IF NOT public.has_permission(v_uid, 'house', 'review_manager_approve') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing house.review.manager_approve');
    END IF;
    UPDATE public.loan_applications
    SET
      status = 'approved',
      approval_stage = 'manager_approved',
      approved_by = v_uid,
      approved_at = v_now
    WHERE id = p_loan_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid review stage');
  END IF;

  RETURN jsonb_build_object('ok', true, 'loan_id', p_loan_id, 'stage', p_stage, 'comment', p_comment);
END;
$$;

CREATE OR REPLACE FUNCTION public.house_set_loan_status(
  p_loan_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_code TEXT;
  v_uid UUID := auth.uid();
BEGIN
  SELECT lp.product_code
  INTO v_product_code
  FROM public.loan_applications la
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE la.id = p_loan_id;

  IF v_product_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Loan not found');
  END IF;

  IF NOT public.has_product_access(v_uid, v_product_code) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No product access');
  END IF;

  IF p_status = 'approved' THEN
    IF NOT public.has_permission(v_uid, 'house', 'review_manager_approve') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing approval permission');
    END IF;
    RETURN public.transition_loan_status(p_action => 'approve', p_loan_id => p_loan_id, p_reason => p_reason);
  ELSIF p_status = 'rejected' THEN
    IF NOT public.has_permission(v_uid, 'house', 'loans_update') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing house.loans.update');
    END IF;
    RETURN public.transition_loan_status(p_action => 'reject', p_loan_id => p_loan_id, p_reason => p_reason);
  ELSIF p_status = 'disbursed' THEN
    IF NOT public.has_permission(v_uid, 'house', 'disbursement_disburse') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing house.disbursement.disburse');
    END IF;
    RETURN public.transition_loan_status(p_action => 'disburse', p_loan_id => p_loan_id, p_reason => p_reason);
  ELSE
    IF NOT public.has_permission(v_uid, 'house', 'loans_update') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing house.loans.update');
    END IF;
    UPDATE public.loan_applications
    SET status = p_status::public.loan_status
    WHERE id = p_loan_id;
    RETURN jsonb_build_object('ok', true, 'loan_id', p_loan_id, 'status', p_status);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.house_mark_disbursement_completed(p_disbursement_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_code TEXT;
  v_uid UUID := auth.uid();
BEGIN
  SELECT lp.product_code
  INTO v_product_code
  FROM public.disbursements d
  JOIN public.loan_applications la ON la.id = d.loan_id
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE d.id = p_disbursement_id;

  IF v_product_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Disbursement not found');
  END IF;

  IF NOT public.has_product_access(v_uid, v_product_code)
     OR NOT public.has_permission(v_uid, 'house', 'disbursement_disburse') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not permitted');
  END IF;

  UPDATE public.disbursements
  SET status = 'completed'
  WHERE id = p_disbursement_id;

  RETURN jsonb_build_object('ok', true, 'disbursement_id', p_disbursement_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.house_mark_repayment_paid(p_repayment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_code TEXT;
  v_uid UUID := auth.uid();
BEGIN
  SELECT lp.product_code
  INTO v_product_code
  FROM public.loan_repayments lr
  JOIN public.loan_applications la ON la.id = lr.loan_id
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE lr.id = p_repayment_id;

  IF v_product_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Repayment not found');
  END IF;

  IF NOT public.has_product_access(v_uid, v_product_code)
     OR NOT public.has_permission(v_uid, 'house', 'collections_manage') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not permitted');
  END IF;

  UPDATE public.loan_repayments
  SET status = 'paid'
  WHERE id = p_repayment_id;

  RETURN jsonb_build_object('ok', true, 'repayment_id', p_repayment_id);
END;
$$;

DROP POLICY IF EXISTS "house_product_scope_loan_applications_update" ON public.loan_applications;
CREATE POLICY "house_product_scope_loan_applications_update"
  ON public.loan_applications
  FOR UPDATE
  USING (
    public.has_product_access(
      auth.uid(),
      (SELECT lp.product_code FROM public.loan_products lp WHERE lp.id = loan_product_id LIMIT 1)
    )
  )
  WITH CHECK (
    public.has_product_access(
      auth.uid(),
      (SELECT lp.product_code FROM public.loan_products lp WHERE lp.id = loan_product_id LIMIT 1)
    )
  );

DROP POLICY IF EXISTS "house_product_scope_disbursements_update" ON public.disbursements;
CREATE POLICY "house_product_scope_disbursements_update"
  ON public.disbursements
  FOR UPDATE
  USING (
    public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id))
  )
  WITH CHECK (
    public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id))
  );

DROP POLICY IF EXISTS "house_product_scope_loan_repayments_update" ON public.loan_repayments;
CREATE POLICY "house_product_scope_loan_repayments_update"
  ON public.loan_repayments
  FOR UPDATE
  USING (
    public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id))
  )
  WITH CHECK (
    public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id))
  );
