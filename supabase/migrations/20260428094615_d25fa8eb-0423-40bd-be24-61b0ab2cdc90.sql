
REVOKE EXECUTE ON FUNCTION public.complete_disbursement(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, text, uuid, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_mark_loan_defaulted(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_loan_writeoff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_loan_writeoff(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_record_writeoff_recovery(uuid, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transition_loan_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_permission_denied(text, text, text, uuid, jsonb) FROM anon;
