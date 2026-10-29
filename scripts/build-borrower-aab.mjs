#!/usr/bin/env node
/**
 * Build release AAB for Google Play (signed when ANDROID_KEYSTORE_* env is set).
 * Output: apps/borrower-mobile/android/app/build/outputs/bundle/release/app-release.aab
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "apps/borrower-mobile");
const androidDir = path.join(appDir, "android");
const outDir = path.join(appDir, "dist/play-store");
const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

if (!existsSync(androidDir)) {
  console.error("No android/ project. Run: npm run prepare:borrower:android");
  process.exit(1);
}

execSync("node scripts/configure-android-release-signing.mjs", { stdio: "inherit", cwd: root, env: process.env });

if (process.env.CAPACITOR_BUNDLE_LOCAL !== "1") {
  process.env.CAPACITOR_SERVER_URL ??= "https://app.phindu.com";
}

execSync("npm run build:borrower", { stdio: "inherit", cwd: root, env: process.env });
execSync("npx cap sync android", { stdio: "inherit", cwd: appDir, env: process.env });

execSync(`${gradle} bundleRelease`, {
  stdio: "inherit",
  cwd: androidDir,
  env: process.env,
});

const built = path.join(androidDir, "app/build/outputs/bundle/release/app-release.aab");
if (!existsSync(built)) {
  console.error(`AAB not found at ${built}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const dest = path.join(outDir, "PhinduCredit-release.aab");
copyFileSync(built, dest);
console.log(`\nPlay upload file → ${dest}`);
console.log("Play Console → Create app → Production → Upload AAB");
console.log("Then set VITE_PLAY_STORE_URL and update assetlinks.json SHA-256.\n");
