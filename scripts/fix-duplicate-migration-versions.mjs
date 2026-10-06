#!/usr/bin/env node
/** Give each migration a unique version prefix (YYYYMMDDHHMMSS) when day-only names collide. */
import fs from "fs";
import path from "path";

const dir = path.resolve("supabase/migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const groups = {};
for (const f of files) {
  const m = f.match(/^(\d{8})_/);
  if (!m) continue;
  const day = m[1];
  if (f.match(new RegExp(`^${day}_\\d{6}_`))) continue;
  (groups[day] = groups[day] || []).push(f);
}

let n = 0;
for (const [day, list] of Object.entries(groups)) {
  if (list.length < 2) continue;
  list.sort();
  list.forEach((f, i) => {
    const suffix = f.slice(day.length + 1);
    const newName = `${day}${String(120001 + i).padStart(6, "0")}_${suffix}`;
    const from = path.join(dir, f);
    const to = path.join(dir, newName);
    if (fs.existsSync(to)) return;
    fs.renameSync(from, to);
    console.log(`${f} -> ${newName}`);
    n++;
  });
}

const legacy = path.join(dir, "2026_01_03_loan_engine_enhancements.sql");
if (fs.existsSync(legacy)) {
  const newName = "20260103120000_loan_engine_enhancements.sql";
  fs.renameSync(legacy, path.join(dir, newName));
  console.log(`2026_01_03_loan_engine_enhancements.sql -> ${newName}`);
  n++;
}

console.log(`Renamed ${n} file(s).`);
