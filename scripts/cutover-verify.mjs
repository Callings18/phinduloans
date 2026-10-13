#!/usr/bin/env node
/**
 * Quick seobil cutover health check (requires .env.cutover.local DATABASE_URL).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const psql = path.join(repoRoot, ".tools", "pg-tar", "pgsql", "bin", "psql.exe");

function loadCutoverEnv() {
  const f = path.join(repoRoot, ".env.cutover.local");
  if (!existsSync(f)) throw new Error("Missing .env.cutover.local");
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

const SQL = `
SELECT
  (SELECT count(*) FROM auth.users) AS auth_users,
  (SELECT count(*) FROM public.profiles) AS profiles,
  (SELECT count(*) FROM public.loan_applications) AS loan_applications,
  (SELECT count(*) FROM public.loan_repayments) AS loan_repayments,
  (SELECT count(*) FROM public.disbursements) AS disbursements,
  (SELECT count(*) FROM public.loan_products) AS loan_products,
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'loan-documents') AS loan_documents_objects,
  (SELECT count(*)
   FROM public.loan_applications la
   JOIN public.loan_products lp ON lp.id = la.loan_product_id
   WHERE lp.product_code = 'SALARY_ADVANCE') AS salary_advance_loans,
  (SELECT count(*) FROM public.employees) AS employees,
  (SELECT count(*) FROM public.court_cases) AS court_cases;
`;

function main() {
  loadCutoverEnv();
  if (!existsSync(psql)) throw new Error("Missing psql under .tools/pg-tar");
  const r = spawnSync(psql, [process.env.DATABASE_URL, "-c", SQL], {
    stdio: "inherit",
    env: process.env,
  });
  spawnSync(
    psql,
    [
      process.env.DATABASE_URL,
      "-c",
      `SELECT t.tgname FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'loan_applications' AND NOT t.tgisinternal;`,
    ],
    { stdio: "inherit", env: process.env },
  );
  process.exit(r.status ?? 1);
}

main();
