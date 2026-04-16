# Supabase handoff: Auth, signup, and notifications (Lovable)

Use this when deploying `main` and aligning the hosted Supabase project with borrower web signup/login.

**Project reference (repo):** `supabase/config.toml` → `project_id = "yqrfheavftgybhcafzpt"` (confirm in Dashboard).

---

## 1. Migration to run

**File:** `supabase/migrations/20260416212000_auth_profile_trigger_hardening.sql`

**What it does**

- Replaces `public.handle_new_user()` with a resilient version: upserts `profiles`, inserts default `user` role with conflict handling, and catches errors so a bad downstream insert does not block `auth.users` creation.
- Recreates `on_auth_user_created` on `auth.users`.
- Backfills missing `public.profiles` rows and missing `user` role in `public.user_roles` for existing users.

**Prerequisite**

- `INSERT ... ON CONFLICT (user_id, role)` on `user_roles` requires a **unique constraint** on `(user_id, role)`. If production lacks it, add it before or as part of this rollout.

**How to apply**

- Linked CLI: `supabase db push` (or your usual migration pipeline).
- Or paste the SQL into the Supabase SQL editor and run once on the target database.

---

## 2. Dashboard: Auth settings (password vs email confirmation)

Local `supabase/config.toml` sets `[auth.email] enable_confirmations = false` for dev parity. **Hosted projects** must match product intent in **Authentication** settings.

- If borrowers must use **password immediately after signup**, disable **Confirm email** (or equivalent) in **Authentication → Providers → Email**, **or** accept that users must confirm via magic link first (app classifies `email_not_confirmed`).

- **Authentication → URL configuration**
  - **Site URL:** production app URL.
  - **Redirect URLs:** include every origin the app uses (e.g. `https://yourapp.com/**`, dev `http://127.0.0.1:8080/**`).

---

## 3. Edge Functions and notification logging

Observed in smoke tests:

- `functions/v1/send-notification` may return **401** if JWT expectations do not match client calls.
- `rest/v1/notification_logs` may return **401** if RLS blocks anon inserts.

**Lovable:** Align Edge Function `verify_jwt` with `supabase/config.toml` per function, and ensure welcome/signup paths use a supported pattern (service role on server, or public policy only where intended).

---

## 4. Rate limits (magic link / OTP)

Repeated signup tests can hit **429** / `over_email_send_rate_limit`. Document cooldowns for QA or adjust project email rate limits if appropriate.

---

## 5. App debugging (support)

Borrower auth page supports safe diagnostics (no secrets): append **`?authDebug=1`** to `/auth` to see step, classification, message, HTTP status, and provider error code.

---

## 6. Post-deploy validation (optional)

```sql
-- Trigger exists on auth.users
select tgname, tgrelid::regclass
from pg_trigger
where tgname = 'on_auth_user_created';

-- Function body present
select proname from pg_proc where proname = 'handle_new_user';

-- Sample: users without profiles (should be empty after backfill)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
limit 20;
```

See also: `docs/LOVABLE_MIGRATION_PACK.md` (ordered migration list including this file).
