# Borrower PWA + Three-Domain Rollout

This runbook finalizes the architecture:

- `https://phindu.com` -> marketing site
- `https://office.phindu.com` -> staff LMS/admin
- `https://app.phindu.com` -> borrower PWA

## 1) Environment configuration

Set these frontend env vars for `apps/staff-web`:

- `VITE_BORROWER_APP_URL=https://app.phindu.com`
- `VITE_SITE_MODE=marketing` for `phindu.com` deploy
- `VITE_SITE_MODE=office` for `office.phindu.com` deploy
- `VITE_OFFICE_BASE_URL=https://office.phindu.com`

Set these backend/edge env vars:

- `BORROWER_APP_URL=https://app.phindu.com` (used by `supabase/functions/create-borrower`)

## 2) Supabase Auth redirect allowlist

In Supabase dashboard (`Authentication -> URL Configuration`), add:

- Site URL: keep current production URL if needed
- Additional Redirect URLs:
  - `https://app.phindu.com/**`
  - `https://office.phindu.com/**`
  - `https://phindu.com/**`

Do not remove existing URLs until traffic is fully migrated.

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

## 4) Deploy marketing/staff domains

Use two deploy targets from the same `apps/staff-web` app:

1. Marketing target (`phindu.com`)
   - `VITE_SITE_MODE=marketing`
2. Office target (`office.phindu.com`)
   - `VITE_SITE_MODE=office`

In marketing mode, `/admin/*` redirects to `https://office.phindu.com/admin`.
In office mode, public marketing routes redirect to `/admin`.

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
5. Notification click-through with `action_url`.
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

1. `phindu.com` "Apply/Get Started" routes to `app.phindu.com`.
2. Staff login on `office.phindu.com` works unchanged.
3. Borrower deep links in SMS/openers point to `app.phindu.com`.
4. Staff domain does not expose web manifest for install.
