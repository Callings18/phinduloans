-- Phone-first onboarding does not collect email. Auth users may use a private
-- synthetic email as their internal identifier, while the borrower profile's
-- contact email remains optional.
ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;
