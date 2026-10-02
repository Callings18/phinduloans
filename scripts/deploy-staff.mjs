#!/usr/bin/env node
/**
 * Build + deploy staff web (office.phindu.com / dual-host worker).
 *
 * Usage:
 *   node scripts/deploy-staff.mjs
 *   STAFF_SITE_MODE=office node scripts/deploy-staff.mjs
 *   STAFF_SITE_MODE=marketing node scripts/deploy-staff.mjs
 *
 * Requires CLOUDFLARE_API_TOKEN (or `npx wrangler login`).
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

const mode = (process.env.STAFF_SITE_MODE || process.env.VITE_SITE_MODE || "").trim().toLowerCase();
if (mode === "office" || mode === "marketing") {
  process.env.VITE_SITE_MODE = mode;
  console.info(`Building staff-web with VITE_SITE_MODE=${mode}`);
} else {
  console.info("Building staff-web dual-host (no VITE_SITE_MODE — hostname routing at runtime).");
  delete process.env.VITE_SITE_MODE;
}

const run = (cmd) => {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", env: process.env, cwd: root });
};

run("npm run build:staff");

if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.CF_API_TOKEN) {
  console.warn(
    "\nSkipping Cloudflare deploy: set CLOUDFLARE_API_TOKEN (or run `npx wrangler login`) then rerun.\n" +
      "Build output is ready at dist/ — deploy with: npm run deploy:staff\n",
  );
} else {
  run("npx wrangler@4.110.0 deploy --config wrangler.staff.jsonc");
  console.log("\nStaff web deployed. Verify https://office.phindu.com/admin/houses/SALARY_ADVANCE");
}
