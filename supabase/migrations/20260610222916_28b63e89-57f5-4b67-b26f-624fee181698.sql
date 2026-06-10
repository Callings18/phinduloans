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

-- Secure Realtime channel subscriptions: only internal staff may receive Realtime messages.
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