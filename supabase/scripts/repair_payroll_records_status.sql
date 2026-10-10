-- seobil: payroll_records existed without status (partial restore / old shape). Unblocks 20260211075154 migration policies.
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_records_status_check'
      AND conrelid = 'public.payroll_records'::regclass
  ) THEN
    ALTER TABLE public.payroll_records
      ADD CONSTRAINT payroll_records_status_check
      CHECK (status IN ('draft','approved','paid','cancelled'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
