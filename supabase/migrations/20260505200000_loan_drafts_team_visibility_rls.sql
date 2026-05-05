-- Loan application drafts: team-visible reads + tight writes.
--
-- Problem:
--   * The original single FOR ALL policy only let non-admins touch rows where
--     staff_user_id = auth.uid(), so loan officers could never see each
--     other's drafts (even before the UI filter).
--   * Admins could SELECT all rows in theory, but the app still filtered by
--     current user id only.
--
-- This migration splits policies so that:
--   * Any lending-team staff role can SELECT every draft (shared visibility).
--   * INSERT always attributes the row to the signed-in user (or an admin
--     backfilling on behalf of someone — same as before).
--   * UPDATE / DELETE only on your own rows, unless admin / super_admin.

DROP POLICY IF EXISTS "Staff manage own drafts" ON public.loan_application_drafts;

-- SELECT: full draft list for everyone on the lending team (not borrowers/employers).
CREATE POLICY "Lending staff read all drafts"
  ON public.loan_application_drafts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'loan_officer'::public.app_role)
    OR public.has_role(auth.uid(), 'credit_officer'::public.app_role)
    OR public.has_role(auth.uid(), 'finance_officer'::public.app_role)
    OR public.has_role(auth.uid(), 'collections_officer'::public.app_role)
    OR public.has_role(auth.uid(), 'auditor'::public.app_role)
    OR public.has_role(auth.uid(), 'support'::public.app_role)
  );

CREATE POLICY "Staff insert own draft"
  ON public.loan_application_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Staff update own draft or admin"
  ON public.loan_application_drafts
  FOR UPDATE
  TO authenticated
  USING (
    staff_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    staff_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Staff delete own draft or admin"
  ON public.loan_application_drafts
  FOR DELETE
  TO authenticated
  USING (
    staff_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- Push INSERT/UPDATE/DELETE events to connected clients so the Drafts page can
-- invalidate its cache without a manual refresh.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_application_drafts;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
