# Restore Lovable database export (`.backup`)

Lovable **Export data** delivers a zip containing a **PostgreSQL custom-format** dump (`PGDMP`), e.g. `loan-kindly-flow_261008.backup` (~15 MB for Oct 2026 export).

**Target project:** `seobilifwyxhtjvsgqpc` (Phindu Loans)

---

## 1. Stage the file (repo)

```powershell
cd "C:\Users\HOKMA\OneDrive\Documents\SOFTWARE DEVELOPEMENT\phinduloans"
node scripts/prepare-lovable-db-export.mjs "C:\Users\HOKMA\Downloads\bucket-database_export_08_10_26-files.zip"
```

Staged copy: `.data-cutover/loan-kindly-flow_261008.backup` (gitignored).

---

## 2. Install `pg_restore` (one-time on Windows)

The Supabase CLI npm package does not run on this machine; use PostgreSQL client tools:

```powershell
winget install PostgreSQL.PostgreSQL.17
```

Then open a **new** terminal and confirm:

```powershell
pg_restore --version
```

---

## 3. Inspect what is inside the dump

```powershell
pg_restore -l ".data-cutover\loan-kindly-flow_261008.backup" > .data-cutover\restore.toc.txt
```

Check `.data-cutover\restore.toc.txt` for:

| If you see… | Meaning |
|-------------|---------|
| `TABLE DATA auth users` | Export includes **auth users** (UUIDs). Coordinate with Lovable support — use **either** this dump **or** their auth migration, not both blindly. |
| `TABLE DATA public …` | Business data (loans, borrowers, settings). |
| `TABLE DATA storage …` | Storage metadata only — **not** the 2,159 files in `loan-documents` (still need storage migration). |

---

## 4. Database password (seobil)

Supabase Dashboard → **Phindu Loans** → **Project Settings → Database**:

- **Direct connection** host: `db.seobilifwyxhtjvsgqpc.supabase.co`
- Port **5432**, database `postgres`, user `postgres`
- Reset/copy the **database password** if needed.

Connection URI (replace password):

```text
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Use the **Session pooler** or **Direct** URI from the dashboard (region may differ). For `pg_restore`, **direct 5432** is most reliable.

---

## 5. Restore strategies

### Option A — Replace seobil contents (typical cutover)

Use when `seobil` should become a clone of Lovable production data.

1. **Maintenance:** no new loans/payments on Lovable.
2. **Schema:** either trust the dump’s schema **or** run `db push` first — **do not mix** full schema restore + full migration history without a plan.
3. **Common pattern for “migrations in git + data from Lovable”:**
   - Fresh/empty `public` data on seobil (new project or truncate public tables after `db push`).
   - Restore **data only**:

     ```powershell
     $env:PGPASSWORD = "[DATABASE_PASSWORD]"
     pg_restore `
       --dbname="postgresql://postgres@db.seobilifwyxhtjvsgqpc.supabase.co:5432/postgres" `
       --data-only `
       --schema=public `
       --no-owner `
       --no-acl `
       --verbose `
       ".data-cutover\loan-kindly-flow_261008.backup"
     ```

   - If the dump includes `auth` and you are **not** waiting on Lovable auth migration:

     ```powershell
     pg_restore ... --data-only --schema=auth --disable-triggers ".data-cutover\loan-kindly-flow_261008.backup"
     ```

     (`auth` restores need care with triggers; test on a scratch project first if unsure.)

4. After restore: run `supabase/scripts/APPLY_admin_purge_loan_rpc.sql` if purge RPC missing.
5. Reconcile sequences (if inserts fail on new rows):

   ```sql
   -- Example: SELECT setval(pg_get_serial_sequence('public.loan_applications','id'), (SELECT MAX(id) FROM public.loan_applications));
   ```

### Option B — Full restore into empty project

If seobil has **no** important data and you want an exact copy of the export:

```powershell
pg_restore `
  --dbname="postgresql://postgres@db.seobilifwyxhtjvsgqpc.supabase.co:5432/postgres" `
  --no-owner `
  --no-acl `
  --verbose `
  ".data-cutover\loan-kindly-flow_261008.backup"
```

Expect errors if objects already exist; use `--clean --if-exists` only when you intend to **drop** matching objects (destructive).

---

## 6. After database restore

1. **Storage:** import `loan-documents` objects (Lovable support ticket) — DB rows point at paths in that bucket.
2. **Edge functions + secrets + cron:** `docs/LOVABLE_CUTOVER_HANDOVER.md`
3. **Frontend:** GitHub `VITE_SUPABASE_*` → seobil, redeploy, purge Cloudflare cache.
4. **Verify:** row counts, borrower OTP login, open one KYC file, test payment.

---

## 7. Security

- Never commit `.backup` files or database passwords.
- Delete local dumps after successful cutover if policy requires.
