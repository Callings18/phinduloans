#!/usr/bin/env node
/**
 * Run SQL files against production Postgres via Supabase Management API.
 *
 * Requires (one of):
 *   DATABASE_URL=postgresql://...  (direct psql — add `pg` dependency locally)
 *   SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF=yqrfheavftgybhcafzpt
 *     (token from `npx supabase login` or dashboard; MFA must be satisfied for Lovable projects)
 *
 * Usage:
 *   node scripts/apply-supabase-sql.mjs supabase/scripts/APPLY_PENDING_BORROWER_AND_LOAN_DELETE_20261005.sql
 */
import fs from "fs";
import path from "path";

const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.VITE_SUPABASE_PROJECT_ID ||
  "yqrfheavftgybhcafzpt";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const sqlPath = process.argv[2];

if (!sqlPath) {
  console.error("Usage: node scripts/apply-supabase-sql.mjs <path-to.sql>");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(sqlPath), "utf8");

if (process.env.DATABASE_URL) {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("Install pg: npm i -D pg");
    process.exit(1);
  }
  const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("OK (DATABASE_URL)");
  process.exit(0);
}

if (!token) {
  console.error(
    "Set SUPABASE_ACCESS_TOKEN (run `npx supabase login`) or DATABASE_URL with postgres password.",
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
  console.error("Failed", res.status, body);
  process.exit(1);
}
console.log("OK", body.slice(0, 500));
