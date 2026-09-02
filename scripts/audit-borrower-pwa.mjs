import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const borrowerManifestPath = path.join(root, "apps/borrower-mobile/public/manifest.json");
const borrowerSwPath = path.join(root, "apps/borrower-mobile/public/service-worker.js");
const borrowerMainPath = path.join(root, "apps/borrower-mobile/src/main.tsx");
const borrowerAppPath = path.join(root, "apps/borrower-mobile/src/App.tsx");
const staffIndexPath = path.join(root, "apps/staff-web/index.html");

expect(existsSync(borrowerManifestPath), "Missing borrower manifest: apps/borrower-mobile/public/manifest.json");
expect(existsSync(borrowerSwPath), "Missing borrower service worker: apps/borrower-mobile/public/service-worker.js");

if (existsSync(borrowerManifestPath)) {
  const manifest = JSON.parse(readFileSync(borrowerManifestPath, "utf8"));
  expect(manifest.display === "standalone", "Borrower manifest display should be standalone.");
  expect(Array.isArray(manifest.icons) && manifest.icons.length > 0, "Borrower manifest must define icons.");
  expect(typeof manifest.id === "string" && manifest.id.includes("app.phindu.com"), "Borrower manifest id should target app.phindu.com.");
  expect(!JSON.stringify(manifest.shortcuts || []).includes("/calculator"), "Borrower manifest should not include calculator shortcut.");
}

const borrowerMain = readFileSync(borrowerMainPath, "utf8");
expect(
  borrowerMain.includes('register("/service-worker.js")') || borrowerMain.includes("register('/service-worker.js')"),
  "Borrower app should register service-worker.js in main.tsx.",
);

const borrowerApp = readFileSync(borrowerAppPath, "utf8");
expect(borrowerApp.includes("BorrowerInstallNudge") || borrowerApp.includes("PWAInstallPrompt"), "Borrower app should mount soft install nudge.");
expect(!borrowerApp.includes("BorrowerInstallGate"), "Borrower app should not hard-block web with BorrowerInstallGate (web-first).");
expect(borrowerApp.includes('path="/install"'), "Borrower app should expose /install for APK/PWA options.");
expect(borrowerApp.includes('path="/dashboard"'), "Borrower app should expose /dashboard for web-first access.");

const staffIndex = readFileSync(staffIndexPath, "utf8");
expect(!staffIndex.includes('rel="manifest"'), "Staff index must not include a web manifest link.");

if (failures.length > 0) {
  console.error("Borrower PWA audit failed:");
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log("Borrower PWA audit checks passed.");
