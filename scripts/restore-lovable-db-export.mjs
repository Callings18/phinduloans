#!/usr/bin/env node
/**
 * Restore Lovable .backup into Phindu Loans (seobil) — data-only for auth, public, storage.
 *
 * Requires:
 *   .data-cutover/loan-kindly-flow_261008.backup
 *   .tools/pg-tar/pgsql/bin/pg_restore.exe (or pg_restore on PATH)
 *   DATABASE_URL in .env.cutover.local or env
 *
 * Usage:
 *   node scripts/restore-lovable-db-export.mjs
 *   node scripts/restore-lovable-db-export.mjs --public-only
 *   node scripts/restore-lovable-db-export.mjs --dry-run
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backup = path.join(repoRoot, ".data-cutover", "loan-kindly-flow_261008.backup");
const pgRestoreDefault = path.join(
  repoRoot,
  ".tools",
  "pg-tar",
  "pgsql",
  "bin",
  "pg_restore.exe",
);

function loadCutoverEnv() {
  const f = path.join(repoRoot, ".env.cutover.local");
  if (!existsSync(f)) return;
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

function findPgRestore() {
  if (existsSync(pgRestoreDefault)) return pgRestoreDefault;
  const which = spawnSync("where", ["pg_restore"], { shell: true, encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim().split(/\r?\n/)[0];
  throw new Error("pg_restore not found. Extract .tools/pg-tar/pgsql/bin from pg-binaries.zip.");
}

function runPgRestore(pgRestore, dbUrl, schemas, dryRun, { replicationRole = false } = {}) {
  const args = [
    "--no-owner",
    "--no-acl",
    "--data-only",
    "--verbose",
    ...schemas.flatMap((s) => ["--schema", s]),
    ...(dryRun ? ["--list"] : ["--dbname", dbUrl]),
    backup,
  ];
  if (dryRun) {
    console.log("[dry-run] would run:", pgRestore, args.filter((a) => a !== backup).join(" "), backup);
    return 0;
  }
  console.log("Restoring schemas:", schemas.join(", "));
  const env = { ...process.env };
  if (replicationRole) {
    // Supabase pooler rejects pg_restore --disable-triggers (system FK triggers).
    // replica role skips user triggers and FK checks for the session.
    env.PGOPTIONS = "-c session_replication_role=replica";
  }
  const r = spawnSync(pgRestore, args, { stdio: "inherit", env });
  return r.status ?? 1;
}

function main() {
  loadCutoverEnv();
  const dryRun = process.argv.includes("--dry-run");
  const publicOnly = process.argv.includes("--public-only");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl && !dryRun) {
    console.error("Set DATABASE_URL in .env.cutover.local");
    process.exit(1);
  }
  if (!existsSync(backup)) {
    console.error("Missing backup:", backup);
    process.exit(1);
  }
  const pgRestore = findPgRestore();
  const order = publicOnly
    ? [["public"], ["storage"]]
    : [["auth"], ["public"], ["storage"]];
  for (const schemas of order) {
    const replicationRole = schemas[0] === "auth" || schemas[0] === "public";
    const code = runPgRestore(pgRestore, dbUrl, schemas, dryRun, { replicationRole });
    if (code !== 0) {
      console.error("pg_restore failed for", schemas.join(","), "exit", code);
      process.exit(code);
    }
  }
  console.log("Restore pass completed.");
}

main();
