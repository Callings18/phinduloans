
-- Re-attach all critical triggers that were dropped

-- 1. Repayment schedule generation (most critical)
DROP TRIGGER IF EXISTS trigger_generate_repayment_schedule ON public.disbursements;
CREATE TRIGGER trigger_generate_repayment_schedule
  AFTER INSERT OR UPDATE OF status ON public.disbursements
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.generate_repayment_schedule();

-- 2. Loan status transition enforcement
DROP TRIGGER IF EXISTS trigger_enforce_loan_status ON public.loan_applications;
CREATE TRIGGER trigger_enforce_loan_status
  BEFORE UPDATE OF status ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_loan_application_status_transition();

-- 3. Disbursement status transition enforcement
DROP TRIGGER IF EXISTS trigger_enforce_disbursement_status ON public.disbursements;
CREATE TRIGGER trigger_enforce_disbursement_status
  BEFORE UPDATE OF status ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_disbursement_status_transition();

-- 4. Notification on loan status change
DROP TRIGGER IF EXISTS trigger_notify_loan_status_change ON public.loan_applications;
CREATE TRIGGER trigger_notify_loan_status_change
  AFTER UPDATE OF status ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_loan_status_change();

-- 5. Audit logging for loan updates
DROP TRIGGER IF EXISTS trigger_log_loan_updates ON public.loan_applications;
CREATE TRIGGER trigger_log_loan_updates
  AFTER UPDATE ON public.loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.log_loan_changes();

-- 6. Log repayment activity
DROP TRIGGER IF EXISTS trigger_log_repayment ON public.loan_repayments;
CREATE TRIGGER trigger_log_repayment
  AFTER INSERT ON public.loan_repayments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_repayment_activity();

-- 7. Cancel repayments on loan closure
DROP TRIGGER IF EXISTS trigger_cancel_repayments_on_closure ON public.loan_applications;
CREATE TRIGGER trigger_cancel_repayments_on_closure
  AFTER UPDATE OF status ON public.loan_applications
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'rejected'))
  EXECUTE FUNCTION public.cancel_repayments_on_loan_closure();

-- 8. Updated_at auto-timestamp triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('schema_migrations')
    GROUP BY c.table_name
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', tbl, tbl);
  END LOOP;
END;
$$;
