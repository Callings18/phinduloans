CREATE OR REPLACE FUNCTION public._test_complete_disbursement_as(
  p_actor uuid,
  p_disbursement_id uuid,
  p_account_id uuid,
  p_ref text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_actor::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v_result := public.complete_disbursement(p_disbursement_id, p_account_id, p_ref);
  RETURN v_result;
END;
$$;