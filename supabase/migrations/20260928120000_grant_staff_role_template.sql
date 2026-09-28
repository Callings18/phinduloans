-- Grant staff access so office.phindu.com/auth → /admin works.
-- Run in Supabase SQL Editor (Dashboard → SQL).
-- Replace the email with your staff account.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('YOUR_STAFF_EMAIL@example.com')
ON CONFLICT DO NOTHING;

-- Verify:
-- SELECT u.email, r.role
-- FROM auth.users u
-- JOIN public.user_roles r ON r.user_id = u.id
-- WHERE lower(u.email) = lower('YOUR_STAFF_EMAIL@example.com');
