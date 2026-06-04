# Phindu Loans

Loan management platform for borrower onboarding, underwriting, disbursement, repayments, collections, reporting, and HR/payroll workflows.

## Repository

- **GitHub:** [Callings18/phinduloans](https://github.com/Callings18/phinduloans)
- **Stack:** Vite + React + TypeScript + Tailwind + Supabase

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```sh
git clone https://github.com/Callings18/phinduloans.git
cd phinduloans
npm install
```

### Run

```sh
npm run dev
```

### Quality Checks

```sh
npm run typecheck
npm run lint
npm run build
```

### E2E Smoke

```sh
npm run test:e2e:smoke
```

### E2E Borrower critical path

Requires `E2E_BORROWER_EMAIL` and `E2E_BORROWER_PASSWORD` (non-staff borrower). See [docs/DEV_DEPENDENCIES.md](docs/DEV_DEPENDENCIES.md).

```sh
npm run test:e2e:borrower
```

### PDF / jsPDF installs

See [docs/DEV_DEPENDENCIES.md](docs/DEV_DEPENDENCIES.md) for `jspdf` + `jspdf-autotable` notes and `npm ci` guidance.

## Environment Variables

Use a local `.env` / `.env.local` for runtime configuration. Common optional frontend flags:

- `VITE_API_URL=http://localhost:3001`
- `VITE_API_PHASE1_WORKFLOW=true`
- `VITE_API_LOAN_PRODUCTS=true`
- `VITE_VAPID_PUBLIC_KEY=<public-web-push-key>`
- `VITE_BORROWER_WEB_INSTALL_GATE=true|false`

See:

- `docs/PHASE1_SMOKE_TESTS.md`
- `docs/SCOPE_ADDENDUM_PWA_PHASE.md`
- `supabase/functions/send-web-push/README.md`

## Backend Services In Repo

- **NestJS strangler backend:** `backend/`
- **Next.js workflow API:** `apps/api-next/`

Reference docs:

- `backend/README.md`
- `docs/API_CONTRACTS.md`
- `docs/SUPABASE_AUDIT.md`

## Deployment

Deployments are managed from this GitHub repository branch workflow (and any linked hosting provider). There is no template placeholder setup remaining in this README.

For production readiness and launch checks, review:

- `PROJECT_CHECKLIST_AND_NOTES.md`
- `LAUNCH_READINESS_CHECKLIST.md`

### Loan house deep audit (seven product houses)

- `docs/LOAN_HOUSE_AUDIT_MATRIX.md` — sign-off grid
- `docs/LOAN_HOUSE_STAGING_BASELINE.md` — Phase 0 migrations + catalog SQL
- `docs/LOAN_HOUSE_UAT_RUNBOOK.md` — staging/production golden path
- `docs/LOAN_HOUSE_HEALTH_SQL.md` — data health queries
- `docs/LOAN_HOUSE_INTEGRATION.md` — `npm run test:integration:houses`
- `docs/LOAN_HOUSE_PRODUCTION_ROLLOUT.md` — production rollout
