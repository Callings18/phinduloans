#!/usr/bin/env node
/**
 * Adds/syncs Capacitor Android project for Phindu Credit borrower app.
 * Requires: JDK 17+, Android SDK (Android Studio).
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "apps/borrower-mobile");
const androidDir = path.join(appDir, "android");

const run = (cmd, cwd = root) => {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd, env: process.env });
};

run("npm run build:borrower", root);

if (!existsSync(androidDir)) {
  run("npx cap add android", appDir);
} else {
  console.log("Android project already exists — syncing only.");
}

// Production shell loads live PWA (updates without republishing APK). Override with CAPACITOR_BUNDLE_LOCAL=1 to embed dist.
if (process.env.CAPACITOR_BUNDLE_LOCAL === "1") {
  delete process.env.CAPACITOR_SERVER_URL;
} else {
  process.env.CAPACITOR_SERVER_URL ??= "https://app.phindu.com";
}

run("npx cap sync android", appDir);

console.log(`
Next steps (Android Studio or CLI):
  cd apps/borrower-mobile/android
  .\\gradlew.bat assembleDebug          # Windows debug APK
  .\\gradlew.bat assembleRelease         # Release (configure signing in android/)

Copy output to:
  apps/borrower-mobile/public/downloads/PhinduCredit.apk

Then: npm run deploy:borrower:full
`);
