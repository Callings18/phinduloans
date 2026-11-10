-- Keep role-check helpers private to signed-in callers. Staff policies were
-- accidentally created for PUBLIC, causing anonymous API requests to execute
-- helpers that are correctly revoked from anon and surface SQL permission errors.
DO $migration$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles @> ARRAY['public']::name[]
      AND (
        coalesce(qual, '') ~ 'has_(role|permission|product_access)'
        OR coalesce(with_check, '') ~ 'has_(role|permission|product_access)'
      )
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  END LOOP;
END
$migration$;

-- Active loan products are intentionally public for the borrower catalog.
-- Staff can also see inactive products through the authenticated staff policy.
DROP POLICY IF EXISTS "View loan products" ON public.loan_products;
CREATE POLICY "View loan products"
  ON public.loan_products FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Authenticated staff can remove profiles; super_admin-only accounts are
-- treated as administrators even when they do not also carry the admin role.
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- Auth logging is best effort from the client. Restrict it to the caller and
-- the two expected actions, then grant only authenticated execution.
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_action text,
  p_ip_address text DEFAULT NULL,
  p_device_info jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('login', 'signup') THEN
    RAISE EXCEPTION 'Unsupported authentication event' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, ip_address, details
  ) VALUES (
    auth.uid(), p_action, 'user', auth.uid(), p_ip_address,
    CASE WHEN p_device_info IS NOT NULL
      THEN jsonb_build_object('device_info', p_device_info)
      ELSE NULL
    END
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.log_auth_event(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_auth_event(text, text, jsonb) TO authenticated;

-- The lifecycle RPC is SECURITY DEFINER, so enforce authorization inside it
-- before any status mutation. Keep permissions aligned with the current role
-- matrix and the existing disbursement workflow.
CREATE OR REPLACE FUNCTION public.transition_loan_status(
  p_loan_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_loan record;
  v_user_id uuid := auth.uid();
  v_new_stage text;
  v_prev_status text;
  v_new_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_loan FROM public.loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Loan not found');
  END IF;
  v_prev_status := v_loan.status::text;

  IF p_action = 'verify_documents' THEN
    IF NOT public.has_permission(v_user_id, 'loans', 'verify_documents') THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Permission denied');
    END IF;
    UPDATE public.loan_applications
      SET document_verified_by = v_user_id, document_verified_at = now(),
          approval_stage = 'documents_verified', updated_at = now()
      WHERE id = p_loan_id;
    v_new_stage := 'documents_verified';

  ELSIF p_action = 'finance_approve' THEN
    IF NOT public.has_permission(v_user_id, 'loans', 'finance_approve') THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Permission denied');
    END IF;
    UPDATE public.loan_applications
      SET finance_verified_by = v_user_id, finance_verified_at = now(),
          approval_stage = 'finance_approved', updated_at = now()
      WHERE id = p_loan_id;
    v_new_stage := 'finance_approved';

  ELSIF p_action IN ('approve', 'reject') THEN
    IF NOT (
      public.has_permission(v_user_id, 'loans', 'approve')
      OR public.has_permission(v_user_id, 'loans', 'finance_approve')
      OR public.has_role(v_user_id, 'admin'::public.app_role)
      OR public.has_role(v_user_id, 'super_admin'::public.app_role)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Permission denied');
    END IF;
    IF p_action = 'approve' THEN
      UPDATE public.loan_applications
        SET status = 'approved'::public.loan_status, approved_by = v_user_id,
            approved_at = now(), reviewed_by = v_user_id, reviewed_at = now(),
            approval_stage = 'approved', admin_signed = true,
            admin_signed_at = now(), admin_signed_by = v_user_id, updated_at = now()
        WHERE id = p_loan_id;
      v_new_stage := 'approved';
    ELSE
      UPDATE public.loan_applications
        SET status = 'rejected'::public.loan_status,
            rejection_reason = COALESCE(NULLIF(trim(p_reason), ''), 'No reason provided'),
            reviewed_by = v_user_id, reviewed_at = now(),
            approval_stage = 'rejected', updated_at = now()
        WHERE id = p_loan_id;
      v_new_stage := 'rejected';
    END IF;

  ELSIF p_action IN ('disburse', 'activate') THEN
    IF NOT (
      public.has_permission(v_user_id, 'disbursement', 'approve')
      OR public.has_permission(v_user_id, 'disbursement', 'create')
      OR public.has_permission(v_user_id, 'disbursement', 'manage')
      OR public.has_role(v_user_id, 'admin'::public.app_role)
      OR public.has_role(v_user_id, 'super_admin'::public.app_role)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Permission denied');
    END IF;
    IF p_action = 'disburse' THEN
      IF v_prev_status NOT IN ('approved', 'awaiting_disbursement', 'contract_signing') THEN
        RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Cannot disburse loan in status: ' || v_prev_status);
      END IF;
      v_new_status := 'disbursed';
      UPDATE public.loan_applications
        SET status = v_new_status::public.loan_status, disbursed_at = now(),
            disbursed_by = v_user_id, updated_at = now()
        WHERE id = p_loan_id;
    ELSE
      IF v_prev_status <> 'disbursed' THEN
        RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Cannot activate loan in status: ' || v_prev_status);
      END IF;
      v_new_status := 'active';
      UPDATE public.loan_applications SET status = v_new_status::public.loan_status, updated_at = now()
        WHERE id = p_loan_id;
    END IF;
    INSERT INTO public.loan_status_transitions (loan_id, from_status, to_status, actor_type, actor_id, reason_text)
      VALUES (p_loan_id, v_prev_status, v_new_status, 'admin', v_user_id, p_reason);
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, old_values, new_values)
      VALUES (v_user_id, 'STATUS_TRANSITION', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('status', v_prev_status), jsonb_build_object('status', v_new_status, 'action', p_action));
    RETURN jsonb_build_object('ok', true, 'success', true, 'stage', v_new_status);

  ELSIF p_action IN ('complete', 'default') THEN
    IF NOT (
      public.has_permission(v_user_id, 'loans', 'update')
      OR public.has_permission(v_user_id, 'loans', 'edit')
      OR public.has_role(v_user_id, 'admin'::public.app_role)
      OR public.has_role(v_user_id, 'super_admin'::public.app_role)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Permission denied');
    END IF;
    IF p_action = 'complete' THEN
      IF v_prev_status <> 'active' THEN
        RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Cannot complete loan in status: ' || v_prev_status);
      END IF;
      v_new_status := 'completed';
      UPDATE public.loan_applications SET status = v_new_status::public.loan_status, updated_at = now()
        WHERE id = p_loan_id;
    ELSE
      IF v_prev_status NOT IN ('active', 'disbursed') THEN
        RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Cannot default loan in status: ' || v_prev_status);
      END IF;
      IF NULLIF(trim(p_reason), '') IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'A reason is required to mark a loan as defaulted');
      END IF;
      v_new_status := 'defaulted';
      UPDATE public.loan_applications SET status = v_new_status::public.loan_status,
        defaulted_at = now(), updated_at = now() WHERE id = p_loan_id;
    END IF;
    INSERT INTO public.loan_status_transitions (loan_id, from_status, to_status, actor_type, actor_id, reason_text)
      VALUES (p_loan_id, v_prev_status, v_new_status, 'admin', v_user_id, p_reason);
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, old_values, new_values)
      VALUES (v_user_id, 'STATUS_TRANSITION', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('status', v_prev_status), jsonb_build_object('status', v_new_status, 'action', p_action, 'reason', p_reason));
    RETURN jsonb_build_object('ok', true, 'success', true, 'stage', v_new_status);
  ELSE
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Unknown action: ' || p_action);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
    VALUES (v_user_id, p_action, 'loan_application', p_loan_id, 'loans',
      jsonb_build_object('approval_stage', v_new_stage, 'previous_status', v_prev_status));
  RETURN jsonb_build_object('ok', true, 'success', true, 'stage', v_new_stage);
END;
$function$;
REVOKE ALL ON FUNCTION public.transition_loan_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_loan_status(uuid, text, text) TO authenticated;
