DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'loan_status_transitions'
      AND policyname = 'Staff can insert loan status transitions'
  ) THEN
    CREATE POLICY "Staff can insert loan status transitions"
      ON public.loan_status_transitions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        OR public.has_role(auth.uid(), 'loan_officer'::public.app_role)
        OR public.has_role(auth.uid(), 'credit_officer'::public.app_role)
        OR public.has_role(auth.uid(), 'finance_officer'::public.app_role)
        OR public.has_role(auth.uid(), 'collections_officer'::public.app_role)
      );
  END IF;
END $$;