#!/usr/bin/env node
/**
 * One-shot: production build + Cloudflare deploy for app.phindu.com
 * Usage: node scripts/deploy-borrower.mjs
 * Requires: CLOUDFLARE_API_TOKEN env var (or run `npx wrangler login` first)
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

const required = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY,
};

for (const [key, val] of Object.entries(required)) {
  if (!val) {
    console.error(`Missing ${key}. Set it in .env before deploying.`);
    process.exit(1);
  }
  process.env[key] = val;
}

process.env.VITE_BORROWER_APP_URL ??= "https://app.phindu.com";
process.env.VITE_OFFICE_BASE_URL ??= "https://office.phindu.com";
process.env.VITE_MARKETING_BASE_URL ??= "https://phindu.com";

const run = (cmd) => {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", env: process.env, cwd: root });
};

run("npm run build:borrower");
run("npm run audit:pwa");
run("node scripts/verify-borrower-apk.mjs");
if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.CF_API_TOKEN) {
  console.warn(
    "\nSkipping Cloudflare deploy: set CLOUDFLARE_API_TOKEN (or run `npx wrangler login`) then rerun deploy:borrower:full.\n" +
      "Build output is ready at apps/borrower-mobile/dist — upload via Cloudflare dashboard or Lovable if needed.\n",
  );
} else {
  run("npx wrangler@4.110.0 deploy --config wrangler.borrower.jsonc");
  console.log("\nBorrower PWA deployed. Verify https://app.phindu.com/dashboard");
}
