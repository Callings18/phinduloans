#!/usr/bin/env node
/**
 * Bootstrap the first super_admin on a fresh Supabase project.
 *
 * Required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_SUPER_ADMIN_CONFIRM=1
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD   (min 12 chars; store in a password manager)
 *   SEED_ADMIN_NAME
 *
 * Optional:
 *   SEED_ADMIN_PHONE
 *
 * Usage (PowerShell):
 *   $env:SEED_SUPER_ADMIN_CONFIRM="1"
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *   $env:SEED_ADMIN_EMAIL="you@phindu.com"
 *   $env:SEED_ADMIN_PASSWORD="..."
 *   $env:SEED_ADMIN_NAME="Phindu Super Admin"
 *   node scripts/seed-super-admin.mjs
 */
import { createClient } from "@supabase/supabase-js";

function fail(msg) {
  console.error(`[seed-super-admin] ERROR: ${msg}`);
  process.exit(1);
}

if (process.env.SEED_SUPER_ADMIN_CONFIRM !== "1") {
  fail("Set SEED_SUPER_ADMIN_CONFIRM=1 to run this script.");
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || "";
const fullName = (process.env.SEED_ADMIN_NAME || "").trim();
const phone = (process.env.SEED_ADMIN_PHONE || "").trim() || null;

if (!url || !serviceKey) fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
if (!email || !email.includes("@")) fail("SEED_ADMIN_EMAIL is required.");
if (password.length < 12) fail("SEED_ADMIN_PASSWORD must be at least 12 characters.");
if (!fullName) fail("SEED_ADMIN_NAME is required.");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
if (existing?.id) {
  const { error: roleErr } = await admin.from("user_roles").upsert(
    { user_id: existing.id, role: "super_admin" },
    { onConflict: "user_id,role" },
  );
  if (roleErr) fail(roleErr.message);
  console.log(`[seed-super-admin] Profile already exists (${existing.id}); ensured super_admin role.`);
  process.exit(0);
}

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

if (createError || !created?.user) {
  fail(createError?.message || "auth.admin.createUser failed");
}

const userId = created.user.id;
const { error: profileErr } = await admin.from("profiles").upsert({
  id: userId,
  email,
  full_name: fullName,
  phone,
});
if (profileErr) fail(`profiles upsert: ${profileErr.message}`);

const { error: roleErr } = await admin.from("user_roles").upsert(
  { user_id: userId, role: "super_admin" },
  { onConflict: "user_id,role" },
);
if (roleErr) fail(`user_roles upsert: ${roleErr.message}`);

console.log(`[seed-super-admin] Created super_admin ${email} (${userId}). Sign in on the office site with this email/password.`);
