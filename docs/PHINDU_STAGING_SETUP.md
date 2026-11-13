# Phindu staging environment

Staging is isolated from the live Phindu database and has separate Supabase and Cloudflare Workers. Production domains and data are not used by the staging deployment.

## Provisioning status

The dedicated Supabase project is provisioned in the `NABA CENTRAL` organization in `us-east-1`:

- Project ref: `ajoowxdvfsnverwdhipg`
- API URL: `https://ajoowxdvfsnverwdhipg.supabase.co`
- Supabase quoted cost: **$10/month**, approved by the owner.
- The project has the Phindu schema and migrations through `20261104121914`; application tables are empty and no Edge Functions are deployed yet.

Do not substitute either production project (`seobilifwyxhtjvsgqpc` or `yqrfheavftgybhcafzpt`) or copy production borrower data. Complete the staging secrets and deploy workflow before using this project for UAT.

## GitHub configuration

GitHub Environments `staging` and `production` are configured with required reviewers, admin bypass disabled, and branch rules. `staging` accepts `codex/*` branches; `production` accepts `main`. The current repository owner is the configured reviewer.

Staging project ID, URL, browser API key, Cloudflare account ID, test product code (`MARKETEER`), and a generated staging seed password are set in the `staging` environment. `CLOUDFLARE_API_TOKEN` is available as the existing repository secret. The Supabase browser key currently uses this empty project's legacy anon key; it is public and may be replaced with a modern publishable key when one is issued.

The workflow is not ready to run until these staging-only secrets are also set:

- `SUPABASE_STAGING_ACCESS_TOKEN` — Supabase CLI management access.
- `SUPABASE_STAGING_DB_PASSWORD` — database password for this staging project.
- `SUPABASE_STAGING_SERVICE_ROLE_KEY` — staging-only seed and integration test credential.

Keep production Supabase credentials separate from staging values. The environment gates are now in place, but a required reviewer can still approve their own deployment because this repository currently has only one collaborator. Add a second trusted reviewer if independent approval is required.

Required `staging` secrets:

| Secret | Purpose |
|---|---|
| `SUPABASE_STAGING_PROJECT_ID` | `ajoowxdvfsnverwdhipg`; must not be either Phindu production project. |
| `SUPABASE_STAGING_ACCESS_TOKEN` | Supabase CLI management access. |
| `SUPABASE_STAGING_DB_PASSWORD` | Staging database password. |
| `SUPABASE_STAGING_URL` | Must match `https://<project-ref>.supabase.co`. |
| `SUPABASE_STAGING_PUBLISHABLE_KEY` | Staging browser key (legacy anon API key currently available on this project). |
| `SUPABASE_STAGING_SERVICE_ROLE_KEY` | Staging-only seed and integration test credential. Never use in browser builds. |
| `STAGING_SEED_PASSWORD` | Password assigned to disposable staging UAT users. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Deploy staging workers to the Phindu zone/account. |
| `E2E_PRODUCT_CODE` | Active product code for lifecycle tests. |
| `E2E_SEEDED_EXPENSE_VENDOR` | Optional seeded staging expense for staff smoke tests. |

The Cloudflare worker custom domains are `staging-app.phindu.com` and `staging-office.phindu.com`. Add both as Supabase Auth redirect URLs before testing account confirmation or OAuth redirects. SMS provider credentials are intentionally not copied from production; configure a staging-safe SMS test credential before testing real OTP delivery.

The seed creates disposable admin, loan-officer, finance, credit, and collections users. `STAGING_SEED_PASSWORD` is their staging-only password. It creates the synthetic `UAT Staging Funding` account once, then retains its balance across runs so ledger entries stay reconciled; the account ID and generated admin user ID are exported for isolated lifecycle tests.

## Deployment and release flow

1. CI validates types, unit tests, builds, and migration filenames. The staging workflow owns credentialed loan lifecycle tests; the general CI workflow does not run mutation tests against shared integration secrets.
2. A trusted maintainer applies the `deploy-to-staging` label to a pull request or runs **Deploy Phindu Staging** manually. The GitHub `staging` environment holds all staging-only credentials.
3. The workflow previews and applies migrations to the staging project, deploys Edge Functions, seeds disposable UAT users, builds the two existing apps with the staging Supabase URL/key, and deploys them to staging hostnames.
4. The workflow runs browser sign-in/permission smoke tests plus the mutation-based loan lifecycle integration test. A failure blocks acceptance; it never targets production.
5. Merge only after staging passes. Production Supabase and Cloudflare workflows pause for the `production` environment's required reviewer approval.

## Safe data and seed behavior

The seed script uses synthetic names, addresses, emails, phones, and documents; it never reads or copies production borrower records or documents. Its default user password is supplied only via `STAGING_SEED_PASSWORD` and is not printed. The script rejects both known production project references even if a legacy override variable is set.

After staging deployment, verify the Supabase project ID and the app's built `VITE_SUPABASE_URL` before any authenticated test. Never add a production service-role key to the `staging` environment.
