#!/usr/bin/env node
/**
 * Ensures PhinduCredit.apk exists before borrower deploy (warn or fail).
 * Usage: node scripts/verify-borrower-apk.mjs [--strict]
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const strict = process.argv.includes("--strict");
const apkPath = path.join(
  process.cwd(),
  "apps/borrower-mobile/public/downloads/PhinduCredit.apk",
);
const distApk = path.join(
  process.cwd(),
  "apps/borrower-mobile/dist/downloads/PhinduCredit.apk",
);

function check(p) {
  if (!existsSync(p)) return null;
  const { size } = statSync(p);
  return size;
}

const publicSize = check(apkPath);
const distSize = check(distApk);

if (!publicSize) {
  const msg =
    "Missing apps/borrower-mobile/public/downloads/PhinduCredit.apk — run npm run build:borrower:apk or copy a release APK there.";
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`WARN: ${msg}`);
  process.exit(0);
}

console.log(
  `Borrower APK OK (${Math.round(publicSize / 1024 / 1024)} MB at public/downloads/PhinduCredit.apk).`,
);
if (distSize && distSize !== publicSize) {
  console.warn(
    "Note: dist/downloads APK differs from public/ — rebuild borrower after updating APK.",
  );
}
