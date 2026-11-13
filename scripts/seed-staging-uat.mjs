#!/usr/bin/env node
/**
 * Phase 4 staging UAT seed — creates N borrower profiles + M staff role assignments.
 *
 * Required env:
 *   SUPABASE_URL              (or E2E_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or E2E_SUPABASE_SERVICE_ROLE_KEY)
 *   STAGING_SEED_CONFIRM=1    (explicit opt-in — never run accidentally)
 *
 * Optional:
 *   SEED_BORROWER_COUNT=5 (default 5)
 *   SEED_STAFF_COUNT=5     (default 5)
 *
 * Idempotency: upserts the same synthetic users and retains the staging funding balance
 * on every run so earlier UAT ledger entries remain reconciled.
 *
 * Usage:
 *   STAGING_SEED_CONFIRM=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-staging-uat.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { appendFile } from "node:fs/promises";

const MARKER_KEY = "phase4_uat_seed";
const MARKER_VERSION = "phase4_uat_v1";
const BORROWER_PREFIX = "uat-borrower";
const STAFF_PREFIX = "uat-staff";
const seedPassword = process.env.STAGING_SEED_PASSWORD;

const url = process.env.SUPABASE_URL || process.env.E2E_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const borrowerCount = Number(process.env.SEED_BORROWER_COUNT || 5);
const staffCount = Number(process.env.SEED_STAFF_COUNT || 5);
const confirm = process.env.STAGING_SEED_CONFIRM === "1";

const STAFF_ROLES = [
  "admin",
  "loan_officer",
  "finance_officer",
  "credit_officer",
  "collections_officer",
  "loan_officer",
  "finance_officer",
];

const PRODUCTION_PROJECT_REFS = new Set([
  "seobilifwyxhtjvsgqpc",
  "yqrfheavftgybhcafzpt",
]);

function fail(msg) {
  console.error(`[seed-staging-uat] ERROR: ${msg}`);
  process.exit(1);
}

function assertNotProduction(projectUrl) {
  const host = new URL(projectUrl).hostname.toLowerCase();
  const projectRef = host.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (
    (projectRef && PRODUCTION_PROJECT_REFS.has(projectRef)) ||
    /(^|[-.])(prod|production|live)([-.]|$)/.test(host)
  ) {
    fail(
      `URL "${host}" is a Phindu production target. Staging seed refuses production projects.`,
    );
  }
}

if (!confirm) {
  fail("Set STAGING_SEED_CONFIRM=1 to run this script.");
}
if (!url || !serviceKey) {
  fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or E2E_* equivalents) are required.");
}
if (!seedPassword) {
  fail("STAGING_SEED_PASSWORD is required; UAT credentials must not be hard-coded or printed.");
}
assertNotProduction(url);

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getMarker() {
  const { data, error } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", MARKER_KEY)
    .maybeSingle();
  if (error) {
    console.warn(`[seed-staging-uat] Could not read marker (${error.message}); continuing.`);
    return null;
  }
  return data?.value ?? null;
}

async function writeMarker(stats) {
  const payload = {
    version: MARKER_VERSION,
    seeded_at: new Date().toISOString(),
    borrower_target: borrowerCount,
    staff_target: staffCount,
    ...stats,
  };
  const { error } = await admin.from("system_settings").upsert(
    {
      key: MARKER_KEY,
      value: payload,
      description: "Phase 4 UAT seed marker — do not run seed script on prod without review",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) console.warn(`[seed-staging-uat] Marker write failed: ${error.message}`);
}

async function ensureUser({ email, password, fullName, phone, nrc, staffRole }) {
  const { data: existing, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profileLookupError) throw new Error(`profile lookup ${email}: ${profileLookupError.message}`);

  let userId = existing?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) {
      if (error.message?.includes("already been registered")) {
        const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const found = users?.users?.find((u) => u.email === email);
        userId = found?.id;
      } else {
        throw new Error(`createUser ${email}: ${error.message}`);
      }
    } else {
      userId = data.user.id;
    }
  }

  if (!userId) throw new Error(`Could not resolve user id for ${email}`);

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        phone,
        nrc_number: nrc,
        city: "Lusaka",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (profileError) throw new Error(`profile ${email}: ${profileError.message}`);

  if (staffRole) {
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: staffRole }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(`role ${email}: ${roleError.message}`);
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authUpdateError) throw new Error(`updateUser ${email}: ${authUpdateError.message}`);

  return userId;
}

async function writeGithubEnvironment(name, value) {
  if (!process.env.GITHUB_ENV) return;
  await appendFile(process.env.GITHUB_ENV, `${name}=${value}\n`, "utf8");
}

async function grantProductAccess(userId, productCodes) {
  for (const product_code of productCodes) {
    const { error } = await admin.from("user_product_access").upsert(
      { user_id: userId, product_code, is_active: true },
      { onConflict: "user_id,product_code" },
    );
    if (error) throw new Error(`product access ${product_code}: ${error.message}`);
  }
}

async function ensureFundingAccount() {
  const accountName = "UAT Staging Funding";
  const { data: existing, error: lookupError } = await admin
    .from("accounts")
    .select("id")
    .eq("account_name", accountName)
    .maybeSingle();
  if (lookupError) fail(`funding account lookup: ${lookupError.message}`);

  let accountId = existing?.id;
  const funding = {
    account_name: accountName,
    account_type: "bank",
    currency: "ZMW",
    is_active: true,
    is_protected: false,
    notes: "Synthetic staging-only funding account for automated UAT.",
    updated_at: new Date().toISOString(),
  };
  if (accountId) {
    const { error } = await admin.from("accounts").update(funding).eq("id", accountId);
    if (error) fail(`funding account update: ${error.message}`);
  } else {
    const { data, error } = await admin
      .from("accounts")
      .insert({ ...funding, balance: 1_000_000 })
      .select("id")
      .single();
    if (error) fail(`funding account create: ${error.message}`);
    accountId = data.id;
  }
  await writeGithubEnvironment("E2E_FUNDING_ACCOUNT_ID", accountId);
}

async function main() {
  console.log(`[seed-staging-uat] Target: ${borrowerCount} borrowers, ${staffCount} staff`);

  const marker = await getMarker();
  if (marker?.version === MARKER_VERSION) {
    console.log(`[seed-staging-uat] Existing seed marker found; reconciling UAT accounts idempotently.`);
  }

  const { data: products, error: prodErr } = await admin
    .from("loan_products")
    .select("product_code")
    .eq("is_active", true);
  if (prodErr) fail(`loan_products: ${prodErr.message}`);
  const productCodes = (products ?? []).map((p) => p.product_code).filter(Boolean);
  console.log(`[seed-staging-uat] Active products: ${productCodes.length}`);
  await ensureFundingAccount();

  let borrowersCreated = 0;
  let staffCreated = 0;

  for (let i = 1; i <= borrowerCount; i++) {
    const email = `${BORROWER_PREFIX}-${String(i).padStart(4, "0")}@phindu-staging.test`;
    const phone = `+26097${String(1000000 + i).slice(-7)}`;
    const nrc = `${String(200000 + i).padStart(6, "0")}/10/1`;
    try {
      await ensureUser({
        email,
        password: seedPassword,
        fullName: `UAT Borrower ${i}`,
        phone,
        nrc,
        staffRole: null,
      });
      borrowersCreated++;
      if (i % 25 === 0) console.log(`  borrowers: ${i}/${borrowerCount}`);
    } catch (e) {
      console.warn(`  skip borrower ${i}: ${e.message}`);
    }
  }

  for (let i = 1; i <= staffCount; i++) {
    const email = `${STAFF_PREFIX}-${String(i).padStart(4, "0")}@phindu-staging.test`;
    const phone = `+26096${String(1000000 + i).slice(-7)}`;
    const nrc = `${String(300000 + i).padStart(6, "0")}/10/1`;
    const staffRole = STAFF_ROLES[(i - 1) % STAFF_ROLES.length];
    try {
      const userId = await ensureUser({
        email,
        password: seedPassword,
        fullName: `UAT Staff ${staffRole} ${i}`,
        phone,
        nrc,
        staffRole,
      });
      if (productCodes.length > 0) {
        await grantProductAccess(userId, productCodes);
      }
      if (staffRole === "admin") {
        await writeGithubEnvironment("E2E_STAFF_USER_ID", userId);
      }
      staffCreated++;
    } catch (e) {
      console.warn(`  skip staff ${i}: ${e.message}`);
    }
  }

  if (borrowersCreated !== borrowerCount || staffCreated !== staffCount) {
    fail(`Only seeded ${borrowersCreated}/${borrowerCount} borrowers and ${staffCreated}/${staffCount} staff users; fix seed errors before running UAT.`);
  }

  await writeMarker({ borrowers_created: borrowersCreated, staff_created: staffCreated });
  console.log(`[seed-staging-uat] Done. borrowers=${borrowersCreated} staff=${staffCreated}.`);
  console.log(
    `[seed-staging-uat] Wire Playwright: E2E_BORROWER_EMAIL=${BORROWER_PREFIX}-0001@phindu-staging.test`,
  );
  console.log(`[seed-staging-uat] Finance login: ${STAFF_PREFIX}-0003@phindu-staging.test`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
