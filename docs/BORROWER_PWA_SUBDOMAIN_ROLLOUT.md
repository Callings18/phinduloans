# Borrower PWA + Three-Domain Rollout

Hard separation (same Lovable Cloud / Supabase DB):

| Domain | Role |
|--------|------|
| `https://phindu.com` | Marketing website **only** — no AI, no staff UI, no borrower dashboard |
| `https://office.phindu.com` | Staff / admin LMS **only** |
| `https://app.phindu.com` | Borrower PWA **only** |

Rules:

- Marketing **Login** → `app.phindu.com/auth` (borrowers), never staff
- Staff sign in only at `office.phindu.com/auth` (do not advertise on marketing nav)
- No FloatingAssistant / PhinduAI on marketing
- Borrower deep links and notifications always use absolute `app.phindu.com` URLs

## 1) Environment configuration

### Three Cloudflare builds (correct `VITE_SITE_MODE`)

| Deploy target | App | Key env |
|---------------|-----|---------|
| `phindu.com` | `apps/staff-web` | `VITE_SITE_MODE=marketing` |
| `office.phindu.com` | `apps/staff-web` | `VITE_SITE_MODE=office` |
| `app.phindu.com` | `apps/borrower-mobile` | borrower build |

Shared frontend env:

- `VITE_BORROWER_APP_URL=https://app.phindu.com`
- `VITE_OFFICE_BASE_URL=https://office.phindu.com`
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (same Lovable Cloud project)

Backend / edge secrets:

- `BORROWER_APP_URL=https://app.phindu.com` (used by `create-borrower`, `verify-otp` redirectTo)

## 2) Supabase Auth redirect allowlist

In Supabase dashboard (`Authentication -> URL Configuration`), add:

- **Site URL (preferred):** `https://app.phindu.com` so any leftover magic-link hops stay on the borrower app
- Additional Redirect URLs:
  - `https://app.phindu.com/**`
  - `https://office.phindu.com/**`
  - `https://phindu.com/**`

Do not remove existing URLs until traffic is fully migrated.

### OTP must not land on marketing

Borrower SMS OTP uses in-app `tokenHash` + hard `window.location.replace` to `https://app.phindu.com/dashboard`.

**Required after each OTP-related code change:**

1. Redeploy edge function **`verify-otp`** (returns `tokenHash`, `redirectTo` = `BORROWER_APP_URL/dashboard`)
2. Secret **`BORROWER_APP_URL=https://app.phindu.com`**
3. Redeploy **borrower** build to `app.phindu.com`
4. Redeploy **marketing** (`VITE_SITE_MODE=marketing`) so `phindu.com/dashboard` and `phindu.com/auth` external-redirect to app
5. Redeploy **office** (`VITE_SITE_MODE=office`) for staff Auth + FloatingAssistant

If `verify-otp` is stale, magic links can still bounce through Site URL (`phindu.com`) and look like “landing page first, then dashboard.”

## 3) Deploy borrower PWA (`app.phindu.com`)

Build borrower app:

```bash
npm run build:borrower
```

Publish output from:

- `apps/borrower-mobile/dist`

Static checks before deploy:

```bash
npm run audit:pwa
```

## 4) Deploy marketing / office (Cloudflare)

Use **two separate Cloudflare projects** from the same `apps/staff-web` source.
`VITE_SITE_MODE` is baked at **build time** — one artifact cannot correctly serve both
`phindu.com` and `office.phindu.com`. Do not bind both domains to a single deploy.

| Domain | Cloudflare project (example) | Build command | Output dir | Required env |
|--------|------------------------------|---------------|------------|--------------|
| `phindu.com` (+ `www`) | marketing / `phindu-marketing` | `npm run build:staff` | `apps/staff-web/dist` | `VITE_SITE_MODE=marketing` |
| `office.phindu.com` | office / `phindu-office` | `npm run build:staff` | `apps/staff-web/dist` | `VITE_SITE_MODE=office` |
| `app.phindu.com` | borrower / `phindu-borrower` | `npm run build:borrower` | `apps/borrower-mobile/dist` | (no `VITE_SITE_MODE`) |

Shared env on all three builds:

```env
VITE_BORROWER_APP_URL=https://app.phindu.com
VITE_OFFICE_BASE_URL=https://office.phindu.com
VITE_MARKETING_BASE_URL=https://phindu.com
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

### Exact local → Cloudflare Workers static deploy

Repo helpers (after a mode-specific build):

```bash
# Marketing → phindu.com  (MUST set VITE_SITE_MODE before build)
set VITE_SITE_MODE=marketing
set VITE_BORROWER_APP_URL=https://app.phindu.com
set VITE_OFFICE_BASE_URL=https://office.phindu.com
npm run build:staff
npx wrangler@4.110.0 pages deploy apps/staff-web/dist --project-name=phindu-marketing
# or, if using the Workers assets config bound only to marketing:
# npm run deploy:staff   # wrangler.staff.jsonc → apps/staff-web/dist

# Office → office.phindu.com  (separate project / separate deploy)
set VITE_SITE_MODE=office
npm run build:staff
npx wrangler@4.110.0 pages deploy apps/staff-web/dist --project-name=phindu-office

# Borrower PWA → app.phindu.com
npm run build:borrower
npm run deploy:borrower   # wrangler.borrower.jsonc → apps/borrower-mobile/dist
```

On Cloudflare Pages (dashboard CI): Root Directory = repo root, Install = `npm install`,
Build / Output / env as in the table above. SPA: `not_found_handling = single-page-application`
(already set in `wrangler.staff.jsonc` / `wrangler.borrower.jsonc`).

### What each mode must do after redeploy

1. Marketing (`phindu.com`) — `VITE_SITE_MODE=marketing`
   - Login / `/auth` / `/login` → `app.phindu.com`
   - `/dashboard`, `/profile`, `/apply`, `/install`, etc. → **hard redirect** to borrower app (no borrower UI paint)
   - Navbar **My Dashboard** → absolute `https://app.phindu.com/dashboard`
   - `/admin/*` → `office.phindu.com/admin`
   - No FloatingAssistant / PhinduAI
2. Office (`office.phindu.com`) — `VITE_SITE_MODE=office`
   - Staff Auth at `/auth`
   - Public marketing routes redirect to `/admin`
   - FloatingAssistant available

### If live `phindu.com` still shows borrower dashboard / AI

That is almost always **stale Cloudflare assets**, not a main-branch bug. Confirm:

1. Live JS still looks like old conditional `/dashboard` (renders borrower UI) instead of `ExternalRedirect`.
2. Baked mode is empty: search the marketing bundle for `"".toLowerCase()==="office"` → `VITE_SITE_MODE` was missing at build.
3. `CF-Cache-Status: HIT` on `/` or `/assets/*.js` — purge cache or redeploy so `index-*.js` hash changes.
4. Hard refresh / unregister any old service worker on `phindu.com` (marketing must not ship a SW; borrower SW is only on `app.phindu.com`).

## 5) PWA audit checklist

Run automated checks:

```bash
npm run audit:pwa
npm run build:borrower
```

Manual checks (required before go-live):

1. Installability on Android Chrome and iOS Safari.
2. Service worker registration and update behavior.
3. Offline app shell rendering.
4. Login/session/deep links (`/dashboard?tab=payments`, `/apply`).
5. Notification click-through with absolute `action_url` on `app.phindu.com`.
6. Responsive layout on 320px/375px/428px.

## 6) Push notification readiness

Frontend:

- `VITE_VAPID_PUBLIC_KEY=<public key>` in borrower environment.

Supabase secrets:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Validation:

1. Borrower enables push from notification center.
2. `push_subscriptions` row is created/updated.
3. Send test push via `supabase/functions/send-web-push`.

## 7) Post-deploy smoke tests

1. `phindu.com` **Login** → `app.phindu.com/auth` (not office).
2. `phindu.com` has no AI assistant / PhinduAI.
3. `https://app.phindu.com/auth` → SMS OTP → lands on **`https://app.phindu.com/dashboard`** in one step.
4. `https://phindu.com/dashboard` → immediate redirect to **`https://app.phindu.com/dashboard`**.
5. `https://phindu.com/auth` → redirect to **`https://app.phindu.com/auth`**.
6. Staff login only on `office.phindu.com/auth`.
7. Borrower deep links in SMS/inbox point to absolute `app.phindu.com` URLs.
8. Staff domain does not expose web manifest for install.
