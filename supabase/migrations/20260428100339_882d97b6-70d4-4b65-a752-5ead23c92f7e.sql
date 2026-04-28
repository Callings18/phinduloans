-- Replace partial unique index with a plain unique index so ON CONFLICT works.
-- NULLs are not considered equal in UNIQUE constraints, so legacy NULL rows
-- remain valid and unique enforcement only applies to rows with a key.
DROP INDEX IF EXISTS public.uniq_notification_logs_idempotency_key;
CREATE UNIQUE INDEX uniq_notification_logs_idempotency_key
  ON public.notification_logs(idempotency_key);