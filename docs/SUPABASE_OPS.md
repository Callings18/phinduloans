# Supabase operations (no Lovable)

Production backend is **your Supabase project** (`seobilifwyxhtjvsgqpc` — Phindu Loans). Frontend deploys on **Cloudflare Workers** only.

## One-time bootstrap (new project or empty DB)

```bash
npx supabase login
npx supabase link --project-ref seobilifwyxhtjvsgqpc
node scripts/supabase-bootstrap.mjs
```

If `db push` fails on a duplicate Lovable-era migration, see `scripts/fix-duplicate-migration-versions.mjs` and `scripts/make-migrations-idempotent.mjs` (already applied on `main`).

## Day-to-day

| Task | Command |
|------|---------|
| Apply new migrations | `npx supabase db push --yes` |
| Deploy edge functions | `npx supabase functions deploy --project-ref seobilifwyxhtjvsgqpc` |
| Run ad-hoc SQL | `npx supabase db query --linked -f path/to.sql` |
| Deploy UI | `npm run deploy:production` then cache purge |

## Secrets

Set in **Supabase Dashboard → Project Settings → Edge Functions → Secrets** (not Lovable):

- `EXCITESMS_*` — see `docs/EXCITE_SMS_RELOAD.md`
- `OPENAI_API_KEY` (optional) — staff AI copilot; see `docs/ENTERPRISE_HOSTING.md`

## GitHub Actions

Update repository secrets to point at **owned** Supabase:

- `VITE_SUPABASE_URL` = `https://seobilifwyxhtjvsgqpc.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = anon key from Dashboard → API

## Migrating live data from old Lovable project

The legacy project ref `yqrfheavftgybhcafzpt` is not in your Supabase CLI account. To keep production loans/borrowers:

1. Obtain a **database backup** or **service-role export** from whoever administers that project, **or** transfer the project into your org via Supabase support.
2. Restore into `seobilifwyxhtjvsgqpc` (or use logical replication / pg_dump).
3. Update GitHub secrets and local `.env`, redeploy workers, purge Cloudflare cache.

Do **not** point `app.phindu.com` / `office.phindu.com` at an empty DB until cutover is intentional.
