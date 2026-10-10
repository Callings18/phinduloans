-- House workflow hardening: enforce stage sequencing and disbursement prerequisites.

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
  v_approval_stage TEXT;
  v_status public.loan_status;
BEGIN
  SELECT lp.product_code, la.approval_stage, la.status
  INTO v_product_code, v_approval_stage, v_status
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
    IF coalesce(v_approval_stage, '') NOT IN ('', 'pending') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Loan officer stage already completed');
    END IF;
    IF v_status NOT IN ('pending', 'under_review') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Loan is not in reviewable status');
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
    IF coalesce(v_approval_stage, '') <> 'loan_officer_approved' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Finance review requires prior officer approval');
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
    IF coalesce(v_approval_stage, '') <> 'finance_approved' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Manager review requires prior finance approval');
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

CREATE OR REPLACE FUNCTION public.house_mark_disbursement_completed(p_disbursement_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_code TEXT;
  v_uid UUID := auth.uid();
  v_loan_id UUID;
  v_loan_status public.loan_status;
  v_disbursement_status TEXT;
BEGIN
  SELECT lp.product_code, d.loan_id, d.status, la.status
  INTO v_product_code, v_loan_id, v_disbursement_status, v_loan_status
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

  IF v_disbursement_status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'disbursement_id', p_disbursement_id, 'already_completed', true);
  END IF;

  IF v_loan_status NOT IN ('approved', 'disbursed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Loan must be approved before disbursement');
  END IF;

  UPDATE public.disbursements
  SET status = 'completed'
  WHERE id = p_disbursement_id;

  -- Keep loan lifecycle in sync when disbursement finishes.
  UPDATE public.loan_applications
  SET status = 'disbursed'
  WHERE id = v_loan_id
    AND status <> 'disbursed';

  RETURN jsonb_build_object('ok', true, 'disbursement_id', p_disbursement_id);
END;
$$;
