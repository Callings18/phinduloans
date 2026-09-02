# PHINDU — Phase 0 Migration Audit

**Date:** 2 September 2026  
**Repository:** `https://github.com/Callings18/phinduloans` (working copy `phinduloans-railway-nest`)  
**Branch inspected:** `feat/railway-nest-api`  
**Method:** Read-only inspection of the tree, configs, migrations, APIs, and money/auth paths. Production live UAT was **not** executed in this pass.  
**Constraint honored:** No product rewrite. This file is the Phase 0 deliverable.

---

## Executive verdict

Phindu is **not** a greenfield Next.js + Expo app. It is a **working Vite + React LMS** (Lovable-era UI) that already talks to **your Supabase project**, plus a **NestJS strangler API on Railway** that now owns most office money writes.

A same-day “complete rebuild” into Next.js + Expo would **destroy useful functionality** and cannot be made production-correct today. The production path is:

1. **Keep** Vite staff ERP + marketing, Capacitor/PWA borrower (until Expo is a dedicated phase).
2. **Keep** one Postgres: **Supabase**. Railway hosts Nest + static web only.
3. **Finish** cutting browser writes, freeze Lovable so it cannot republish old writers, redeploy API then web, run UAT.
4. **Later** (not today): Expo native borrower, decimal money engine, Next.js only if there is a real SSR/SEO need.

Claiming the system is “production-ready and bug-free” would be false. Core LMS flows exist and are largely real; several **blockers** remain (ops, dual writes, Lovable runtime, native app, financial math).

---

## 1. Current architecture

```
GitHub  ──► Cursor
              │
              ├── apps/staff-web     Vite SPA: marketing + office ERP (React Router)
              ├── apps/borrower-mobile  Vite SPA + Capacitor Android/iOS shell (NOT Expo)
              ├── packages/shared    UI, auth, loan math, Supabase client, Nest helpers
              ├── backend            NestJS API (Railway) — service-role writes + some Prisma reads
              ├── apps/api-next      Optional Next.js API on :3001 — parallel/legacy, not the Railway path
              ├── supabase/          migrations + Edge Functions
              └── Dockerfile         PHINDU_SERVICE=api | web | office | marketing | borrower
```

**Data:** Supabase Postgres is the business source of truth. Nest uses `DATABASE_URL` (same DB) and `SUPABASE_SERVICE_ROLE_KEY`. There is **no** second production loan ledger on Railway.

**Auth:** Supabase Auth. Staff: email/password in `apps/staff-web/src/pages/Auth.tsx`. Borrowers: phone OTP via Edge `send-otp` / `verify-otp`. Nest authenticates with Bearer JWT (`auth.getUser`).

**Reads:** Staff and borrower UIs still query Supabase directly (RLS). That is appropriate for many lists.

**Writes (strangler):** When `VITE_API_URL` is set, `apiFeatureFlags.coreWrites` / `phase1Workflow` send apply, payments, approvals, disbursement, reloan/top-up/restructure, loan patch, document metadata, etc. to Nest `/api/v1`.

**Hosting (trial):** Two Railway services — Nest `api` and combined `web` (landing + `/admin` + `/borrower`). Cloudflare Wrangler configs exist for staff/borrower static deploys; they are **not** the current Railway combined image.

---

## 2. Existing modules (map)

| Area | Where it lives | Notes |
|------|----------------|--------|
| Public site | `staff-web` `/`, `/about`, `/faq`, `/loan-products`, `/contact`, `/calculator` | Hostname `VITE_SITE_MODE` splits marketing vs office |
| Staff ERP | `/admin/*` + product **houses** | Applications, loans, borrowers, repayments, disbursements, collections, write-offs, accounts, expenses, PMIC, CRB, court, HR, payroll, reports, settings, AI ops |
| Borrower web | `borrower-mobile` `/auth`, `/dashboard`, `/apply`, `/profile`, `/install` | PWA + Capacitor `webDir: dist` |
| Loan products | DB `loan_products` + house UIs | Not fully hardcoded; some product-specific shells |
| Calculations | `packages/shared/src/utils/loanCalculations.ts`, Marketeer lib, DB RPCs | **JS `number`**, not decimal library |
| Payments | RPC `record_loan_payment` via Nest | Authoritative for recorded installments |
| Schedule | Shared `createRepaymentSchedule` + Nest `repayment-schedule.ts` + DB `generate_loan_schedule_for` | Three generators; holiday calendar not identical |
| RBAC | `user_roles`, `get_my_permissions`, `PermissionRoute` | Admins bypass UI checks; RLS still required |
| KYC/docs | Storage `loan-documents` + `application_documents` | Nest registers metadata after client upload |
| Notifications | Edge: ExciteSMS, queue, web-push, OTP | AI uses **Lovable AI gateway** |
| Tests | Vitest unit + Playwright e2e + one full loan-flow integration | Integration needs E2E secrets |

---

## 3. Existing working functionality (code-complete, not live-UAT)

These are implemented as real DB/API operations (not stub buttons), **if** Railway `VITE_API_URL` is live and Edge/OTP secrets are set:

- Staff login (email/password), borrower OTP (code exists; Edge must be redeployed).
- Create borrower, create/edit application (Nest + house forms).
- Document upload to Storage + Nest document rows.
- Approval transitions (`transition_loan_status` / Nest).
- Disbursement complete RPC, record repayment + receipt.
- Reloan, top-up, restructure (Nest, as of `22c93b4` / `362d70c`).
- Reverse payment, undo disbursement, delete pre-money loan.
- Write-offs / expenses / penalties / early-settlement quote (Nest RPCs).
- Dashboards and reports that **read** Supabase (real queries, not static JSON).
- Marketing pages and calculator UI.
- Product-house routing and many operational screens.

**Preserve:** Visual identity (Tailwind/shadcn), loan-house model, RPC money functions, RBAC tables, staff vs borrower auth split, existing UIs.

---

## 4. Broken / high-risk functionality

| Item | Why |
|------|-----|
| House workflow dual-write | `houseWorkflowRepository.ts` still **updates loans, schedules, accounts** via the browser for some house top-up/restructure/disburse paths |
| Borrower contract signing | `ContractSigningWidget` still writes loan/storage from the client |
| `loan_notes` / drafts | Still client → Supabase |
| Schedule divergence | Nest Sunday-skip vs UI business calendar vs DB `generate_loan_schedule_for` |
| CRB / guarantee | Mock scores when API keys missing (`crb-check`, `guarantee-check`) |
| Combined Railway host | `*.up.railway.app` treated as **dev** so `/auth` is staff login; custom domains still required for phindu.com / office / app |
| Wrangler vs Vite outDir | `wrangler.staff.jsonc` points at `apps/staff-web/dist`; staff Vite `outDir` is repo-root `dist/` |
| `apps/api-next` | Second API; easy to call the wrong backend |
| Live trial | Redeploy order (api then web) and Edge OTP not verified from this audit |

---

## 5. Incomplete vs the “final product” spec

| Spec item | Status |
|-----------|--------|
| Next.js public + office | **Not the current stack.** Vite SPAs. Do not rewrite today. |
| Expo + Expo Router native app | **Missing.** Capacitor wraps the **same Vite web app**. That is a WebView shell, not a native RN app. |
| MFA | Not a first-class product flow in Auth UI |
| Decimal-safe money in TS | **Missing.** JS floats in `loanCalculations.ts` |
| Single calculation engine used by DB + API + UI | **Partial.** UI + Nest schedule + SQL RPCs overlap |
| Email notifications | Spec says none; `brevo-notification` and `AdminEmailLog` still exist |
| Idempotency keys on all money POSTs | Not uniformly implemented |
| Full E2E “create borrower → paid” in CI | Script exists; **skipped** without secrets |
| AI agents | UI + Edge; **blocked** on Lovable AI key |
| HR/payroll Zambia tax | Configurable UI exists; do not invent PAYE |
| Custom domains / Cloudflare cutover | Documented, not completed in this workspace |

---

## 6. Lovable dependencies

**Runtime / product coupling (must leave production):**

- `supabase/functions/ai-copilot` and `ai-agent-run` call `https://ai.gateway.lovable.dev` with `LOVABLE_API_KEY`.
- UI copy and Edge comments tell operators to set secrets **in Lovable**.
- Docs (`LOVABLE_MIGRATION_PACK.md`, `LAUNCH_OPS_RUNBOOK.md`, `.env.example`) still assume Lovable Cloud PITR, SQL editor, and publish.
- `apps/staff-web/src/App.tsx` treats Lovable/local hosts as `dev` (preview behavior).

**npm (declared, unused in source):**

- `@lovable.dev/cloud-auth-js` — **no imports** found in `.ts/.tsx`. Dead dependency.
- `lovable-tagger` — **not** wired in current `vite.config.ts`. Dead devDependency.

**Architecture leftover:**

- Root `src/integrations/supabase/client.ts` (“do not edit, generated”) — old Lovable monolith path; live apps use `packages/shared`.

**Ops risk:** If Lovable still has write access to the same GitHub/Supabase project, a Lovable publish can **overwrite** Railway-era Nest writers with old client RLS writes.

---

## 7. Database findings

- **~274 SQL migrations** under `supabase/migrations/` (Lovable-era timestamps + later house/RBAC/finance files). Applying blindly on a live project is unsafe; use `schema_migrations` and additive-only changes.
- Core tables (from usage): `loan_applications`, `loan_repayments`, `loan_products`, `disbursements`, `accounts`, `account_transactions`, `profiles`, `user_roles`, `application_documents`, `borrower_document_vault`, `loan_events`, `audit_logs`, `payment_claims`, HR/payroll tables, notification queue.
- Money RPCs: `record_loan_payment`, `complete_disbursement`, `transition_loan_status`, `apply_loan_penalties`, `calculate_early_settlement`, schedule helpers.
- RLS is enabled across many migrations; **this audit did not execute policies against live data**. Privilege bugs would only show in a dedicated RLS test with two users.
- Nest `updateLoan` allowlists columns; that is good. House repo bypasses it.

**Required DB/Supabase work (no DROP):** confirm project `yqrfheavftgybhcafzpt` is **your** project (it is baked into Dockerfile ARG defaults); rotate if that was a shared Lovable project; redeploy Edge `send-otp`/`verify-otp`; keep service role only on Nest + Edge.

---

## 8. Security findings

| Severity | Finding |
|----------|---------|
| High (ops) | Dockerfile ARG **defaults** embed `VITE_SUPABASE_URL` and the **anon JWT** for project `yqrfheavftgybhcafzpt`. Anon is public-by-design but should not be a git default; confirm project ownership and that **service role is not** in the image. |
| High (product) | Dual-write house paths + borrower contract writes can fail or succeed under RLS inconsistently. |
| High (product) | Staff `can()` returns true for `admin`/`super_admin` in the UI; **RLS must** still deny. Nest `StaffGuard` is the server check for API writes. |
| Medium | CRB/guarantee **mock** responses if keys missing — can look like real underwriting. |
| Medium | `useAuth` fetches IP from `api.ipify.org` for audit (privacy/ops). |
| Medium | Signed storage URLs exist (`getSignedUrl`); public bucket misconfig would leak KYC. |
| Low | Dead Lovable packages still installed. |
| Info | Sentry is a frontend dependency (`@sentry/react`); not confirmed as configured. |

No service-role key was found in frontend source. Edge functions correctly use `SUPABASE_SERVICE_ROLE_KEY` in Deno env.

---

## 9. Loan calculation findings

- **Authoritative repayment recording:** Postgres RPC `record_loan_payment` (via Nest). Balances for paid loans should be derived from `loan_repayments`, not a cached display field alone (`calculateLoanBalanceSnapshot` exists).
- **Quote/pricing:** TypeScript `calculateLoan` (flat vs reducing, Marketeer, Payday Soft, fees). Uses IEEE floats — rounding risk on large books.
- **Schedules:** Three implementations (shared TS + Nest port + SQL). Reloan dates can disagree with holidays.
- **Do not invent** new interest rules. Preserve product rows and existing functions; document gaps instead.

---

## 10. Authentication findings

- Staff: email/password only on office/combined preview `/auth`.
- Borrower: phone OTP Edge functions; staff hitting OTP should 403 (code present; **redeploy required**).
- Roles from `user_roles`. Nest `STAFF_ROLES` set matches `useAuth` staff list (no separate “manager/HR” Nest role — those may be permission modules only).
- Password reset / MFA: not first-class in the inspected Auth pages.
- Sessions: Supabase JWT in `Authorization` for Nest.

---

## 11. Deployment findings

| Channel | Status |
|---------|--------|
| Railway Docker | Primary for Nest + combined web |
| Cloudflare Wrangler | Config present; path mismatch vs staff `outDir` |
| Lovable | Still in runbooks; **must be frozen/disconnected** |
| Custom domains | Spec: `phindu.com`, `office.phindu.com`, native app; trial uses `*.up.railway.app` |
| Env | `.env.example` is decent; production must set `VITE_API_URL`, Supabase URL/anon, Nest `DATABASE_URL` + service role |

**Today’s ops blockers (cannot be done from git alone):**

1. Redeploy Nest **api**, then **staff-web**, with `VITE_API_URL` pointing at the public API.
2. Redeploy Supabase Edge `send-otp` / `verify-otp`.
3. Disconnect Lovable from production publish.
4. UAT one house: staff login → apply → approve → disburse → repayment.

---

## 12. Recommended migration plan (do not rewrite first)

Aligned with “do not destroy useful functionality” and “submit today”:

| Phase | What | Today? |
|-------|------|--------|
| **0** | This audit | Done |
| **0b Ops** | Redeploy + freeze Lovable + UAT core money path | **Yes — critical** |
| **1 Cleanup** | Remove unused Lovable npm packages, docs/copy that point at Lovable secrets, Dockerfile default keys, leftover `src/` client if unused | Small, safe |
| **2** | Finish remaining browser writes (house workflow, borrower contract, notes) | Next code |
| **3** | Do **not** switch to Next.js this week. Optional later for marketing SSR only |
| **4** | Shared domain package + decimal engine + tests | After UAT |
| **5** | Expo RN borrower (new app, reuse domain package) | Dedicated project |
| **6–8** | Notifications (drop Lovable AI), reports polish, AI without Lovable gateway | After P1 |
| **9–12** | Expand tests, RLS probe, security pass, domains, final UAT | Ongoing |

**Architecture recommendation:** Stay on **Vite ERP + Nest + Supabase**. Add Expo later as `apps/borrower`. Do not create Railway Postgres. Do not replace RLS with “frontend role checks.”

---

## 13. Critical blockers (P0)

1. Production still depends on **ops**: Railway env, Edge OTP, Lovable freeze.  
2. **House dual-write** can still hit RLS or skip Nest.  
3. **Borrower app is not Expo native.** Capacitor WebView ≠ spec.  
4. **Lovable AI gateway** will die with Lovable.  
5. **Financial float math** is a known integrity risk (not proven broken on current book).  
6. **No live E2E** in this audit — cannot certify “repayment reduces balance” on production.

---

## 14. Production risks

- Lovable republish reverting Nest writers.  
- Staff using house screens that still write from the browser.  
- CRB mocks treated as real.  
- Combined Railway URL confusing staff vs borrower login.  
- Migration pack applied twice on Supabase.  
- `apps/api-next` accidentally used instead of Nest.  
- Claiming Next.js/Expo done while the repo is still Vite/Capacitor.

---

## Search appendix (requested strings)

| Search | Result |
|--------|--------|
| `lovable` / `lovable.dev` / `lovable.cloud` | Docs, Edge AI URL, UI copy, dead npm packages |
| Hardcoded Supabase URL/anon | **Dockerfile ARG defaults** (project `yqrfheavftgybhcafzpt`) |
| Mock CRB/guarantee | Edge functions when keys absent |
| TODO/FIXME/Coming soon | AI agents badge, Install store badges, CRB mock comments |
| Frontend-only auth | `usePermissions` admin bypass; Nest + RLS are the real gates for API |
| Duplicate calculations | TS + SQL + Nest schedule |
| Dead client | Root `src/integrations/supabase`; unused Lovable packages |

---

## What to preserve vs rebuild

**Preserve:** Entire staff ERP UX, house model, shared calculations (until decimal rewrite), Supabase schema/RPCs, Nest strangler, Capacitor as interim borrower delivery, Tailwind identity.

**Rebuild later (not today):** Expo native borrower; optional Next.js marketing; Lovable-free AI; decimal engine; unified schedule.

**Must rebuild/remove soon:** Lovable AI functions; house client money writes; dead Lovable npm; Dockerfile baked anon defaults; ops docs that say “paste in Lovable.”

---

## Phase 0 complete — next action

Do **not** start a Next.js/Expo rewrite in the next coding session unless you explicitly accept losing weeks of LMS work.

**Next coding session (Phase 1 cleanup + remaining P1 writes):** remove unused Lovable packages, stop house dual-write, point remaining loan mutations at Nest.

**Next human/ops session:** Railway redeploy, Edge OTP, freeze Lovable, one-house UAT.

This document does **not** claim zero bugs. It claims: the repo is a real LMS mid-strangler, not a demo, and the spec’s target stack is a **future** architecture, not the current one.
