# Chrome “Dangerous site” recovery (app.phindu.com)

Chrome’s red **Dangerous site** page is **Google Safe Browsing**, not a bug in React or Supabase. Finance login pages that also push **APK / sideload installs** are often classified as **social engineering** or **unwanted software**.

Code changes in this repo separate **sign-in** (`/auth`) from **optional installs** (`/install`) so Google can re-classify the site. You still must **request a review** after deploy.

## 1. Deploy the fix

```bash
npm run deploy:borrower:full
```

Confirm live:

- `https://app.phindu.com/auth?mode=signup` — **no** APK or “Download now” buttons; official Phindu copy + support email only.
- APK only on `https://app.phindu.com/install` (and optional post-login nudge → install page, not direct `.apk`).

## 2. Google Search Console (required for all Chrome users)

1. Open [Google Search Console](https://search.google.com/search-console).
2. Add property **`https://app.phindu.com`** (Domain or URL prefix).
3. Verify via DNS (recommended) or HTML file.
4. Go to **Security & Manual Actions** → **Security issues** (or Safe Browsing report if shown).
5. Fix any listed problems, then click **Request review**.
6. Describe changes, for example:
   - Removed software download prompts from login/signup URLs.
   - Borrower flows are web-first; APK only on `/install` with company identification.
   - Official contact: info@phinducredit.co.zm

Reviews often take **2–7 days**. Until Google clears the flag, some mobile Chrome users may still see the warning.

## 3. Optional hardening

- Set **`VITE_PLAY_STORE_URL`** when Play listing is live — prefer Play over APK.
- Replace placeholder SHA-256 in `apps/borrower-mobile/public/.well-known/assetlinks.json` with your Play App Signing certificate.
- Link `app.phindu.com` from `https://phindu.com` (marketing) so ownership is obvious to reviewers.

## 4. Verify

- [Transparency Report search](https://transparencyreport.google.com/safe-browsing/search?url=https%3A%2F%2Fapp.phindu.com) (may lag behind Chrome).
- Test on Android Chrome (normal and incognito) on mobile data, not only office Wi‑Fi.

## 5. If still flagged

- Scan Cloudflare/Vercel deploy for unknown redirects or injected scripts.
- Ensure the APK in `public/downloads/PhinduCredit.apk` is **your** release build (not repackaged).
- Escalate via Search Console support with your legal entity name and Zambia registration details if needed.
