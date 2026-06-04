/**
 * Run loan-flow integration test for each product house.
 * Requires E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY, E2E_STAFF_USER_ID.
 */
import { spawnSync } from "node:child_process";

const HOUSES = [
  "COLLATERAL",
  "MARKETEER",
  "PAYDAY_SOFT",
  "SALARY_ADVANCE",
  "SALARY_ADVANCE_STAFF",
  "BUSINESS",
  "MOTOR_VEHICLE",
];

const required = ["E2E_SUPABASE_URL", "E2E_SUPABASE_SERVICE_ROLE_KEY", "E2E_STAFF_USER_ID"];
const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.log(
    `Skipping all-house integration: missing ${missing.join(", ")}. See docs/LOAN_HOUSE_INTEGRATION.md.`,
  );
  process.exit(0);
}

let failed = false;
for (const code of HOUSES) {
  console.log(`\n--- E2E_PRODUCT_CODE=${code} ---\n`);
  const result = spawnSync(
    "npx",
    ["vitest", "run", "tests/integration/loan-flow.full.test.ts"],
    {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, E2E_PRODUCT_CODE: code },
    },
  );
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
