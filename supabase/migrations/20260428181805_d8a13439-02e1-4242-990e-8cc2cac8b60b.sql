-- Dedicated in-app notification inbox (separate from notification_logs delivery outbox)
CREATE TABLE IF NOT EXISTS public.notification_inbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_inbox_user_created
  ON public.notification_inbox (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_inbox_user_unread
  ON public.notification_inbox (user_id, is_read) WHERE is_read = false;

ALTER TABLE public.notification_inbox ENABLE ROW LEVEL SECURITY;

-- Users can view their own inbox
DROP POLICY IF EXISTS "Users view own inbox" ON public.notification_inbox;
CREATE POLICY "Users view own inbox"
  ON public.notification_inbox FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can mark their own messages as read / unread
DROP POLICY IF EXISTS "Users update own inbox" ON public.notification_inbox;
CREATE POLICY "Users update own inbox"
  ON public.notification_inbox FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
DROP POLICY IF EXISTS "Users delete own inbox" ON public.notification_inbox;
CREATE POLICY "Users delete own inbox"
  ON public.notification_inbox FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Staff can insert for any user (triggers/edge functions use security definer or service role)
DROP POLICY IF EXISTS "Staff insert inbox" ON public.notification_inbox;
CREATE POLICY "Staff insert inbox"
  ON public.notification_inbox FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'loan_officer'::app_role)
    OR public.has_role(auth.uid(), 'finance_officer'::app_role)
    OR public.has_role(auth.uid(), 'collections_officer'::app_role)
    OR auth.uid() = user_id
  );

-- Staff can view all inboxes (for support)
DROP POLICY IF EXISTS "Staff view all inbox" ON public.notification_inbox;
CREATE POLICY "Staff view all inbox"
  ON public.notification_inbox FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_notification_inbox_updated_at ON public.notification_inbox;
CREATE TRIGGER trg_notification_inbox_updated_at
  BEFORE UPDATE ON public.notification_inbox
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function for backend (triggers, edge functions) to insert inbox messages
CREATE OR REPLACE FUNCTION public.create_inbox_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notification_inbox (
    user_id, title, message, type, action_url, metadata,
    related_entity_type, related_entity_id
  ) VALUES (
    p_user_id, p_title, p_message, COALESCE(p_type, 'info'),
    p_action_url, COALESCE(p_metadata, '{}'::jsonb),
    p_related_entity_type, p_related_entity_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_inbox;
ALTER TABLE public.notification_inbox REPLICA IDENTITY FULL;