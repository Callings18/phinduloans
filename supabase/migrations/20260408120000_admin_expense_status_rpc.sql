-- Atomic expense approve / reject / paid with ledger posting (single transaction)

CREATE OR REPLACE FUNCTION public.admin_set_expense_status(
  p_expense_id uuid,
  p_new_status text,
  p_reject_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  e RECORD;
  acc RECORD;
  v_new_bal numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_new_status NOT IN ('approved', 'rejected', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  IF NOT public.has_permission(v_uid, 'expenses', 'approve') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  SELECT * INTO e FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expense not found');
  END IF;

  IF p_new_status = 'approved' AND e.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending expenses can be approved');
  END IF;
  IF p_new_status = 'rejected' AND e.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending expenses can be rejected');
  END IF;
  IF p_new_status = 'paid' AND e.status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only approved expenses can be marked paid');
  END IF;

  IF p_new_status = 'approved' THEN
    UPDATE public.expenses
    SET
      status = 'approved',
      approved_at = now(),
      approved_by = v_uid,
      updated_at = now()
    WHERE id = p_expense_id;

  ELSIF p_new_status = 'rejected' THEN
    UPDATE public.expenses
    SET
      status = 'rejected',
      updated_at = now(),
      description = CASE
        WHEN p_reject_reason IS NOT NULL AND length(trim(p_reject_reason)) > 0 THEN
          concat_ws(E'\n', COALESCE(e.description, ''), concat('Rejected: ', trim(p_reject_reason)))
        ELSE COALESCE(e.description, '')
      END
    WHERE id = p_expense_id;

  ELSIF p_new_status = 'paid' THEN
    IF e.account_id IS NOT NULL THEN
      SELECT * INTO acc FROM public.accounts WHERE id = e.account_id FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Linked account not found');
      END IF;
      v_new_bal := acc.balance - e.amount;
      IF v_new_bal < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance in the linked account');
      END IF;

      UPDATE public.accounts
      SET balance = v_new_bal, updated_at = now()
      WHERE id = e.account_id;

      INSERT INTO public.account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        destination,
        reference_type,
        reference_id,
        notes
      ) VALUES (
        e.account_id,
        'expense',
        e.amount,
        acc.balance,
        v_new_bal,
        e.vendor_payee,
        'expense',
        e.id,
        format('Expense: %s - %s', e.expense_category, e.vendor_payee)
      );
    END IF;

    UPDATE public.expenses
    SET
      status = 'paid',
      paid_at = now(),
      updated_at = now()
    WHERE id = p_expense_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_set_expense_status(uuid, text, text) IS 'Approve/reject/paid for expenses with optional account ledger in one transaction';

GRANT EXECUTE ON FUNCTION public.admin_set_expense_status(uuid, text, text) TO authenticated;
