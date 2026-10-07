#!/usr/bin/env node
/**
 * Preview or purge active/disbursed loans for fixed borrower names (production cleanup).
 *
 * Env: DATABASE_URL or SUPABASE_ACCESS_TOKEN (+ optional SUPABASE_PROJECT_REF)
 *
 *   node scripts/purge-named-active-loans.mjs preview
 *   node scripts/purge-named-active-loans.mjs purge
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] || "preview";
const sqlFile = path.join(
  __dirname,
  "../supabase/scripts/purge_active_loans_by_names_20261007.sql",
);
const fullSql = fs.readFileSync(sqlFile, "utf8");

const previewSql = fullSql.split("-- ========== STEP 2: PURGE ==========")[0];
const purgeSql = fullSql.split("-- ========== STEP 2: PURGE ==========")[1]?.split(
  "-- ========== STEP 3: VERIFY ==========",
)[0];
const verifySql =
  "-- ========== STEP 3: VERIFY ==========" +
  fullSql.split("-- ========== STEP 3: VERIFY ==========")[1];

async function runQuery(sql) {
  if (process.env.DATABASE_URL) {
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const res = await client.query(sql);
    await client.end();
    return res;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    process.env.VITE_SUPABASE_PROJECT_ID ||
    "seobilifwyxhtjvsgqpc";

  if (!token) {
    console.error(
      "Set DATABASE_URL (postgres connection string) or SUPABASE_ACCESS_TOKEN to run against production.",
    );
    process.exit(1);
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await res.text();
  if (!res.ok) {
    console.error("Query failed", res.status, body);
    process.exit(1);
  }
  return JSON.parse(body);
}

function printRows(label, result) {
  console.log("\n" + label);
  const rows = result?.rows ?? result;
  if (Array.isArray(rows)) {
    console.table(rows);
    return;
  }
  console.log(typeof rows === "string" ? rows : JSON.stringify(rows, null, 2));
}

if (mode === "preview") {
  const r = await runQuery(previewSql);
  printRows("Loans to purge (active/disbursed):", r);
  process.exit(0);
}

if (mode === "purge") {
  console.log("Purging…");
  await runQuery(purgeSql);
  const r = await runQuery(verifySql);
  printRows("Verify remaining:", r);
  console.log("\nDone.");
  process.exit(0);
}

console.error("Usage: node scripts/purge-named-active-loans.mjs preview|purge");
process.exit(1);
