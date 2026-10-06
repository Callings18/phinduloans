#!/usr/bin/env node
/**
 * Prepends DROP POLICY / DROP TRIGGER before CREATE statements when missing.
 * Run once after fixing duplicate Lovable-era migrations for clean `supabase db push`.
 */
import fs from "fs";
import path from "path";

const dir = path.resolve("supabase/migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const policyRe =
  /^create policy "([^"]+)"\s*\n\s*on\s+([\w.]+)/gim;
const triggerRe =
  /^CREATE TRIGGER (\w+)\s*\n\s*(?:BEFORE|AFTER)\s+\w+\s+ON\s+([\w.]+)/gm;

let changed = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  let sql = fs.readFileSync(fp, "utf8");
  const orig = sql;

  sql = sql.replace(policyRe, (match, name, table, offset) => {
    const before = sql.slice(Math.max(0, offset - 120), offset);
    if (before.includes(`DROP POLICY IF EXISTS "${name}"`)) return match;
    return `DROP POLICY IF EXISTS "${name}" ON ${table};\n${match}`;
  });

  sql = sql.replace(triggerRe, (match, name, table, offset) => {
    const before = sql.slice(Math.max(0, offset - 120), offset);
    if (before.includes(`DROP TRIGGER IF EXISTS ${name}`)) return match;
    return `DROP TRIGGER IF EXISTS ${name} ON ${table};\n${match}`;
  });

  if (sql !== orig) {
    fs.writeFileSync(fp, sql);
    changed++;
  }
}

console.log(`Updated ${changed} migration file(s).`);
