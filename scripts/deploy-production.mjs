#!/usr/bin/env node
/**
 * Deploy borrower PWA + staff web (office). Marketing may need a second
 * build with STAFF_SITE_MODE=marketing if it uses a separate Cloudflare project.
 */
import { execSync } from "node:child_process";

const run = (cmd) => {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", env: process.env });
};

run("node scripts/deploy-borrower.mjs");
run("node scripts/deploy-staff.mjs");

if (process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN) {
  try {
    run("node scripts/purge-phindu-cache.mjs");
  } catch {
    console.warn("\nCache purge failed — purge manually in Cloudflare if users see stale JS.\n");
  }
} else {
  console.warn(
    "\nTip: set CLOUDFLARE_API_TOKEN to auto-purge phindu.com cache after deploy.\n",
  );
}

console.log(
  "\nProduction deploy finished. Apply pending SQL: npx supabase db push --yes (project seobilifwyxhtjvsgqpc).\n",
);
