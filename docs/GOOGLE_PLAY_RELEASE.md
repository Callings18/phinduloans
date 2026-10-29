# Google Play — Phindu Credit borrower app

**Package:** `com.phindu.loans.borrower`  
**Listing name:** Phindu Credit (borrower portal)  
**Technical model:** Capacitor shell loading `https://app.phindu.com` (TWA-style WebView; web updates without forcing APK updates for most changes).

## Before you upload

1. **Play Console** — create developer account ($25 one-time) if needed.
2. **Privacy policy URL** — public page (e.g. `https://phindu.com/privacy` or existing policy).
3. **Supabase + app.phindu.com** live and stable (OTP, apply, repay).
4. **Release keystore** — create once and back up securely (loss = cannot update app).

```bash
keytool -genkey -v -keystore phindu-borrower-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias phindu-borrower
```

## Build AAB (recommended: GitHub Actions)

Add repository **Secrets**:

| Secret | Value |
|--------|--------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 phindu-borrower-release.jks` (Linux) or PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("..."))` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | e.g. `phindu-borrower` |
| `ANDROID_KEY_PASSWORD` | key password (often same as keystore) |

Run workflow **Build borrower AAB (Play Store)** → download artifact **PhinduCredit-release-aab**.

Local alternative:

```bash
npm run prepare:borrower:android
set ANDROID_KEYSTORE_PATH=C:\path\phindu-borrower-release.jks
set ANDROID_KEYSTORE_PASSWORD=...
set ANDROID_KEY_ALIAS=phindu-borrower
node scripts/build-borrower-aab.mjs
```

## Play Console checklist

1. **Create app** → default language, app/game, free.
2. **Store listing** — short/long description, screenshots (phone), feature graphic, icon 512×512.
3. **App content** — privacy policy, ads (No), target audience, data safety form (phone, financial info).
4. **Release → Production → Create new release** → upload **PhinduCredit-release.aab**.
5. Complete **review** questionnaire (financial/loan apps may need extra declarations).

## After first upload

1. Play Console → **Setup → App signing** → copy **SHA-256 certificate fingerprint** (app signing key).
2. Update `apps/borrower-mobile/public/.well-known/assetlinks.json` with that fingerprint (replace placeholder).
3. Redeploy borrower: `npm run deploy:borrower:full` (enables Digital Asset Links / verified links).
4. Set in `.env` and GitHub secrets:

```env
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.phindu.loans.borrower
```

5. Redeploy borrower so `/install` and PWA nudge prefer **Get it on Google Play** over sideload APK.

## Contract PDF colours

Loan contracts use `packages/shared/src/utils/pdfTheme.ts` (Phindu maroon header + pink accents). Regenerate contracts from office after deploy so new PDFs match brand; old stored PDFs in storage are unchanged until regenerated.

## Still offer PWA

Play listing does not replace **app.phindu.com** or **Add to Home Screen**. Keep `/install` for users who prefer direct web install.
