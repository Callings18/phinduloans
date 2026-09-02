# Railway + fresh Supabase cutover

Phindu stays **Vite ERP + Capacitor borrower + Nest on Railway**. Auth, Storage, and RLS still live in **your** Supabase project (not Lovable-linked). Railway Postgres is **not** the LMS ledger. Nest `DATABASE_URL` can point at the same Supabase Postgres as Prisma, or you can leave Prisma on a subset schema — money writes go through the **service role** + existing RPCs.

Fresh start = **new empty Supabase project you own** + apply `supabase/migrations` + new DB password in the dashboard + new super-admin via `scripts/seed-super-admin.mjs`. Do not invent a second ledger.

## Four Railway services (same repo, same Dockerfile)

| Service | `PHINDU_SERVICE` | What it is | Typical host |
|---------|------------------|------------|--------------|
| `api` | `api` | Nest (`/api/v1`, `/api/docs`) | `https://api-xxxx.up.railway.app` |
| `marketing` | `marketing` | Public site | `https://phindu.com` |
| `office` | `office` | Staff ERP (email/password) | `https://office.phindu.com` |
| `borrower` | `borrower` | Borrower PWA (phone OTP) | `https://app.phindu.com` |

Trial plan with only two services: keep `api` + `web` (`PHINDU_SERVICE=web` builds staff + `/borrower/`). Split after upgrade.

Each frontend service must set Docker **build args** (Railway Variables → build):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_API_URL                 # public Nest origin, no trailing slash
VITE_BORROWER_APP_URL        # https://app.phindu.com (or borrower Railway URL)
VITE_OFFICE_BASE_URL         # https://office.phindu.com
VITE_MARKETING_BASE_URL      # https://phindu.com
```

`PHINDU_SERVICE=marketing|office` sets `VITE_SITE_MODE` in the Dockerfile. Borrower is a separate Vite app.

## Nest (`api`) runtime env

```
PORT=3000
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL                 # same Postgres as the LMS (Supabase connection string)
JWT_SECRET                   # unused for current bearer sessions; set anyway
BORROWER_APP_URL             # magic-link redirect after OTP
EXCITESMS_API_TOKEN
EXCITESMS_SENDER_ID          # optional; Admin Settings can override
EXCITESMS_API_URL            # optional
EXCITESMS_SECONDARY_API_TOKEN
CORS_ORIGIN                  # optional extra origins; Railway + phindu hosts are already allowed
```

OTP is **Nest**: `POST /api/v1/auth/otp/send` and `/verify`. Do not keep Edge `send-otp` / `verify-otp` as the production path. You can leave those functions undeployed.

AI Edge functions still need `OPENAI_API_KEY` until they move.

## Fresh database

1. Create a **new** Supabase project (new DB password in the dashboard).
2. Apply repo migrations (`supabase db push` or SQL editor with `supabase/migrations` in order). Do not run Prisma migrate as a replacement for the LMS schema.
3. Copy the new project URL + anon key into Railway frontend build args. Copy service role into Nest only.
4. Storage buckets: recreate the same public/private buckets the apps expect (contracts, KYC, receipts).
5. Auth: enable email for staff. Keep Phone Auth **off** — borrowers use Nest OTP + synthetic emails.
6. Seed super-admin (once):

```
SEED_SUPER_ADMIN_CONFIRM=1
SEED_ADMIN_EMAIL=...
SEED_ADMIN_PASSWORD=...
SEED_ADMIN_NAME=...
node scripts/seed-super-admin.mjs
```

Staff sign in at the **office** origin with that email/password. Borrowers never use that path.

## Cloudflare (optional, after Railway URLs work)

Point DNS:

- `phindu.com` / `www` → marketing Railway
- `office.phindu.com` → office Railway
- `app.phindu.com` → borrower Railway

API can stay on `*.up.railway.app` or `api.phindu.com` (set `VITE_API_URL` to that origin and rebuild frontends).

## Freeze Lovable

Disconnect the old Lovable GitHub publish and the Lovable-linked database. Production must not republish the old combined SPA.

## UAT after deploy

Office email login → create borrower → apply → approve → disburse → record repayment. Borrower: phone OTP on the borrower origin.
