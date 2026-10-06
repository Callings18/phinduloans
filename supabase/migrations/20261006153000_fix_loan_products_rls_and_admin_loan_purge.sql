-- Fix: admins could not create/update loan products because RLS required products.edit
-- while RBAC seeds products.create / products.update (not edit).
-- Also allow admin (not only super_admin) to purge disbursed/active loans when needed.

INSERT INTO public.permissions (module, action, description)
VALUES ('products', 'edit', 'Create and edit loan products')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('admin', 'super_admin')
  AND p.module = 'products'
  AND p.action IN ('edit', 'create', 'update', 'delete', 'view')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.loan_products_write_allowed(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin'::public.app_role)
    OR public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_permission(_user_id, 'products', 'edit')
    OR public.has_permission(_user_id, 'products', 'create')
    OR public.has_permission(_user_id, 'products', 'update');
$$;

CREATE OR REPLACE FUNCTION public.loan_products_delete_allowed(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin'::public.app_role)
    OR public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_permission(_user_id, 'products', 'delete');
$$;

DROP POLICY IF EXISTS "loan_products_insert_policy" ON public.loan_products;
CREATE POLICY "loan_products_insert_policy"
  ON public.loan_products FOR INSERT TO authenticated
  WITH CHECK (public.loan_products_write_allowed(auth.uid()));

DROP POLICY IF EXISTS "loan_products_update_policy" ON public.loan_products;
CREATE POLICY "loan_products_update_policy"
  ON public.loan_products FOR UPDATE TO authenticated
  USING (public.loan_products_write_allowed(auth.uid()))
  WITH CHECK (public.loan_products_write_allowed(auth.uid()));

DROP POLICY IF EXISTS "loan_products_delete_policy" ON public.loan_products;
CREATE POLICY "loan_products_delete_policy"
  ON public.loan_products FOR DELETE TO authenticated
  USING (public.loan_products_delete_allowed(auth.uid()));

COMMENT ON POLICY "loan_products_insert_policy" ON public.loan_products IS
  'Admin/super_admin or products create/update/edit permissions';
COMMENT ON POLICY "loan_products_update_policy" ON public.loan_products IS
  'Admin/super_admin or products create/update/edit permissions';
COMMENT ON POLICY "loan_products_delete_policy" ON public.loan_products IS
  'Admin/super_admin or products.delete permission';

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
  v_is_privileged boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  v_is_privileged :=
    public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role);

  IF NOT (v_is_privileged OR public.has_permission(v_uid, 'loans', 'delete')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT status INTO v_status FROM public.loan_applications WHERE id = p_loan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_status IN ('disbursed', 'active', 'completed', 'defaulted', 'written_off')
     AND NOT v_is_privileged THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'STATUS_BLOCKED',
      'message',
      format('Cannot delete loan in status %s without admin role.', v_status)
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
  'Staff delete for pre-disbursement loans; admin/super_admin may purge live loans when required.';
