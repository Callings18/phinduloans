#!/usr/bin/env node
/**
 * Injects release signing into Capacitor android/app/build.gradle when env vars are set.
 * Run after prepare-borrower-android.mjs (CI or local Play upload).
 *
 * Env:
 *   ANDROID_KEYSTORE_PATH — path to .jks or .keystore (or write from ANDROID_KEYSTORE_BASE64)
 *   ANDROID_KEYSTORE_PASSWORD
 *   ANDROID_KEY_ALIAS
 *   ANDROID_KEY_PASSWORD
 *   ANDROID_KEYSTORE_BASE64 — optional; decoded to android/app/phindu-release.keystore
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const androidApp = path.join(root, "apps/borrower-mobile/android/app");
const gradleFile = path.join(androidApp, "build.gradle");

if (!existsSync(gradleFile)) {
  console.error("Missing android/app/build.gradle — run: npm run prepare:borrower:android");
  process.exit(1);
}

let keystorePath = process.env.ANDROID_KEYSTORE_PATH?.trim();
const b64 = process.env.ANDROID_KEYSTORE_BASE64?.trim();

if (b64 && !keystorePath) {
  keystorePath = path.join(androidApp, "phindu-release.keystore");
  writeFileSync(keystorePath, Buffer.from(b64, "base64"));
  console.log("Wrote keystore from ANDROID_KEYSTORE_BASE64");
}

const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD?.trim();
const keyAlias = process.env.ANDROID_KEY_ALIAS?.trim();
const keyPassword = process.env.ANDROID_KEY_PASSWORD?.trim() || storePassword;

if (!keystorePath || !storePassword || !keyAlias) {
  console.log(
    "Skipping release signing injection (set ANDROID_KEYSTORE_* for Play Store AAB). Debug APK still builds unsigned.",
  );
  process.exit(0);
}

const relStore = path.relative(androidApp, path.resolve(keystorePath)).replace(/\\/g, "/");
let gradle = readFileSync(gradleFile, "utf8");

if (gradle.includes("phinduReleaseSigning")) {
  console.log("Release signing already configured in build.gradle");
  process.exit(0);
}

// Capacitor template already has android { buildTypes { release { ... } } }
if (!gradle.includes("signingConfigs")) {
  gradle = gradle.replace(
    /buildTypes\s*\{/,
    `signingConfigs {
        phinduReleaseSigning {
            storeFile file("${relStore}")
            storePassword "${storePassword.replace(/"/g, '\\"')}"
            keyAlias "${keyAlias.replace(/"/g, '\\"')}"
            keyPassword "${(keyPassword || "").replace(/"/g, '\\"')}"
        }
    }
    buildTypes {`,
  );
  gradle = gradle.replace(
    /release\s*\{([^}]*)\}/s,
    (match) => {
      if (match.includes("signingConfig")) return match;
      return match.replace(/\{\s*/, "{\n            signingConfig signingConfigs.phinduReleaseSigning\n            ");
    },
  );
  writeFileSync(gradleFile, gradle, "utf8");
  console.log("Injected phinduReleaseSigning into android/app/build.gradle");
} else {
  console.warn("build.gradle already has signingConfigs — edit manually if release fails.");
}
