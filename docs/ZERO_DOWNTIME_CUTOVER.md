# Zero-impact cutover (Lovable live, seobil ready)

Production **stays on Lovable** (`yqrfheavftgybhcafzpt`) until you deliberately flip the frontend. All preparation happens on **Phindu Loans** (`seobilifwyxhtjvsgqpc`) with **no change** to what borrowers/staff use today.

## Parallel tracks

| Track | Where | Who is affected |
|-------|--------|-----------------|
| **A — Live** | Lovable / yqrf, GitHub secrets → yqrf, Cloudflare deploy | Everyone (unchanged) |
| **B — Target** | seobil, export restore, `db push`, functions, storage copy | Nobody until flip |

## Complete track B (backend ready)

1. **Schema:** `supabase db push --yes` (fix any failing migrations; see `repair_payroll_records_status.sql`).
2. **Data:** `.env.cutover.local` → `node scripts/cutover-restore-ordered.mjs` (preferred) or legacy `restore-lovable-db-export.mjs`; then `node scripts/cutover-restore-storage.mjs` for `storage.objects` metadata; `node scripts/cutover-verify.mjs` for counts.
3. **RPC:** `APPLY_admin_purge_loan_rpc.sql` on seobil.
4. **Functions + secrets + cron:** `docs/LOVABLE_CUTOVER_HANDOVER.md`.
5. **Storage files:** Lovable support / manual copy into `loan-documents` on seobil (same paths).
6. **Verify on seobil only:** row counts, test login against seobil URL in a **local/staging build** (do not change production env yet).

## Flip (short maintenance — only moment users feel it)

1. Announce window; stop **new** payments on Lovable (optional: read-only banner on office).
2. Final export or delta if you need last-minute rows (otherwise accept small drift).
3. Re-run truncate + public restore on seobil if you took a fresh export.
4. `node scripts/supabase-cutover-secrets.mjs` → GitHub `VITE_SUPABASE_*` = seobil.
5. Redeploy staff + borrower Workers; purge Cloudflare cache.
6. Smoke test production URLs; monitor 24–72h.
7. **Then** Lovable disconnect (irreversible).

## What “no impact until flip” means

- Borrowers and staff **keep using yqrf** until step 4–5.
- seobil can be incomplete or broken during prep — production is unaffected.
- After flip, **only seobil** is used; Lovable can stay connected read-only for rollback until you are confident, then disconnect.

## Rollback (if flip goes wrong)

If you flip secrets and something fails: revert GitHub secrets to yqrf anon URL/key, redeploy, purge cache. Lovable data is unchanged if you have not disconnected.
