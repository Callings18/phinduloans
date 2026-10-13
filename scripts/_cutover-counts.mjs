import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(repoRoot, ".env.cutover.local");
for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
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

const psql =
  path.join(repoRoot, ".tools", "pg-tar", "pgsql", "bin", "psql.exe");
const dbUrl = process.env.DATABASE_URL;
const sql = `
SELECT
  (SELECT count(*) FROM auth.users) AS auth_users,
  (SELECT count(*) FROM public.profiles) AS profiles,
  (SELECT count(*) FROM public.loan_applications) AS loan_applications,
  (SELECT count(*) FROM public.loan_repayments) AS loan_repayments,
  (SELECT count(*) FROM public.loan_products) AS loan_products;
`;
const r = spawnSync(psql, [dbUrl, "-c", sql], { stdio: "inherit" });
process.exit(r.status ?? 1);
