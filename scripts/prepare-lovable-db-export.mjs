#!/usr/bin/env node
/**
 * Validate and stage a Lovable "Export data" .zip (contains a .backup pg_dump).
 *
 * Usage:
 *   node scripts/prepare-lovable-db-export.mjs "C:\Users\...\bucket-database_export_....zip"
 *   node scripts/prepare-lovable-db-export.mjs --backup .data-cutover/loan-kindly-flow_261008.backup
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingDir = path.join(repoRoot, ".data-cutover");

function usage() {
  console.log(`Usage:
  node scripts/prepare-lovable-db-export.mjs <export.zip>
  node scripts/prepare-lovable-db-export.mjs --backup <path-to.backup>`);
}

function ensureStaging() {
  fs.mkdirSync(stagingDir, { recursive: true });
}

function isPgDumpCustom(filePath) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(5);
  fs.readSync(fd, buf, 0, 5, 0);
  fs.closeSync(fd);
  return buf.toString("ascii") === "PGDMP";
}

function extractZip(zipPath) {
  ensureStaging();
  const ps = `Expand-Archive -LiteralPath ${JSON.stringify(zipPath)} -DestinationPath ${JSON.stringify(stagingDir)} -Force`;
  execSync(`powershell -NoProfile -Command ${JSON.stringify(ps)}`, { stdio: "inherit" });
  const backups = fs
    .readdirSync(stagingDir)
    .filter((f) => f.endsWith(".backup"))
    .map((f) => path.join(stagingDir, f));
  if (backups.length === 0) {
    throw new Error(`No .backup file found under ${stagingDir} after extract.`);
  }
  return backups[0];
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
    process.exit(1);
  }

  let backupPath;
  if (args[0] === "--backup") {
    backupPath = path.resolve(args[1] ?? "");
  } else {
    const zipPath = path.resolve(args[0]);
    if (!fs.existsSync(zipPath)) {
      console.error("File not found:", zipPath);
      process.exit(1);
    }
    console.log("Extracting", zipPath, "→", stagingDir);
    backupPath = extractZip(zipPath);
  }

  if (!fs.existsSync(backupPath)) {
    console.error("Backup not found:", backupPath);
    process.exit(1);
  }
  if (!isPgDumpCustom(backupPath)) {
    console.error("Not a PostgreSQL custom-format dump (expected PGDMP header):", backupPath);
    process.exit(1);
  }

  const stat = fs.statSync(backupPath);
  console.log("\nOK — staged PostgreSQL custom dump:");
  console.log("  Path:", backupPath);
  console.log("  Size:", (stat.size / (1024 * 1024)).toFixed(2), "MB");
  console.log("\nNext: install PostgreSQL client tools and run pg_restore -l on this file.");
  console.log("See docs/RESTORE_LOVABLE_DB_EXPORT.md");
}

main();
