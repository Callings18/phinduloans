#!/usr/bin/env node
/**
 * Ordered public data restore for seobil after `supabase db push`.
 * Skips auth (606 users already loaded). Uses prepare/trigger SQL in repo.
 *
 * Usage: node scripts/cutover-restore-ordered.mjs
 *        node scripts/cutover-restore-ordered.mjs --skip-truncate  (fill pass only)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backup = path.join(repoRoot, ".data-cutover", "loan-kindly-flow_261008.backup");
const pgBin = path.join(repoRoot, ".tools", "pg-tar", "pgsql", "bin");
const psql = path.join(pgBin, "psql.exe");
const pgRestore = path.join(pgBin, "pg_restore.exe");

const PHASE1_TABLES = [
  "loan_products",
  "roles",
  "permissions",
  "employers",
  "accounts",
  "profiles",
  "system_settings",
];

const PHASE2_TABLES = ["loan_applications"];

const PHASE3_TABLES = [
  "loan_repayments",
  "application_documents",
  "user_roles",
  "role_permissions",
];

function loadCutoverEnv() {
  const f = path.join(repoRoot, ".env.cutover.local");
  if (!existsSync(f)) throw new Error("Missing .env.cutover.local with DATABASE_URL");
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

function run(cmd, args, { allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: false });
  const code = r.status ?? 1;
  if (code !== 0 && !allowFail) {
    throw new Error(`${path.basename(cmd)} exited ${code}: ${args.slice(0, 4).join(" ")}…`);
  }
  return code;
}

function psqlFile(rel) {
  const f = path.join(repoRoot, rel);
  console.log("\n>> psql -f", rel);
  run(psql, [process.env.DATABASE_URL, "-f", f]);
}

function dropUserTriggers(table) {
  const sql = `
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname AS name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = '${table}' AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.${table}', r.name);
  END LOOP;
END $$;
`;
  run(psql, [process.env.DATABASE_URL, "-c", sql]);
}

function restoreTables(tables, { allowFail = true } = {}) {
  for (const t of tables) {
    console.log("\n>> pg_restore -t", t);
    run(
      pgRestore,
      ["--no-owner", "--no-acl", "--data-only", "-t", t, "--dbname", process.env.DATABASE_URL, backup],
      { allowFail },
    );
  }
}

function restoreSchemaPublic({ allowFail = true } = {}) {
  console.log("\n>> pg_restore --schema=public (fill pass, errors expected on dupes)");
  run(
    pgRestore,
    ["--no-owner", "--no-acl", "--data-only", "--schema", "public", "--dbname", process.env.DATABASE_URL, backup],
    { allowFail },
  );
}

function counts() {
  const sql = `
SELECT
  (SELECT count(*) FROM auth.users) AS auth_users,
  (SELECT count(*) FROM public.profiles) AS profiles,
  (SELECT count(*) FROM public.loan_applications) AS loan_applications,
  (SELECT count(*) FROM public.loan_repayments) AS loan_repayments,
  (SELECT count(*) FROM public.loan_products) AS loan_products;
`;
  run(psql, [process.env.DATABASE_URL, "-c", sql]);
}

function restoreDisbursementsAndLedger() {
  console.log("\n=== Phase 4: disbursements + ledger (drop idempotency indexes) ===");
  run(psql, [
    process.env.DATABASE_URL,
    "-c",
    "DROP INDEX IF EXISTS public.ux_disbursements_completed_txn_reference; DROP INDEX IF EXISTS public.ux_account_transactions_disbursement_reference;",
  ]);
  dropUserTriggers("disbursements");
  restoreTables(["disbursements", "account_transactions"], { allowFail: true });
  psqlFile("supabase/scripts/restore_disbursements_cutover.sql");
}

function main() {
  loadCutoverEnv();
  if (!existsSync(backup)) throw new Error("Missing backup: " + backup);
  if (!existsSync(pgRestore)) throw new Error("Missing pg_restore under .tools/pg-tar");

  const skipTruncate = process.argv.includes("--skip-truncate");

  console.log("=== Counts (before) ===");
  counts();

  try {
    if (!skipTruncate) {
      psqlFile("supabase/scripts/truncate_public_before_data_restore.sql");
      psqlFile("supabase/scripts/prepare_public_for_data_restore.sql");
    }

    restoreTables(PHASE1_TABLES);
    restoreTables(PHASE2_TABLES, { allowFail: true });
    restoreSchemaPublic({ allowFail: true });

    console.log("\n=== Phase 3: repayments (drop triggers) ===");
    dropUserTriggers("loan_repayments");
    restoreTables(PHASE3_TABLES, { allowFail: true });

    restoreSchemaPublic({ allowFail: true });
    restoreDisbursementsAndLedger();
  } finally {
    psqlFile("supabase/scripts/restore_public_triggers_after_data_restore.sql");
  }

  console.log("\n=== Counts (after) ===");
  counts();
  console.log(
    "\nDone. Export has 73 loan_applications; profiles may be < auth.users until orphan users are expected.",
  );
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
