# Vercel Deployment Pack — Three Production Frontends

One Supabase project, one auth, one storage. Three Vercel projects from one monorepo.

- `phindu.com` → marketing (apps/staff-web, `VITE_SITE_MODE=marketing`)
- `office.phindu.com` → staff ERP (apps/staff-web, `VITE_SITE_MODE=office`)
- `app.phindu.com` → borrower PWA (apps/borrower-mobile)

Package manager: **npm** (root `package-lock.json`, npm workspaces). Vite output dir: `dist` (inside each app).

---

## 1) Project matrix

| Project name | Root directory | Install command | Build command | Output directory | Domain | Notes |
|---|---|---|---|---|---|---|
| `phindu-marketing` | `.` (repo root) | `npm install` | `npm run build:staff` | `apps/staff-web/dist` | `phindu.com`, `www.phindu.com` | Marketing mode. Redirects `/admin/*` → office. No PWA manifest. |
| `phindu-office` | `.` (repo root) | `npm install` | `npm run build:staff` | `apps/staff-web/dist` | `office.phindu.com` | Staff ERP. Same build, `VITE_SITE_MODE=office`. No PWA manifest. |
| `phindu-borrower` | `.` (repo root) | `npm install` | `npm run build:borrower` | `apps/borrower-mobile/dist` | `app.phindu.com` | Only domain with service worker + install prompt. |

> Root directory is the **repo root** (not the app folder) because npm workspaces resolve `@phinduloans/shared` from the root. Set Output Directory to the app's `dist` path.

Vercel Project Settings for all three:
- Framework Preset: **Other** (or Vite)
- Node.js Version: **20.x**
- Install/Build/Output: per table above.

SPA rewrites — add `vercel.json` at repo root (already covers all three since output dirs differ; Vercel applies rewrites to served output):

```json
{
  "rewrites": [{ "source": "/((?!.*\\.).*)", "destination": "/index.html" }]
}
```

If per-project rewrites are cleaner, add the same file at each `apps/*/` root and point that project's Root Directory there instead — but then set Install to `npm install --prefix ../..`. The repo-root approach above is simpler; keep it.

---

## 2) Environment variables by project

Set in Vercel → Project → Settings → Environment Variables. Values are build-time (`VITE_*`), so set for **Production + Preview + Development** unless noted.

### marketing (`phindu-marketing`)

```env
# Required — Production + Preview + Development
VITE_SUPABASE_URL=https://yqrfheavftgybhcafzpt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA
VITE_SITE_MODE=marketing
VITE_BORROWER_APP_URL=https://app.phindu.com
VITE_OFFICE_BASE_URL=https://office.phindu.com
VITE_MARKETING_BASE_URL=https://phindu.com
```

### office (`phindu-office`)

```env
# Required — Production + Preview + Development
VITE_SUPABASE_URL=https://yqrfheavftgybhcafzpt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA
VITE_SITE_MODE=office
VITE_BORROWER_APP_URL=https://app.phindu.com
VITE_OFFICE_BASE_URL=https://office.phindu.com
VITE_MARKETING_BASE_URL=https://phindu.com
```

### borrower-pwa (`phindu-borrower`)

```env
# Required — Production + Preview + Development
VITE_SUPABASE_URL=https://yqrfheavftgybhcafzpt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA
VITE_BORROWER_APP_URL=https://app.phindu.com
VITE_OFFICE_BASE_URL=https://office.phindu.com

# Required for push; set once you have the VAPID public key (SECRET-adjacent, public half only)
VITE_VAPID_PUBLIC_KEY=<your-vapid-public-key>

# Optional — install gate. Unset = ON in production only. Set false to disable.
# VITE_BORROWER_WEB_INSTALL_GATE=true
```

### Optional / workflow flags (any project that needs them)

```env
# Strangler API (only if apps/api-next is deployed and reachable)
# VITE_API_URL=https://<your-api-next-host>
# VITE_API_PHASE1_WORKFLOW=false   # false = borrower claims write directly to Supabase (safe default)
# VITE_API_LOAN_PRODUCTS=false
# VITE_BETA_MODULES=loans_by_product,product_dashboards,marketeer
# VITE_SENTRY_DSN=<dsn>
```

**Set-scope summary**

| Var | Marketing | Office | Borrower | Scope | Required? |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | ✅ | ✅ | Prod+Prev+Dev | Required |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | ✅ | ✅ | Prod+Prev+Dev | Required |
| `VITE_SITE_MODE` | `marketing` | `office` | — | Prod+Prev+Dev | Required (staff-web) |
| `VITE_BORROWER_APP_URL` | ✅ | ✅ | ✅ | Prod+Prev+Dev | Required |
| `VITE_OFFICE_BASE_URL` | ✅ | ✅ | ✅ | Prod+Prev+Dev | Required |
| `VITE_MARKETING_BASE_URL` | ✅ | ✅ | — | Prod+Prev+Dev | Recommended |
| `VITE_VAPID_PUBLIC_KEY` | — | — | ✅ | Prod+Prev+Dev | Required for push |
| `VITE_BORROWER_WEB_INSTALL_GATE` | — | — | optional | Prod+Prev+Dev | Optional |
| `VITE_API_*`, `VITE_BETA_MODULES`, `VITE_SENTRY_DSN` | optional | optional | optional | as needed | Optional |

> These are all client-side publishable values. Row Level Security protects data. The `service_role` key must **never** appear in any Vercel frontend project.

---

## 3) Supabase checklist

**Auth → URL Configuration → Redirect URLs — add (keep existing until traffic migrates):**

```
https://phindu.com/**
https://www.phindu.com/**
https://office.phindu.com/**
https://app.phindu.com/**
```

Site URL: set to `https://app.phindu.com` (borrower is the main authenticated surface) or leave current if staff login relies on it. Do not remove old preview URLs mid-migration.

**Edge function secrets (Supabase, server-side — set/confirm):**

```
BORROWER_APP_URL=https://app.phindu.com        # used by create-borrower for links
VAPID_PUBLIC_KEY=<public>                       # send-web-push
VAPID_PRIVATE_KEY=<private>                      # send-web-push (SECRET)
VAPID_SUBJECT=mailto:ops@phindu.com             # send-web-push
```

**Do NOT change:**
- Database schema, RLS policies, triggers, or RPCs.
- Auth providers / one auth system.
- Storage buckets / policies.
- `service_role` key exposure — server-only.

---

## 4) DNS checklist

At your registrar / DNS provider. Vercel will show the exact target on domain add — these are the standard values.

| Host | Type | Name | Value | Vercel project |
|---|---|---|---|---|
| `phindu.com` (apex) | A | `@` | `76.76.21.21` | phindu-marketing |
| `www.phindu.com` | CNAME | `www` | `cname.vercel-dns.com` | phindu-marketing |
| `office.phindu.com` | CNAME | `office` | `cname.vercel-dns.com` | phindu-office |
| `app.phindu.com` | CNAME | `app` | `cname.vercel-dns.com` | phindu-borrower |

> Use the exact value Vercel displays under Project → Settings → Domains (apex A record IP can differ). If DNS is proxied (Cloudflare), set records to **DNS only / grey cloud** during verification.

**Verify SSL + propagation:**

```bash
dig +short phindu.com
dig +short www.phindu.com
dig +short office.phindu.com
dig +short app.phindu.com

curl -sI https://phindu.com        | grep -i "HTTP\|server"
curl -sI https://office.phindu.com | grep -i "HTTP"
curl -sI https://app.phindu.com    | grep -i "HTTP"
```

- Each domain in Vercel should read **Valid Configuration** + **SSL issued**.
- Cross-check with https://dnschecker.org. Propagation up to 24–72h; usually minutes.

---

## 5) SPA / PWA behavior checks

**marketing (`phindu.com`)**
- Public marketing routes render.
- Visiting `/admin/*` → redirects to `https://office.phindu.com/admin`.
- "Apply / Get Started" CTAs → `https://app.phindu.com`.
- No `rel="manifest"`, no service worker, not installable (enforced by `audit:pwa`).
- Deep-link refresh (e.g. `/pricing`) returns 200 via SPA rewrite.

**office (`office.phindu.com`)**
- Staff login + ERP render.
- Public marketing routes redirect to `/admin`.
- No manifest / service worker / install.
- Deep-link refresh (e.g. `/admin/loans`) returns 200.

**borrower (`app.phindu.com`)**
- `manifest.json` served, `display: standalone`, `id` targets `app.phindu.com`.
- `service-worker.js` registers **only in production** (`import.meta.env.PROD`); unregistered in dev/preview by `main.tsx`.
- Install prompt (`PWAInstallPrompt`) + `BorrowerInstallGate` active.
- Install gate: unset env = ON in production (borrower must install to use apply/dashboard).
- Deep links `/dashboard?tab=payments`, `/apply` refresh to 200.
- Notification click opens `action_url`.

Host guards (`ensureCorrectHost`) auto-redirect if a build lands on the wrong hostname — so a mode/domain mismatch self-corrects to the canonical origin.

---

## 6) Copy-paste verification (10–15 min after deploy)

```bash
# 1. All domains up + SSL
for d in phindu.com www.phindu.com office.phindu.com app.phindu.com; do
  echo "== $d =="; curl -sI "https://$d" | head -1
done

# 2. SPA deep-link refresh (expect 200)
curl -sI https://phindu.com/pricing            | head -1
curl -sI https://office.phindu.com/admin/loans | head -1
curl -sI https://app.phindu.com/dashboard      | head -1

# 3. Borrower PWA assets present (expect 200)
curl -sI https://app.phindu.com/manifest.json     | head -1
curl -sI https://app.phindu.com/service-worker.js | head -1

# 4. Staff domains must NOT ship a manifest (expect 404)
curl -sI https://phindu.com/manifest.json        | head -1
curl -sI https://office.phindu.com/manifest.json | head -1
```

Manual (browser):
1. `phindu.com` → click Apply → lands on `app.phindu.com`. Visit `phindu.com/admin` → redirects to office.
2. `office.phindu.com` → staff login works; visiting a public marketing path → redirects to `/admin`.
3. `app.phindu.com` on Android Chrome → install prompt appears; install → launches standalone. iOS Safari → Add to Home Screen works.
4. Borrower login → session persists → open `/dashboard?tab=payments` deep link.
5. Enable push (if VAPID set) → confirm a `push_subscriptions` row → send test via `send-web-push`.
6. DevTools → Application → Service Workers: registered on `app.phindu.com` only; none on the two staff domains.

---

## 7) Failure troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| 404 on refresh / deep link | SPA rewrite missing for that project | Add `vercel.json` rewrite (§1). Confirm Output Directory points to the correct `dist`. |
| Wrong site mode (office UI on marketing, or vice-versa) | `VITE_SITE_MODE` wrong/absent, or built before env set | Set correct `VITE_SITE_MODE`, **redeploy** (Vite inlines at build time — no runtime override). `ensureCorrectHost` also redirects mismatched hosts. |
| Supabase auth redirect mismatch / login bounces | Domain not in Auth Redirect URLs | Add `https://<domain>/**` in Supabase Auth → URL Configuration (§3). |
| Missing env var at runtime (blank app, requests to `undefined`) | `VITE_SUPABASE_URL` / `_PUBLISHABLE_KEY` unset for that env scope | Set both for Production+Preview+Development, redeploy. Never blank them to "fix". |
| PWA not installable on `app.phindu.com` | Not served over prod build, SW unregistered in preview, or manifest 404 | Deploy production (SW only registers when `PROD`); confirm `manifest.json` + `service-worker.js` return 200; run `npm run audit:pwa`. |
| Manifest/install appears on staff domain | Wrong output dir (borrower dist served for staff) | Point staff projects to `apps/staff-web/dist`; `audit:pwa` asserts staff has no manifest. |
| Build fails resolving `@phinduloans/shared` | Root Directory set to app folder, breaking workspace resolution | Set Root Directory to repo root; use `npm run build:staff` / `build:borrower`. |
