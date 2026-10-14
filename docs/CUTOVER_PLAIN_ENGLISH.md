# Moving from Lovable to Phindu Loans (plain English)

## Why your changes “do nothing” today

The **office app** (and GitHub deploy secrets) still talk to **Lovable’s database**:

- Project: `yqrfheavftgybhcafzpt`
- Your repo `.env` has `VITE_SUPABASE_URL=https://yqrfheavftgybhcafzpt.supabase.co`

All code you merge only helps **after** the deployed site uses **`seobilifwyxhtjvsgqpc`** (Phindu Loans).

The **new database is already prepared** (data restored, delete RPC, Salary Advance mistakes removed on seobil). Staff and borrowers will not see that until the **flip**.

---

## Two worlds (until flip)

| | **Live today (Lovable)** | **Ready (Phindu Loans / seobil)** |
|--|--------------------------|-----------------------------------|
| Who uses it | office.phindu.com, app.phindu.com | Nobody in production yet |
| Delete / undo fixes | Old schema/RPC unless you patch yqrf | Already applied |
| Salary Advance bad loans | Still there until purge on **yqrf** OR you flip | **Already deleted (4 loans)** |

---

## Transition without surprising clients

**Goal:** One short switch so everyone uses seobil; Lovable becomes read-only backup, then disconnected.

### Before flip (no user impact)

1. Run `node scripts/cutover-verify.mjs` — seobil should show ~69 loans, 0 Salary Advance, 2159 storage paths.
2. Copy **actual files** into seobil bucket `loan-documents` (Lovable support ticket if needed).
3. Deploy **edge functions** + secrets on seobil (see `docs/LOVABLE_CUTOVER_HANDOVER.md`).
4. **Test locally:** point `.env` at seobil URL + anon key, run staff app, log in, delete a test loan, undo disbursement.

### Flip (5–15 min window — only time users feel it)

1. Tell staff: pause new disbursements for the window.
2. Optional: fresh Lovable export + re-run `node scripts/cutover-restore-ordered.mjs` if you need zero drift.
3. **Point production at seobil:**
   - `gh auth login`
   - Put seobil anon key in `.env` as `VITE_SUPABASE_PUBLISHABLE_KEY` and URL `https://seobilifwyxhtjvsgqpc.supabase.co`
   - `node scripts/supabase-cutover-secrets.mjs`
   - Trigger deploy (staff + borrower workflows), purge Cloudflare cache.
4. Supabase **Auth → URL configuration**: Site URL + redirects for `office.phindu.com` and `app.phindu.com`.
5. Smoke test: login, open loan, **admin delete**, **undo disbursement**, create loan in correct house.

### Rollback

Revert GitHub secrets to yqrf keys and redeploy. Lovable data unchanged if you have not disconnected.

---

## Delete vs “close” — rules for staff

| Action | When | What happens to repayments / ledger |
|--------|------|-------------------------------------|
| **Delete loan** (admin / `loans.delete`) | Mistake, wrong house (e.g. Salary Advance), pre-live cleanup | RPC `admin_purge_loan_application` removes repayments, disbursements, linked **account_transactions**, documents rows, then the loan |
| **Delete loan** (normal staff) | Only early statuses: pending, approved, rejected, etc. | Same RPC if allowed |
| **Undo disbursement** | Loan went out by mistake but you keep the record | Status **active/disbursed → approved** (needs migration `20261013120000` on the **connected** project) |
| **Close / complete loan** | Borrower finished paying | Status → **completed** (existing workflow; not the same as delete) |

**Salary Advance mistakes on seobil:** already purged. On **Lovable live**, delete still fails until you either flip to seobil or run the purge SQL on yqrf once.

---

## Commands you run (seobil)

```bash
node scripts/cutover-verify.mjs
node scripts/cutover-restore-ordered.mjs    # only if re-importing export
node scripts/cutover-restore-storage.mjs    # storage.objects metadata
```

SQL already on seobil: `APPLY_admin_purge_loan_rpc.sql`, `20261013120000` undo disbursement.

---

## What we cannot do from this machine without you

- **Flip production** — needs `gh auth login` and deploy (secrets are on GitHub, not in repo).
- **Supabase CLI on Windows npx** — broken; use Dashboard SQL Editor (you have seobil open) or `DATABASE_URL` + psql scripts.
- **Change Lovable** without using yqrf credentials or disconnecting.
