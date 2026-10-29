# Day 1: Leave Lovable + submit Play Store

Do these in order. **Borrowers on the web can work before Play approval.**

---

## Part A — Backend: use Phindu Loans (seobil) only

Your data is already on **seobil** (`seobilifwyxhtjvsgqpc`). Apps still point at **Lovable** until secrets change.

### A1 — Local `.env` (5 min, you)

1. Supabase → **Phindu Loans** → **Settings → API**
2. Copy **Project URL** and **anon public** key
3. Copy `.env.seobil.local.example` → `.env.seobil.local` and paste keys
4. Run: `node scripts/use-seobil-supabase.mjs`

### A2 — Production deploy secrets (10 min, you + browser)

**GitHub login (one time):** In Cursor terminal run:

```bash
gh auth login
```

Choose: GitHub.com → HTTPS → **Login with a web browser** → paste code.

Then:

```bash
node scripts/supabase-cutover-secrets.mjs
```

Trigger deploy (GitHub → Actions → **Deploy Production** or staff + borrower workflows).

### A3 — Supabase Auth (seobil dashboard)

- Site URL: `https://app.phindu.com`
- Redirect URLs: `https://app.phindu.com/**`, `https://office.phindu.com/**`, `https://phindu.com/**`

### A4 — Smoke test

- `https://app.phindu.com/auth` — OTP login
- `https://office.phindu.com` — staff login, delete/undo on a test loan

---

## Part B — Keystore (plain English)

A **keystore** is a **password-protected file** that proves *you* own app updates on Play.  
Google does **not** create this for you. You create it **once**, back it up, and never lose it.

You do **not** need Android Studio on your PC — use GitHub:

1. Push repo (includes workflow **Generate Android upload keystore**)
2. GitHub → Actions → run that workflow once
3. Download artifact **phindu-upload-keystore**
4. Repo **Settings → Secrets** → add:
   - `ANDROID_KEYSTORE_BASE64` (from the `.b64` file in the artifact)
   - `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_PASSWORD` (from workflow summary)
   - `ANDROID_KEY_ALIAS` = `phindu-borrower`
5. Run **Build borrower AAB (Play Store)** → download **PhinduCredit-release.aab**

---

## Part C — Play Console (you have an account)

1. **Create app** → Phindu Credit, package `com.phindu.loans.borrower`
2. **Store listing** — use `apps/borrower-mobile/play-store-assets/STORE_LISTING.md` + images in that folder
3. **App content** — privacy URL, Data safety, target 18+
4. **Production** → upload AAB → **Send for review**

Review: often **hours to 3 days** (finance apps can take longer).

### After Play accepts

1. Copy **SHA-256** (App signing) into `apps/borrower-mobile/public/.well-known/assetlinks.json`
2. Set `VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.phindu.loans.borrower`
3. `npm run deploy:borrower:full` (or production workflow)

---

## What “live in a day” means

| Today | After Google approves |
|-------|------------------------|
| app.phindu.com + APK sideload | Play Store install button |
| Backend on seobil (after A2) | Same app, Play discovery |
