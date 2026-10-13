#!/usr/bin/env node
/**
 * Restore storage.objects metadata from Lovable .backup (bucket already exists on seobil).
 * Does not copy file bytes — request loan-documents blob migration separately.
 *
 * Usage: node scripts/cutover-restore-storage.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backup = path.join(repoRoot, ".data-cutover", "loan-kindly-flow_261008.backup");
const pgRestore = path.join(repoRoot, ".tools", "pg-tar", "pgsql", "bin", "pg_restore.exe");
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

function run(cmd, args, { allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  const code = r.status ?? 1;
  if (code !== 0 && !allowFail) process.exit(code);
  return code;
}

loadCutoverEnv();
if (!existsSync(backup)) throw new Error("Missing backup");

console.log(">> pg_restore -t objects (storage metadata)");
run(
  pgRestore,
  [
    "--no-owner",
    "--no-acl",
    "--data-only",
    "-t",
    "objects",
    "--schema",
    "storage",
    "--dbname",
    process.env.DATABASE_URL,
    backup,
  ],
  { allowFail: true },
);

run(psql, [
  process.env.DATABASE_URL,
  "-c",
  "SELECT count(*) AS loan_documents_objects FROM storage.objects WHERE bucket_id = 'loan-documents';",
]);

console.log("Done. Copy actual files into seobil loan-documents bucket if not already migrated.");
