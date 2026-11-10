-- Table privileges were revoked from authenticated during security hardening,
-- so profile RLS policies could not authorize otherwise-valid staff CRUD.
-- Grant the operations back at the table level; row-level policies remain the
-- authority for which rows users may read or change.
GRANT INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
