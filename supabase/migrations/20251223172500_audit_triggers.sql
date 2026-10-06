-- Function to log changes to audit_logs
CREATE OR REPLACE FUNCTION public.log_loan_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    (select auth.uid()),
    TG_OP,
    'loan_application',
    NEW.id,
    row_to_json(OLD),
    row_to_json(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for loan_applications updates
DROP TRIGGER IF EXISTS trigger_log_loan_updates ON public.loan_applications;
CREATE TRIGGER trigger_log_loan_updates
AFTER UPDATE ON public.loan_applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
EXECUTE FUNCTION public.log_loan_changes();

-- Function to log repayments
CREATE OR REPLACE FUNCTION public.log_repayment_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    new_values
  ) VALUES (
    (select auth.uid()),
    'REPAYMENT_CREATED',
    'repayment',
    NEW.id,
    row_to_json(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for repayments
DROP TRIGGER IF EXISTS trigger_log_repayment_insert ON public.loan_repayments;
CREATE TRIGGER trigger_log_repayment_insert
AFTER INSERT ON public.loan_repayments
FOR EACH ROW
EXECUTE FUNCTION public.log_repayment_activity();
