-- Prevent duplicate NRC + phone combinations on profiles
-- Date: 2026-02-09

-- Partial unique index: only enforce when both nrc_number and phone are set
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nrc_phone_unique
  ON public.profiles (nrc_number, phone)
  WHERE nrc_number IS NOT NULL AND phone IS NOT NULL;

COMMENT ON INDEX public.idx_profiles_nrc_phone_unique IS 'Ensures no two profiles share the same NRC number and phone combination.';
