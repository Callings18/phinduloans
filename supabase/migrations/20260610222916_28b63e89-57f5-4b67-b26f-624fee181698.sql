-- Helper: identify internal staff users (any role except borrower 'user' / external 'employer')
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        'admin','super_admin','loan_officer','credit_officer',
        'finance_officer','collections_officer','auditor','support'
      )
  )
$$;

-- Secure Realtime channel subscriptions (requires owner on realtime.messages).
-- Supabase CLI db push may lack ownership; apply via Dashboard SQL if this block is skipped.
DO $realtime$
BEGIN
  ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Staff can receive realtime messages" ON realtime.messages;
  CREATE POLICY "Staff can receive realtime messages"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (public.is_staff(auth.uid()));

  DROP POLICY IF EXISTS "Staff can send realtime messages" ON realtime.messages;
  CREATE POLICY "Staff can send realtime messages"
    ON realtime.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_staff(auth.uid()));
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping realtime.messages RLS (insufficient privileges on hosted Supabase)';
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%must be owner%' THEN
      RAISE NOTICE 'Skipping realtime.messages RLS (not table owner)';
    ELSE
      RAISE;
    END IF;
END;
$realtime$;