-- Optional blacklist duration: expiry date for temporary blacklist
-- Date: 2026-02-09

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blacklist_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.blacklist_expires_at IS 'When blacklist expires (null = permanent). If set and in the past, treat as not blacklisted.';
