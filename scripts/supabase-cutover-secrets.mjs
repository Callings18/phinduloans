#!/usr/bin/env node
/**
 * Point GitHub Actions at Phindu Loans Supabase (after you have the anon key).
 *
 * Prerequisites:
 *   gh auth login   (or set GH_TOKEN / GITHUB_TOKEN)
 *
 * Env (from Supabase Dashboard → Phindu Loans → Settings → API):
 *   VITE_SUPABASE_URL=https://seobilifwyxhtjvsgqpc.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<anon public key>
 *
 * Usage:
 *   node scripts/supabase-cutover-secrets.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv(envPath);

const url =
  process.env.VITE_SUPABASE_URL?.trim() ||
  "https://seobilifwyxhtjvsgqpc.supabase.co";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!key) {
  console.error(
    "Missing VITE_SUPABASE_PUBLISHABLE_KEY. Copy the anon key from Supabase → Phindu Loans → Settings → API into .env, then rerun.",
  );
  process.exit(1);
}

if (!url.includes("seobilifwyxhtjvsgqpc")) {
  console.error(
    "Refusing to set GitHub secrets: VITE_SUPABASE_URL is not the owned Phindu Loans project.",
  );
  process.exit(1);
}

try {
  execSync("gh auth status", { stdio: "pipe" });
} catch {
  console.error("Run `gh auth login` first (or set GH_TOKEN), then rerun this script.");
  process.exit(1);
}

const repo = process.env.GITHUB_REPOSITORY || "Callings18/phinduloans";

console.log(`Updating Actions secrets on ${repo}…`);
execSync(`gh secret set VITE_SUPABASE_URL -R "${repo}" -b "${url}"`, { stdio: "inherit" });
execSync(`gh secret set VITE_SUPABASE_PUBLISHABLE_KEY -R "${repo}" -b "${key}"`, {
  stdio: "inherit",
});

console.log("\nDone. Trigger deploy: gh workflow run deploy-staff.yml -R " + repo);
console.log("Then purge Cloudflare cache (scripts/purge-phindu-cache.mjs) if needed.\n");
