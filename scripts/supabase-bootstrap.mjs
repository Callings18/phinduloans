#!/usr/bin/env node
/**
 * Bootstrap owned Supabase (link, migrations, edge functions).
 *
 * Prerequisites:
 *   npx supabase login
 *   supabase link --project-ref seobilifwyxhtjvsgqpc
 *
 * Usage:
 *   node scripts/supabase-bootstrap.mjs
 *   node scripts/supabase-bootstrap.mjs --functions-only
 */
import { execSync } from "node:child_process";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "seobilifwyxhtjvsgqpc";
const functionsOnly = process.argv.includes("--functions-only");

const run = (cmd) => {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", env: { ...process.env, SUPABASE_PROJECT_REF: PROJECT_REF } });
};

if (!functionsOnly) {
  run(`npx supabase link --project-ref ${PROJECT_REF}`);
  run("npx supabase db push --yes");
}

run("npx supabase functions deploy --project-ref " + PROJECT_REF);

console.log(
  `\nDone. Set Edge secrets in Supabase Dashboard → Project Settings → Edge Functions → Secrets.\n` +
    `See docs/EXCITE_SMS_RELOAD.md and docs/ENTERPRISE_HOSTING.md.\n`,
);
