# Borrower go-live today — PWA, website APK, Play Store prep

Use this checklist to put **online apply**, **app.phindu.com PWA**, and **APK download** live. iOS App Store is “coming soon”; use Safari **Add to Home Screen** until then.

## A. Lovable / Supabase (run once in SQL Editor, in order)

**Borrower ↔ admin fixes (contract sign, house roster, finance docs):** run after the list below:

- `supabase/migrations/20260928120000_borrower_portal_admin_visibility_fixes.sql`

Minimum for apply + payments + receipts (full scripts in repo `supabase/migrations/`):

| Step | Migration file |
|------|----------------|
| 0a | `20260602181107_0865bc08-f4a2-4b14-a5c1-387206e3f591.sql` (audit_logs INSERT) |
| 1 | `20260603185037_443ee6b5-5131-4ee1-9b54-a4a7e1a48593.sql` |
| 2 | `20260603204500_collateral_term_1_12_everywhere.sql` |
| 3 | `20260603213000_collateral_partial_payment_repair.sql` |
| 4 | `20260604100000_reconcile_fully_paid_loan_statuses.sql` |
| 5–8 | `20260604130000_*` through `20260604170000_payday_per_loan_interest_catalog.sql` |
| 9 | `20260610212831_c6a0bc22-cde9-414b-b314-ac9594a251f4.sql` (`record_loan_payment` + receipt fields) |

**Auth (Supabase dashboard):**

- Site URL: `https://app.phindu.com`
- Redirect URLs: `https://app.phindu.com/**`, `https://office.phindu.com/**`, `https://phindu.com/**`
- Edge secret: `BORROWER_APP_URL=https://app.phindu.com` → redeploy **`verify-otp`**

**Products:** each borrower-facing product needs `channels` including `website` and `is_active = true`.

Verify:

```sql
SELECT product_code, is_active, channels FROM loan_products WHERE 'website' = ANY(channels);
```

## B. Cloudflare — three deploys

| Domain | Build | Command |
|--------|-------|---------|
| `app.phindu.com` | borrower | `npm run deploy:borrower:full` |
| `phindu.com` | staff marketing | `VITE_SITE_MODE=marketing` + `npm run build:staff` + deploy staff worker |
| `office.phindu.com` | staff office | `VITE_SITE_MODE=office` + build + deploy |

**Borrower env** (`.env` at repo root or CI):

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_BORROWER_APP_URL=https://app.phindu.com
VITE_OFFICE_BASE_URL=https://office.phindu.com
VITE_MARKETING_BASE_URL=https://phindu.com
# When Play is live:
# VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.phindu.loans.borrower
```

One-shot deploy (build + PWA audit + APK check + wrangler):

```bash
npm run deploy:borrower:full
```

Or without deploy:

```bash
npm run go-live:borrower
```

## C. APK for download today

APK is served at **`https://app.phindu.com/downloads/PhinduCredit.apk`** from  
`apps/borrower-mobile/public/downloads/PhinduCredit.apk` (copied into `dist` on build).

### Option 1 — GitHub Actions (no Android Studio on your PC)

1. Push to `main` or run workflow **Build borrower APK**.
2. Download artifact **PhinduCredit-apk**.
3. Copy to `apps/borrower-mobile/public/downloads/PhinduCredit.apk`.
4. Run `npm run deploy:borrower:full`.

### Option 2 — Local (Android Studio)

1. Install JDK 17 + Android Studio.
2. `npm install`
3. `npm run prepare:borrower:android`
4. `npm run build:borrower:apk`
5. `npm run deploy:borrower:full`

Default Capacitor shell loads **`https://app.phindu.com`** so web updates do not require a new APK every time. For fully bundled offline UI: `set CAPACITOR_BUNDLE_LOCAL=1` before prepare/build.

## D. PWA

Already enabled: `manifest.json`, `service-worker.js`, `/install`, soft nudge after login.

After deploy:

```bash
npm run audit:pwa
```

Manual: Chrome → app.phindu.com → Install app; Android APK only from `/install` (never on `/auth`). If Chrome shows **Dangerous site**, see `docs/CHROME_SAFE_BROWSING_RECOVERY.md`.

## E. Smoke test (10 minutes)

1. `https://app.phindu.com/auth` → OTP → dashboard.
2. Apply → pick product → submit (or save draft).
3. Upload a KYC doc; confirm in office admin.
4. `/install` → APK download works on Android.
5. `https://phindu.com` Login → lands on `app.phindu.com/auth`.
6. Re-login on APK with same phone → same loans visible.

## F. Google Play (parallel, not same-day)

1. Signed **AAB** from Android Studio (`bundleRelease`).
2. Play Console listing + privacy policy URL.
3. Update `public/.well-known/assetlinks.json` with Play signing SHA-256.
4. Set `VITE_PLAY_STORE_URL` and redeploy borrower app.

## G. iOS

- **Now:** Safari → Share → Add to Home Screen on `app.phindu.com`.
- **Later:** Mac + `npx cap add ios` → TestFlight → App Store.
