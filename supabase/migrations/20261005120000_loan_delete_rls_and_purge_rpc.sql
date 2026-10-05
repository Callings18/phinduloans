-- Align loan delete RLS with staff UI (pre-disbursement) + safe purge RPC.

CREATE OR REPLACE FUNCTION public.admin_purge_loan_application(p_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_uid uuid := auth.uid();
  v_disb_ids uuid[];
  v_repay_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_permission(v_uid, 'loans', 'delete')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT status INTO v_status FROM public.loan_applications WHERE id = p_loan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_status IN ('disbursed', 'active', 'completed', 'defaulted', 'written_off')
     AND NOT public.has_role(v_uid, 'super_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'STATUS_BLOCKED',
      'message',
      format('Cannot delete loan in status %s without super_admin.', v_status)
    );
  END IF;

  SELECT array_agg(id) INTO v_disb_ids FROM public.disbursements WHERE loan_id = p_loan_id;
  SELECT array_agg(id) INTO v_repay_ids FROM public.loan_repayments WHERE loan_id = p_loan_id;

  DELETE FROM public.account_transactions
  WHERE (reference_type = 'disbursement' AND reference_id = ANY(COALESCE(v_disb_ids, ARRAY[]::uuid[])))
     OR (reference_type = 'repayment' AND reference_id = ANY(COALESCE(v_repay_ids, ARRAY[]::uuid[])))
     OR (reference_type = 'loan' AND reference_id = p_loan_id);

  BEGIN DELETE FROM public.loan_repayments_history WHERE loan_id = p_loan_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.loan_repayments WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.disbursements WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.payment_claims WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_events WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_status_transitions WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.application_documents WHERE application_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_borrowers WHERE loan_application_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_notes WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_documents WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_collateral WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_reviews WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_assignments WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.notifications WHERE related_loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.approval_workflow_steps WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  DELETE FROM public.loan_applications WHERE id = p_loan_id;

  RETURN jsonb_build_object('ok', true, 'loan_id', p_loan_id, 'previous_status', v_status);
END;
$$;

COMMENT ON FUNCTION public.admin_purge_loan_application IS
  'Staff delete for pre-disbursement loans (and super_admin for any). Cleans dependent rows.';

GRANT EXECUTE ON FUNCTION public.admin_purge_loan_application(uuid) TO authenticated;

DROP POLICY IF EXISTS "Staff can delete applications in early stages" ON public.loan_applications;

CREATE POLICY "Staff can delete applications in early stages"
  ON public.loan_applications FOR DELETE
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      status IN (
        'pending',
        'rejected',
        'under_review',
        'approved',
        'contract_signing',
        'awaiting_disbursement',
        'crb_failed',
        'pmic_pending'
      )
      AND (
        public.has_permission(auth.uid(), 'loans', 'delete')
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'loan_officer'::public.app_role)
        OR public.has_role(auth.uid(), 'credit_officer'::public.app_role)
      )
    )
  );
