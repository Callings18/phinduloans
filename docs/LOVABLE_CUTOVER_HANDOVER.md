# Lovable → Phindu Loans cutover handover

**Source project (Lovable Cloud):** `yqrfheavftgybhcafzpt`  
**Target project (owned):** `seobilifwyxhtjvsgqpc` — Phindu Loans

This doc mirrors Lovable’s supported migration path. Do **not** disconnect Lovable Cloud until verification passes (disconnect is irreversible and deletes the old backend).

---

## 1. Database export

- **How:** Lovable **Cloud → Advanced settings → Export data** (full copy: loans, borrowers, repayments, products, settings).
- **Format:** zip containing a **PostgreSQL custom dump** (`.backup`, header `PGDMP`). Example: `bucket-database_export_08_10_26-files.zip` → `loan-kindly-flow_261008.backup` (~15 MB).
- **Restore guide:** `docs/RESTORE_LOVABLE_DB_EXPORT.md` and `node scripts/prepare-lovable-db-export.mjs <zip>`.
- **Not available from Lovable:** live connection string from the AI; you use **your** seobil database password for `pg_restore`.
- **CSV:** ask Lovable for named tables only if you need spreadsheets.

---

## 2. User accounts (critical)

- Open a **Lovable support** ticket to migrate **auth users** into `seobilifwyxhtjvsgqpc` with **the same user UUIDs**.
- Profiles, loans, roles, and storage paths all reference those IDs. New UUIDs break borrower access to loans and documents.

**Suggested ticket text:**

> Please migrate all Supabase Auth users from project `yqrfheavftgybhcafzpt` to our owned project `seobilifwyxhtjvsgqpc` (Phindu Loans), preserving every user `id` (UUID). We need phones, emails, and metadata intact so `public.profiles`, `loan_applications`, and `user_roles` remain valid.

---

## 3. File storage

- **Bucket:** `loan-documents` (private)
- **Count:** ~2,159 files (KYC, collateral, proof of payment)
- Request migration in the **same support ticket**.
- **Requirement:** keep bucket name **`loan-documents`** and **existing object paths** so DB document URLs keep working.

---

## 4. Database functions and schema

| Item | Action |
|------|--------|
| `admin_purge_loan_application` | **Missing on current Lovable backend.** After linking `seobilifwyxhtjvsgqpc`, run `supabase/scripts/APPLY_admin_purge_loan_rpc.sql` in SQL Editor (or min variant for function-only). |
| Everything else in `supabase/migrations` | `npx supabase link --project-ref seobilifwyxhtjvsgqpc` then `npx supabase db push --yes` |
| Scheduled jobs | Lovable cannot list them. On **seobil**, recreate cron jobs after functions deploy — see §6 and `supabase/scripts/reschedule_cron_jobs_seobil.sql`. |

**Penalty cron:** migration `20260507180547_…` **removed** the nightly `lms-daily-apply-penalties` job (penalties are manual in UI). You do **not** need to recreate that job unless you deliberately re-enable automatic penalties.

---

## 5. Edge functions (19) — all present under `supabase/functions/`

Deploy to **seobilifwyxhtjvsgqpc** after data restore:

`ai-agent-run`, `ai-copilot`, `brevo-notification`, `bulk-import-marketeer-loans`, `crb-check`, `crb-submit`, `create-borrower`, `create-staff-user`, `excite-sms`, `excite-sms-balance`, `guarantee-check`, `payment-reminder-cron`, `process-notification-queue`, `send-due-soon-notification`, `send-notification`, `send-otp`, `send-sms`, `send-web-push`, `verify-otp`

```bash
npx supabase login
npx supabase link --project-ref seobilifwyxhtjvsgqpc
npx supabase functions deploy --project-ref seobilifwyxhtjvsgqpc
```

### Secrets (Dashboard → Edge Functions → Secrets)

| Secret | Notes |
|--------|--------|
| `EXCITESMS_API_TOKEN`, `EXCITESMS_API_URL`, `EXCITESMS_SENDER_ID` | SMS |
| `SMS_PROVIDER` | e.g. `excite` |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | If still used alongside Brevo |
| `OPENAI_API_KEY` | **Replace `LOVABLE_API_KEY`** for owned hosting |
| Optional: `AI_MODEL`, `AI_GATEWAY_URL` | `ai-copilot` already prefers `OPENAI_API_KEY` over Lovable |

**Skip:** Twilio secrets (removed from app).

**AI note:** `ai-copilot` supports OpenAI first; `ai-agent-run` still reads `LOVABLE_API_KEY` only — set `OPENAI_API_KEY` and update that function before relying on borrower/staff AI agent runs on seobil.

---

## 6. Cron jobs on the new project

Historical migrations embed **`yqrfheavftgybhcafzpt`** URLs (and old anon JWTs). After cutover, run **`supabase/scripts/reschedule_cron_jobs_seobil.sql`** in the **seobil** SQL Editor (replace placeholders with your project URL and service role key, or configure `app.settings.service_role_key` as in migration `20260428215609_…`).

Expected jobs:

- `payment-reminder-morning`, `payment-reminder-midday`, `payment-reminder-evening` → `payment-reminder-cron` (3×/day)
- `process-notification-queue-5min` → every 5 minutes

Verify: **Database → Cron Jobs** (or `select jobname, schedule from cron.job;`).

---

## 7. Cutover order (checklist)

1. **Maintenance:** announce window; stop staff recording payments on old backend.
2. **Export:** Lovable export download; support ticket for **users (UUID preserve)** + **`loan-documents`** files.
3. **New project setup:** link seobil → `db push` → run `APPLY_admin_purge_loan_rpc.sql`.
4. **Restore:** users first → import data → restore storage objects.
5. **Deploy:** edge functions, secrets, cron SQL, Auth **Site URL** + **Redirect URLs** (`https://app.phindu.com/**`, `https://office.phindu.com/**`, local dev if needed).
6. **Switch apps:** update GitHub `VITE_SUPABASE_*` (`node scripts/supabase-cutover-secrets.mjs` after `gh auth login`), redeploy Cloudflare staff + borrower, purge cache.
7. **Verify:** row counts vs export; borrower login + SMS OTP; open a KYC file from `loan-documents`; record a test payment; confirm deployed JS contains `seobilifwyxhtjvsgqpc`.
8. **Decommission:** after several stable days only — Lovable **Cloud → Advanced → Disconnect** (workspace admins; **permanent**).

---

## 8. Optional: unblock deletes before full cutover

If office still points at **yqrf**, run `supabase/scripts/APPLY_admin_purge_loan_rpc_min.sql` in **yqrf** SQL Editor so permanent loan delete works until secrets flip.

---

## Related docs

- `docs/SUPABASE_CUTOVER_CHECKLIST.md` — phased ops summary  
- `docs/SUPABASE_OPS.md` — day-to-day on seobil  
- `docs/SUPABASE_LOVABLE_AUTH_HANDOFF.md` — auth trigger / signup alignment  
