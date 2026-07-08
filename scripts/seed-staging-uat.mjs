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
 *   SEED_BORROWER_COUNT=100   (default 100)
 *   SEED_STAFF_COUNT=20       (default 20)
 *   SEED_FORCE=1              (re-run even if marker exists; does not delete prior users)
 *   STAGING_SEED_ALLOW_PROD=1 (override production URL block — use with extreme care)
 *
 * Idempotency: writes system_settings key `phase4_uat_seed` after first successful run.
 * Skips when marker exists unless SEED_FORCE=1.
 *
 * Usage:
 *   STAGING_SEED_CONFIRM=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-staging-uat.mjs
 */
import { createClient } from "@supabase/supabase-js";

const MARKER_KEY = "phase4_uat_seed";
const MARKER_VERSION = "phase4_uat_v1";
const BORROWER_PREFIX = "uat-borrower";
const STAFF_PREFIX = "uat-staff";
const DEFAULT_PASSWORD = "PhinduUat!2026";

const url = process.env.SUPABASE_URL || process.env.E2E_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const borrowerCount = Number(process.env.SEED_BORROWER_COUNT || 100);
const staffCount = Number(process.env.SEED_STAFF_COUNT || 20);
const force = process.env.SEED_FORCE === "1";
const confirm = process.env.STAGING_SEED_CONFIRM === "1";
const allowProd = process.env.STAGING_SEED_ALLOW_PROD === "1";

const STAFF_ROLES = [
  "loan_officer",
  "finance_officer",
  "credit_officer",
  "collections_officer",
  "loan_officer",
  "finance_officer",
];

function fail(msg) {
  console.error(`[seed-staging-uat] ERROR: ${msg}`);
  process.exit(1);
}

function assertNotProduction(projectUrl) {
  if (allowProd) return;
  const host = new URL(projectUrl).hostname.toLowerCase();
  const looksStaging =
    /staging|uat|test|dev|preview|local|127\.0\.0\.1/.test(host) ||
    host.includes("localhost");
  const looksProd =
    /prod|production|live/.test(host) && !looksStaging;
  if (looksProd) {
    fail(
      `URL "${host}" looks like production. Set STAGING_SEED_ALLOW_PROD=1 only if you are certain.`,
    );
  }
}

if (!confirm) {
  fail("Set STAGING_SEED_CONFIRM=1 to run this script.");
}
if (!url || !serviceKey) {
  fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or E2E_* equivalents) are required.");
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
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

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

  await admin
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

  if (staffRole) {
    await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: staffRole }, { onConflict: "user_id,role" });
  }

  return userId;
}

async function grantProductAccess(userId, productCodes) {
  for (const product_code of productCodes) {
    await admin.from("user_product_access").upsert(
      { user_id: userId, product_code, is_active: true },
      { onConflict: "user_id,product_code" },
    );
  }
}

async function main() {
  console.log(`[seed-staging-uat] Target: ${borrowerCount} borrowers, ${staffCount} staff`);

  const marker = await getMarker();
  if (marker?.version === MARKER_VERSION && !force) {
    console.log(
      `[seed-staging-uat] Marker exists (${marker.seeded_at}). Set SEED_FORCE=1 to add more users.`,
    );
    return;
  }

  const { data: products, error: prodErr } = await admin
    .from("loan_products")
    .select("product_code")
    .eq("is_active", true);
  if (prodErr) fail(`loan_products: ${prodErr.message}`);
  const productCodes = (products ?? []).map((p) => p.product_code).filter(Boolean);
  console.log(`[seed-staging-uat] Active products: ${productCodes.length}`);

  let borrowersCreated = 0;
  let staffCreated = 0;

  for (let i = 1; i <= borrowerCount; i++) {
    const email = `${BORROWER_PREFIX}-${String(i).padStart(4, "0")}@phindu-staging.test`;
    const phone = `+26097${String(1000000 + i).slice(-7)}`;
    const nrc = `${String(200000 + i).padStart(6, "0")}/10/1`;
    try {
      await ensureUser({
        email,
        password: DEFAULT_PASSWORD,
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
    const email = `${STAFF_PREFIX}-${String(i).padStart(2, "0")}@phindu-staging.test`;
    const phone = `+26096${String(1000000 + i).slice(-7)}`;
    const nrc = `${String(300000 + i).padStart(6, "0")}/10/1`;
    const staffRole = STAFF_ROLES[(i - 1) % STAFF_ROLES.length];
    try {
      const userId = await ensureUser({
        email,
        password: DEFAULT_PASSWORD,
        fullName: `UAT Staff ${staffRole} ${i}`,
        phone,
        nrc,
        staffRole,
      });
      if (productCodes.length > 0) {
        await grantProductAccess(userId, productCodes);
      }
      staffCreated++;
    } catch (e) {
      console.warn(`  skip staff ${i}: ${e.message}`);
    }
  }

  await writeMarker({ borrowers_created: borrowersCreated, staff_created: staffCreated });
  console.log(
    `[seed-staging-uat] Done. borrowers=${borrowersCreated} staff=${staffCreated}. Default password: ${DEFAULT_PASSWORD}`,
  );
  console.log(
    `[seed-staging-uat] Wire Playwright: E2E_BORROWER_EMAIL=${BORROWER_PREFIX}-0001@phindu-staging.test`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
