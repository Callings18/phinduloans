# Developer dependencies (install stability)

## jsPDF + jspdf-autotable

The app uses **jsPDF** and **jspdf-autotable** for PDF exports (statements, schedules, reports, payslips, etc.).

- Declared versions in `package.json`: `jspdf` ^3.x and `jspdf-autotable` ^5.x.
- `jspdf-autotable@5` declares a peer dependency on `jspdf` **^2 || ^3**. npm may print a peer warning depending on the resolver; the committed **`package-lock.json`** is the source of truth for CI and local installs.

### Recommended install

```sh
npm ci
```

Use `npm ci` in CI and for clean local setups so installs match the lockfile exactly.

### If install fails or types break

1. Delete `node_modules` and reinstall with `npm ci`.
2. Do not mix `jspdf` v2 app code with v3-only APIs — imports in this repo use the v3 default import pattern (`import jsPDF from "jspdf"`) or `import { jsPDF } from "jspdf"` where noted in individual modules.
3. If upgrading either package, run `npm run build` and exercise one PDF export path (e.g. borrower loan schedule download) before merging.

## Borrower E2E credentials

Borrower Playwright specs require a **non-staff** test user:

- `E2E_BORROWER_EMAIL`
- `E2E_BORROWER_PASSWORD`

Optional: `E2E_BASE_URL` (defaults to `http://127.0.0.1:8080` in `playwright.config.ts`).

Run borrower-only tests:

```sh
npm run test:e2e:borrower
```
