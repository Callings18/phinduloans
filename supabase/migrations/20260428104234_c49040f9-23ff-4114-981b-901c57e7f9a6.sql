-- Lock down apply_loan_penalties: only authenticated callers
REVOKE EXECUTE ON FUNCTION public.apply_loan_penalties(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_loan_penalties(uuid) TO authenticated, service_role;