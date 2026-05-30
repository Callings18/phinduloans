CREATE OR REPLACE FUNCTION public.claim_pending_notifications(p_limit integer DEFAULT 50)
RETURNS SETOF public.notification_logs
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.notification_logs nl
  SET status = 'processing', updated_at = now()
  WHERE nl.id IN (
    SELECT id FROM public.notification_logs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING nl.*;
$function$;

REVOKE ALL ON FUNCTION public.claim_pending_notifications(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_notifications(integer) TO service_role;