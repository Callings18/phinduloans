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

console.log("\nProduction deploy scripts finished. Purge Cloudflare cache if users still see old JS chunks.\n");
