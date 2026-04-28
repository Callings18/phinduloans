-- ============================================================
-- Module 18 P0: Schema drift + performance indexes
-- ============================================================

-- 1. Schema drift fixes on notification_logs
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Backfill updated_at from created_at where they differ trivially
UPDATE public.notification_logs
SET updated_at = created_at
WHERE updated_at IS NULL OR updated_at < created_at;

-- 3. Notification logs hot-path indexes (CONCURRENTLY would require non-tx;
--    migration runs in tx, so use regular CREATE INDEX IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_notification_logs_status_created
  ON public.notification_logs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_created
  ON public.notification_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_created
  ON public.notification_logs (recipient, created_at DESC);

-- 4. Audit logs hot-path indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created
  ON public.audit_logs (entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs (action, created_at DESC);

-- 5. Account transactions ledger index
CREATE INDEX IF NOT EXISTS idx_account_transactions_account_created
  ON public.account_transactions (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_transactions_reference
  ON public.account_transactions (reference_type, reference_id);

-- 6. Trigger to auto-maintain updated_at on notification_logs
DROP TRIGGER IF EXISTS trg_notification_logs_updated_at ON public.notification_logs;
CREATE TRIGGER trg_notification_logs_updated_at
  BEFORE UPDATE ON public.notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();