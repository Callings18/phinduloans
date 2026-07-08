# Phindu — Vercel Deployment Pack (3 Frontends, 1 Backend)

One Supabase project, one auth, one storage. Three separate Vercel projects
built from the same monorepo. No backend changes.

- `phindu.com` → marketing (from `apps/staff-web`, `VITE_SITE_MODE=marketing`)
- `office.phindu.com` → staff ERP (from `apps/staff-web`, `VITE_SITE_MODE=office`)
- `app.phindu.com` → borrower PWA (from `apps/borrower-mobile`)

Monorepo = npm workspaces. Install MUST run at repo root so `packages/shared`
resolves. Set **Root Directory = repository root** in all three projects and
target the workspace via the build command. Disable Vercel's "Include files
outside root directory" prompt — root is already the repo root.

---

## 1) Project matrix

| Setting | phindu-marketing | phindu-office | phindu-borrower |
|---|---|---|---|
| Project name | `phindu-marketing` | `phindu-office` | `phindu-borrower` |
| Root directory | `.` (repo root) | `.` (repo root) | `.` (repo root) |
| Framework preset | Vite | Vite | Vite |
| Install command | `npm install` | `npm install` | `npm install` |
| Build command | `npm run build:staff` | `npm run build:staff` | `npm run build:borrower` |
| Output directory | `apps/staff-web/dist` | `apps/staff-web/dist` | `apps/borrower-mobile/dist` |
| Domain | `phindu.com` (+ `www`) | `office.phindu.com` | `app.phindu.com` |
| Notes | `VITE_SITE_MODE=marketing` drives redirects | `VITE_SITE_MODE=office` drives redirects | Only project with manifest + service worker |

> Marketing and office share the exact same build command and output dir. The
> ONLY difference is `VITE_SITE_MODE` (baked at build time). They must be two
> separate Vercel projects so each gets its own env value and domain.

SPA rewrite (avoids 404 on refresh). Add `vercel.json` at repo root **or** set
it per-project in the dashboard. Same file works for all three:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 2) Environment variables by project

Values below are the real, non-secret defaults for this project. `VITE_*` are
build-time and safe to expose (anon key is protected by RLS). Only VAPID
private/service keys are secret and never go in a frontend project.

### marketing (`phindu-marketing`)

```env
VITE_SUPABASE_URL=https://yqrfheavftgybhcafzpt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA
VITE_SITE_MODE=marketing
VITE_BORROWER_APP_URL=https://app.phindu.com
VITE_OFFICE_BASE_URL=https://office.phindu.com
VITE_MARKETING_BASE_URL=https://phindu.com
```

### office (`phindu-office`)

```env
VITE_SUPABASE_URL=https://yqrfheavftgybhcafzpt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA
VITE_SITE_MODE=office
VITE_BORROWER_APP_URL=https://app.phindu.com
VITE_OFFICE_BASE_URL=https://office.phindu.com
VITE_MARKETING_BASE_URL=https://phindu.com
```

### borrower-pwa (`phindu-borrower`)

```env
VITE_SUPABASE_URL=https://yqrfheavftgybhcafzpt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA
VITE_BORROWER_APP_URL=https://app.phindu.com
VITE_OFFICE_BASE_URL=https://office.phindu.com
VITE_MARKETING_BASE_URL=https://phindu.com
VITE_VAPID_PUBLIC_KEY=<your web-push VAPID public key>
```

> `VITE_BORROWER_WEB_INSTALL_GATE` is unset → gate is ON in production
> automatically (borrower apply/dashboard require install). Set it to `false`
> only if you want to disable the install gate on `app.phindu.com`.

### Where to set each var (Vercel scopes)

| Variable | Production | Preview | Development | Required? |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | ✅ | ✅ | Required (all 3) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | ✅ | ✅ | Required (all 3) |
| `VITE_SITE_MODE` | ✅ | ✅ | ✅ | Required (marketing + office only) |
| `VITE_BORROWER_APP_URL` | ✅ | ✅ | ✅ | Required (all 3) |
| `VITE_OFFICE_BASE_URL` | ✅ | ✅ | ✅ | Required (all 3) |
| `VITE_MARKETING_BASE_URL` | ✅ | ✅ | ✅ | Recommended (defaults to https://phindu.com) |
| `VITE_VAPID_PUBLIC_KEY` | ✅ | ✅ | ✅ | Required (borrower only, for push) |
| `VITE_SENTRY_DSN` | ✅ | optional | optional | Optional (error reporting) |
| `VITE_API_URL` | — | — | — | Optional (strangler API; leave unset) |
| `VITE_API_PHASE1_WORKFLOW` | — | — | — | Optional (leave unset → direct Supabase claims) |
| `VITE_BETA_MODULES` | optional | optional | optional | Optional (office beta badges) |

Set the same values across Production/Preview/Development so preview builds
behave like prod. Omitting `VITE_SITE_MODE` on the office project makes it
render as marketing — do not skip it.

---

## 3) Supabase checklist

Authentication → URL Configuration → **Additional Redirect URLs** (add all,
keep existing until fully migrated):

```
https://phindu.com/**
https://www.phindu.com/**
https://office.phindu.com/**
https://app.phindu.com/**
```

Site URL: keep your current production URL (or set to `https://app.phindu.com`
if borrower is the primary auth surface).

Edge function secrets (Supabase → Edge Functions → Secrets):

- `BORROWER_APP_URL=https://app.phindu.com` (used by `create-borrower` links)
- Web push (for `send-web-push`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Existing provider secrets remain unchanged (SMS/email).

**Do NOT change:** database schema, RLS policies, triggers, storage buckets,
auth providers, or `supabase/config.toml`. One project, one auth, one storage —
all three domains point at the same backend via the same anon key.

---

## 4) DNS checklist

At your DNS registrar. Vercel will show exact target values per domain; the
canonical Vercel records are:

| Host | Type | Value |
|---|---|---|
| `phindu.com` (apex) | A | `76.76.21.21` |
| `www.phindu.com` | CNAME | `cname.vercel-dns.com` |
| `office.phindu.com` | CNAME | `cname.vercel-dns.com` |
| `app.phindu.com` | CNAME | `cname.vercel-dns.com` |

Assign domains: `phindu.com` + `www` → phindu-marketing (set apex as primary,
www redirects). `office.phindu.com` → phindu-office. `app.phindu.com` →
phindu-borrower.

Verify:

```bash
dig +short phindu.com
dig +short www.phindu.com
dig +short office.phindu.com
dig +short app.phindu.com

# SSL issued & serving (expect HTTP/2 200)
curl -sI https://phindu.com | head -n1
curl -sI https://office.phindu.com | head -n1
curl -sI https://app.phindu.com | head -n1
```

Propagation: up to 48h (usually minutes). SSL auto-provisions once DNS
resolves to Vercel. Remove any old A/CNAME records pointing elsewhere.

---

## 5) SPA / PWA behavior per domain

**phindu.com (marketing)**
- Public marketing routes render normally.
- Any `/admin/*` navigation redirects to `https://office.phindu.com/admin`.
- "Apply / Get Started" CTAs route to `https://app.phindu.com`.
- No manifest, no service worker, not installable.
- Deep-link refresh works via SPA rewrite.

**office.phindu.com (staff ERP)**
- `VITE_SITE_MODE=office`: public marketing routes redirect to `/admin`.
- Staff login/session behaves as today (same Supabase auth).
- No manifest, no service worker, not installable.
- Deep-link refresh works via SPA rewrite.

**app.phindu.com (borrower PWA)**
- Serves `manifest.json` + registers `/service-worker.js` (PROD only).
- Installable on Android Chrome and iOS Safari (Add to Home Screen).
- Install gate ON in production: apply/dashboard require installed PWA;
  browser-tab signup blocked (`mode=signup`).
- Push notifications work once VAPID keys are set and borrower opts in.
- `ensureCorrectHost("borrower")` redirects wrong-host loads to this origin.

---

## 6) Post-deploy verification (10–15 min)

```bash
# 1. All three resolve + SSL
for d in phindu.com office.phindu.com app.phindu.com; do
  echo "== $d =="; curl -sI "https://$d" | head -n1
done

# 2. SPA deep-link refresh (expect 200, not 404)
curl -sI https://office.phindu.com/admin | head -n1
curl -sI "https://app.phindu.com/dashboard?tab=payments" | head -n1

# 3. Borrower PWA assets present
curl -sI https://app.phindu.com/manifest.json | head -n1
curl -sI https://app.phindu.com/service-worker.js | head -n1

# 4. Marketing/office must NOT expose a manifest
curl -sI https://phindu.com/manifest.json | head -n1     # 404 expected
curl -sI https://office.phindu.com/manifest.json | head -n1  # 404 expected
```

Manual (browser):
1. `phindu.com` → click Apply/Get Started → lands on `app.phindu.com`.
2. `phindu.com/admin` → redirects to `office.phindu.com/admin`.
3. Staff login on `office.phindu.com` succeeds; no redirect loop.
4. `app.phindu.com` on mobile → install prompt appears; installs to home screen.
5. Installed borrower app → login → OTP received → dashboard loads.
6. Borrower deep link `app.phindu.com/dashboard?tab=payments` opens correct tab.
7. Push: borrower enables notifications → `push_subscriptions` row created.

---

## 7) Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| 404 on refresh / deep link | SPA rewrite missing | Add `vercel.json` rewrite (`/(.*) → /index.html`) or set catch-all in project settings; redeploy |
| Office domain shows marketing site | `VITE_SITE_MODE` not set to `office` | Set `VITE_SITE_MODE=office` in phindu-office (all scopes), redeploy — it's build-time |
| Marketing shows admin / wrong redirects | `VITE_SITE_MODE` missing or wrong build command | Ensure `VITE_SITE_MODE=marketing` + build `npm run build:staff`, redeploy |
| Supabase auth redirect error after login | Redirect URL not allowlisted | Add `https://<domain>/**` to Supabase Auth → URL Configuration |
| Blank/broken app, requests to `undefined` | `VITE_SUPABASE_URL`/`_PUBLISHABLE_KEY` unset at build | Set both in Vercel (all scopes), redeploy (Vite inlines at build time) |
| PWA not installable on `app.phindu.com` | Manifest/SW not served, or not HTTPS/PROD | Confirm `manifest.json` + `service-worker.js` return 200; SW registers only in PROD; hard-refresh |
| Install prompt shows on marketing/office | Wrong app built for that domain | Marketing/office must build `apps/staff-web`; only borrower serves manifest |
| Redirect loop between domains | Wrong `VITE_*_BASE_URL` values | Verify `VITE_BORROWER_APP_URL` / `VITE_OFFICE_BASE_URL` / `VITE_MARKETING_BASE_URL` match live domains |
| `packages/shared` not found at build | Install ran inside app dir, not root | Root Directory = repo root; install `npm install`; build via `-w` workspace script |
| Stale borrower app after deploy | Old service worker cached | Bump `CACHE_NAME` in `service-worker.js`; users get update on next load; or visit with `?sw=off` isn't wired — rely on cache version bump |
