#!/usr/bin/env node
/**
 * Point local .env at Phindu Loans (seobil) using .env.seobil.local.
 * Production: run supabase-cutover-secrets.mjs after gh auth login.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const seobilLocal = path.join(root, ".env.seobil.local");
const envPath = path.join(root, ".env");

if (!existsSync(seobilLocal)) {
  console.error(
    "Create .env.seobil.local from .env.seobil.local.example and paste the seobil anon key from Dashboard → Settings → API.",
  );
  process.exit(1);
}

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map.set(k, v);
  }
  return map;
}

const seobil = parseEnv(readFileSync(seobilLocal, "utf8"));
const url = seobil.get("VITE_SUPABASE_URL") || "";
const key = seobil.get("VITE_SUPABASE_PUBLISHABLE_KEY") || "";
const projectId = seobil.get("VITE_SUPABASE_PROJECT_ID") || "seobilifwyxhtjvsgqpc";

if (!url.includes("seobilifwyxhtjvsgqpc") || !key || key.includes("your-anon")) {
  console.error(".env.seobil.local must set seobil URL and a real VITE_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const keysToSet = {
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PROJECT_ID: projectId,
  VITE_SUPABASE_PUBLISHABLE_KEY: key,
  SUPABASE_URL: seobil.get("SUPABASE_URL") || url,
};

let envText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const lines = envText.split(/\r?\n/);
const seen = new Set();
const out = lines.map((line) => {
  const t = line.trim();
  if (!t || t.startsWith("#")) return line;
  const eq = t.indexOf("=");
  if (eq === -1) return line;
  const k = line.slice(0, line.indexOf("=")).trim();
  if (keysToSet[k] !== undefined) {
    seen.add(k);
    return `${k}="${keysToSet[k]}"`;
  }
  return line;
});

for (const [k, v] of Object.entries(keysToSet)) {
  if (!seen.has(k)) out.push(`${k}="${v}"`);
}

writeFileSync(envPath, out.join("\n").replace(/\n*$/, "\n"), "utf8");
console.log("Updated .env to use Phindu Loans (seobilifwyxhtjvsgqpc).");
console.log("Restart dev servers. For production: gh auth login && node scripts/supabase-cutover-secrets.mjs");
