
DROP POLICY IF EXISTS "Authenticated activity can be audited" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert their own audit entries" ON public.audit_logs;
CREATE POLICY "Users can insert their own audit entries"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF to_regprocedure('public.delete_email(text, bigint)') IS NOT NULL THEN
    ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
  END IF;
  IF to_regprocedure('public.enqueue_email(text, jsonb)') IS NOT NULL THEN
    ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
  END IF;
  IF to_regprocedure('public.move_to_dlq(text, text, bigint, jsonb)') IS NOT NULL THEN
    ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
  END IF;
  IF to_regprocedure('public.read_email_batch(text, integer, integer)') IS NOT NULL THEN
    ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
  END IF;
END;
$$;
