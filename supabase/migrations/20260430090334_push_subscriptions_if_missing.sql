-- push_subscriptions lived only in duplicate migration 20260108171013 (now a no-op).
-- Fresh db push installs need this table before later data-fix migrations reference it.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  device_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can view push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
