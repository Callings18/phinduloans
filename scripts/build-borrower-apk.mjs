#!/usr/bin/env node
/**
 * Build debug/release APK and copy to public/downloads for website hosting.
 * Requires Android SDK + apps/borrower-mobile/android (run prepare-borrower-android first).
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "apps/borrower-mobile");
const androidDir = path.join(appDir, "android");
const outDir = path.join(appDir, "public/downloads");
const variant = process.env.APK_VARIANT === "release" ? "Release" : "Debug";
const gradleTask =
  variant === "Release" ? "assembleRelease" : "assembleDebug";
const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

if (!existsSync(androidDir)) {
  console.error("No android/ project. Run: npm run prepare:borrower:android");
  process.exit(1);
}

execSync("npm run build:borrower", { stdio: "inherit", cwd: root, env: process.env });

if (process.env.CAPACITOR_BUNDLE_LOCAL !== "1") {
  process.env.CAPACITOR_SERVER_URL ??= "https://app.phindu.com";
}

execSync("npx cap sync android", { stdio: "inherit", cwd: appDir, env: process.env });

execSync(`${gradle} ${gradleTask}`, {
  stdio: "inherit",
  cwd: androidDir,
  env: process.env,
});

const apkName = variant === "Release" ? "app-release-unsigned.apk" : "app-debug.apk";
const builtApk = path.join(
  androidDir,
  "app/build/outputs/apk",
  variant.toLowerCase(),
  apkName,
);

if (!existsSync(builtApk)) {
  console.error(`APK not found at ${builtApk}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const dest = path.join(outDir, "PhinduCredit.apk");
copyFileSync(builtApk, dest);
console.log(`\nCopied → ${dest}\nRun: npm run deploy:borrower:full`);
