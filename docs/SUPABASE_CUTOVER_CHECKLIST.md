# Supabase cutover: Lovable (`yqrf…`) → Phindu Loans (`seobilifwyxhtjvsgqpc`)

**Today:** `office.phindu.com` is built with `yqrfheavftgybhcafzpt`. The repo and owned project are `seobilifwyxhtjvsgqpc`.

Do **not** flip GitHub secrets to the owned project until live data and auth exist there (or you accept an empty DB).

**Full Lovable handover (export, support ticket, storage, secrets):** `docs/LOVABLE_CUTOVER_HANDOVER.md`

---

## Phase A — Unblock deletes on **current** production (yqrf)

1. SQL Editor: [yqrf project](https://supabase.com/dashboard/project/yqrfheavftgybhcafzpt/sql/new)
2. Run: `supabase/scripts/APPLY_admin_purge_loan_rpc_min.sql`
3. Hard-refresh office.phindu.com

---

## Phase B — Schema on **owned** project

```bash
npx supabase login
npx supabase link --project-ref seobilifwyxhtjvsgqpc
npx supabase db push --yes
```

Then SQL Editor on **seobil**: run `supabase/scripts/APPLY_admin_purge_loan_rpc.sql` (purge RPC is not in Lovable’s live DB until you apply it).

If `db push` fails on duplicates, see `scripts/make-migrations-idempotent.mjs` on `main`.

---

## Phase C — Data migration (Lovable-supported path)

Lovable does **not** expose DB passwords or connection strings. Use:

1. **Cloud → Advanced settings → Export data** — download full export (`.zip` → `.backup`). Restore: **`docs/RESTORE_LOVABLE_DB_EXPORT.md`**.
2. **Lovable support** — same ticket:
   - Migrate **auth users** to `seobilifwyxhtjvsgqpc` with **unchanged UUIDs**.
   - Migrate storage bucket **`loan-documents`** (~2,159 files), **same paths**.
3. Import exported data into seobil per Supabase/Lovable restore instructions (users **before** public data that references `user_id`).

Optional: if you later obtain a postgres URI (e.g. after project transfer), `pg_dump` / restore is documented in git history; prefer the export + support path above.

---

## Phase D — Functions, secrets, cron

1. Deploy functions: `npx supabase functions deploy --project-ref seobilifwyxhtjvsgqpc`
2. Set secrets — see `docs/LOVABLE_CUTOVER_HANDOVER.md` §5 (`EXCITESMS_*`, `SMS_PROVIDER`, `SENDGRID_*`, `OPENAI_API_KEY`; skip Twilio).
3. Run `supabase/scripts/reschedule_cron_jobs_seobil.sql` on seobil (replace `__SERVICE_ROLE_KEY__` or set `app.settings.service_role_key`).
4. Auth → URL configuration: Site URL + redirect URLs for app/office.

---

## Phase E — Point CI + redeploy

1. Owned anon key in `.env`:

   ```env
   VITE_SUPABASE_URL=https://seobilifwyxhtjvsgqpc.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<from Dashboard → API>
   ```

2. `gh auth login`
3. `node scripts/supabase-cutover-secrets.mjs`
4. `gh workflow run deploy-staff.yml -R Callings18/phinduloans` (and borrower workflow if separate)
5. `CLOUDFLARE_API_TOKEN=... node scripts/purge-phindu-cache.mjs`

---

## Phase F — Verify

- Deployed bundle contains `seobilifwyxhtjvsgqpc` (view source / search JS).
- Row counts reasonable vs export.
- Borrower sign-in + SMS OTP (`verify-otp` / `send-otp`).
- Open a document from `loan-documents`.
- Test payment recording.
- Loan delete works (RPC present).

---

## Phase G — Disconnect Lovable (irreversible)

Only after several stable days: **Cloud → Advanced → Disconnect** (workspace admins). This deletes all data on the old backend.
