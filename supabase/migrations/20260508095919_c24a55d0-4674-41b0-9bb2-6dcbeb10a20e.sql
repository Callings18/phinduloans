REVOKE ALL ON FUNCTION public.generate_loan_schedule_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_repayment_schedule() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_loan_active_generate_schedule() FROM PUBLIC, anon, authenticated;