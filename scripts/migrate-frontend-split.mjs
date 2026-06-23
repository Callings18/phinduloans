/**
 * Frontend monorepo migration: moves src/ into packages/shared + apps/staff-web + apps/borrower-mobile
 * Run: node scripts/migrate-frontend-split.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const SHARED = path.join(ROOT, "packages", "shared", "src");
const STAFF = path.join(ROOT, "apps", "staff-web", "src");
const BORROWER = path.join(ROOT, "apps", "borrower-mobile", "src");

const SHARED_COMMON = new Set([
  "ErrorBoundary.tsx",
  "PWAInstallPrompt.tsx",
  "ThemeToggle.tsx",
  "NotificationCenter.tsx",
  "SignaturePad.tsx",
  "LoanComparison.tsx",
  "QueryStateView.tsx",
  "DocumentUploader.tsx",
  "LegacyDataFallback.tsx",
]);

const STAFF_COMMON = new Set([
  "BulkActions.tsx",
  "PaginationControls.tsx",
  "GuidedTour.tsx",
  "ResponsiveDataViews.tsx",
  "PhinduAI.tsx",
]);

const BORROWER_COMMON = new Set(["BorrowerInstallGate.tsx", "InstallAppRequired.tsx"]);

const SHARED_HOOKS = new Set([
  "useAuth.tsx",
  "use-toast.ts",
  "use-mobile.tsx",
  "useMediaQuery.ts",
  "usePwaInstallPrompt.ts",
  "useSystemSettings.ts",
  "useFeatureFlags.ts",
  "useProductLoanRules.ts",
]);

const STAFF_HOOKS = new Set([
  "usePermissions.ts",
  "useAdminDashboardStats.ts",
  "useHouseData.ts",
  "useRealtimeInvalidate.ts",
  "useLoanProductModules.ts",
  "useProductAccess.ts",
  "useLoanProductFilter.ts",
  "useLoanReviewChecklist.ts",
  "usePMIC.ts",
]);

const BORROWER_HOOKS = new Set(["useApplicationDraft.ts"]);

const SHARED_LIB = new Set([
  "utils.ts",
  "businessCalendar.ts",
  "disbursementCalendar.ts",
  "marketeerCalculations.ts",
]);

const STAFF_UTILS = new Set([
  "adminHousePaths.ts",
  "houseProfit.ts",
  "payrollCalculations.ts",
  "payrollRunCsvExport.ts",
  "payslipPdfGenerator.ts",
  "generateDemandLetter.ts",
  "generateClearanceCertificate.ts",
  "generatePMICExport.ts",
  "pmicEligibilityCalculator.ts",
  "reportExportEngine.ts",
  "reportQueryGuards.ts",
  "exportBorrowerData.ts",
  "smsService.ts",
  "appDownload.ts",
]);

const BORROWER_UTILS = new Set([
  "borrowerDashboardLinks.ts",
  "borrowerDashboardLinks.test.ts",
  "borrowerUploadValidation.ts",
]);

const SHARED_UTILS = new Set([
  "loanCalculations.ts",
  "loanBalance.ts",
  "paymentAllocation.ts",
  "repaymentRemaining.ts",
  "createRepaymentSchedule.ts",
  "repaymentFrequencyLabels.ts",
  "repaymentFrequencyLabels.test.ts",
  "generateLoanSchedule.ts",
  "generateLoanContract.ts",
  "generateRepaymentReceipt.ts",
  "generateStatement.ts",
  "handlePaymentReceipt.ts",
  "exportLoanScheduleCsv.ts",
  "borrowerPortalIntegration.ts",
  "authHelpers.ts",
  "mapSupabaseError.ts",
  "rpcResult.ts",
  "legacyData.ts",
  "notificationService.ts",
  "sendDirectNotification.ts",
  "pushNotifications.ts",
  "pwaDisplayMode.ts",
  "storageHelpers.ts",
  "errorHandler.ts",
  "auditLog.ts",
  "houseProductPolicySpec.ts",
  "notifyBorrowerPortal.ts",
]);

const STAFF_PAGES = new Set([
  "Index.tsx",
  "About.tsx",
  "Calculator.tsx",
  "Install.tsx",
  "NotFound.tsx",
]);

const BORROWER_PAGES = new Set(["Dashboard.tsx", "Profile.tsx", "Apply.tsx"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function moveFile(src, dest) {
  ensureDir(path.dirname(dest));
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest);
  }
}

function moveDirContents(srcDir, destDir, filter) {
  if (!fs.existsSync(srcDir)) return;
  ensureDir(destDir);
  for (const name of fs.readdirSync(srcDir)) {
    if (filter && !filter(name)) continue;
    moveFile(path.join(srcDir, name), path.join(destDir, name));
  }
}

function moveEntireDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  ensureDir(path.dirname(destDir));
  fs.renameSync(srcDir, destDir);
}

/** Map old @/ paths to new locations after migration */
const IMPORT_REWRITES = [
  // shared package
  [/@\/components\/ui\//g, "@phinduloans/shared/components/ui/"],
  [/@\/components\/common\/(ErrorBoundary|PWAInstallPrompt|ThemeToggle|NotificationCenter|SignaturePad|LoanComparison|QueryStateView|DocumentUploader|LegacyDataFallback)/g,
    "@phinduloans/shared/components/common/$1"],
  [/@\/hooks\/(useAuth|use-toast|use-mobile|useMediaQuery|usePwaInstallPrompt|useSystemSettings|useFeatureFlags|useProductLoanRules)/g,
    "@phinduloans/shared/hooks/$1"],
  [/@\/lib\/(utils|businessCalendar|disbursementCalendar|marketeerCalculations)/g, "@phinduloans/shared/lib/$1"],
  [/@\/integrations\/supabase\//g, "@phinduloans/shared/integrations/supabase/"],
  [/@\/types\//g, "@phinduloans/shared/types/"],
  [/@\/constants\//g, "@phinduloans/shared/constants/"],
  [/@\/config\//g, "@phinduloans/shared/config/"],
  [/@\/services\/repositories\/(loanProductsRepository|workflowRepository)/g,
    "@phinduloans/shared/services/repositories/$1"],
];

const SHARED_UTILS_PATTERNS = [
  "loanCalculations", "loanBalance", "paymentAllocation", "repaymentRemaining",
  "createRepaymentSchedule", "repaymentFrequencyLabels", "generateLoanSchedule",
  "generateLoanContract", "generateRepaymentReceipt", "generateStatement",
  "handlePaymentReceipt", "exportLoanScheduleCsv", "borrowerPortalIntegration",
  "authHelpers", "mapSupabaseError", "rpcResult", "legacyData", "notificationService",
  "sendDirectNotification", "pushNotifications", "pwaDisplayMode", "storageHelpers",
  "errorHandler", "auditLog", "houseProductPolicySpec", "notifyBorrowerPortal",
];

function rewriteImports(content, appRoot) {
  let out = content;
  for (const [re, rep] of IMPORT_REWRITES) {
    out = out.replace(re, rep);
  }
  const utilsRe = new RegExp(
    `@\\/utils\\/(${SHARED_UTILS_PATTERNS.join("|")})`,
    "g"
  );
  out = out.replace(utilsRe, "@phinduloans/shared/utils/$1");
  // Relative imports within same app stay; fix cross-app mistaken paths
  return out;
}

function rewriteSharedInternal(content) {
  return content.replace(/@\//g, "@phinduloans/shared/");
}

function processTsFiles(dir, appRoot, isShared = false) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processTsFiles(full, appRoot, isShared);
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      let raw = fs.readFileSync(full, "utf8");
      if (isShared) raw = rewriteSharedInternal(raw);
      const next = rewriteImports(raw, appRoot);
      if (next !== raw) fs.writeFileSync(full, next);
    }
  }
}

function migrate() {
  console.log("Creating app directories...");
  ensureDir(SHARED);
  ensureDir(STAFF);
  ensureDir(BORROWER);

  // --- SHARED ---
  console.log("Moving shared UI...");
  moveEntireDir(path.join(SRC, "components", "ui"), path.join(SHARED, "components", "ui"));

  const commonSrc = path.join(SRC, "components", "common");
  if (fs.existsSync(commonSrc)) {
    for (const name of fs.readdirSync(commonSrc)) {
      if (SHARED_COMMON.has(name))
        moveFile(path.join(commonSrc, name), path.join(SHARED, "components", "common", name));
      else if (STAFF_COMMON.has(name))
        moveFile(path.join(commonSrc, name), path.join(STAFF, "components", "common", name));
      else if (BORROWER_COMMON.has(name))
        moveFile(path.join(commonSrc, name), path.join(BORROWER, "components", "common", name));
    }
  }

  console.log("Moving shared hooks...");
  const hooksSrc = path.join(SRC, "hooks");
  for (const name of fs.readdirSync(hooksSrc)) {
    if (SHARED_HOOKS.has(name)) moveFile(path.join(hooksSrc, name), path.join(SHARED, "hooks", name));
    else if (STAFF_HOOKS.has(name)) moveFile(path.join(hooksSrc, name), path.join(STAFF, "hooks", name));
    else if (BORROWER_HOOKS.has(name)) moveFile(path.join(hooksSrc, name), path.join(BORROWER, "hooks", name));
  }

  console.log("Moving lib...");
  const libSrc = path.join(SRC, "lib");
  for (const name of fs.readdirSync(libSrc)) {
    if (name === "__tests__") {
      moveEntireDir(path.join(libSrc, "__tests__"), path.join(SHARED, "lib", "__tests__"));
      continue;
    }
    if (SHARED_LIB.has(name)) moveFile(path.join(libSrc, name), path.join(SHARED, "lib", name));
    else if (name === "adminDashboardStats.ts")
      moveFile(path.join(libSrc, name), path.join(STAFF, "lib", name));
  }

  console.log("Moving utils...");
  const utilsSrc = path.join(SRC, "utils");
  if (fs.existsSync(path.join(utilsSrc, "__tests__"))) {
    ensureDir(path.join(SHARED, "utils", "__tests__"));
    for (const name of fs.readdirSync(path.join(utilsSrc, "__tests__"))) {
      if (!name.includes("adminHouse") && !name.includes("houseProfit"))
        moveFile(path.join(utilsSrc, "__tests__", name), path.join(SHARED, "utils", "__tests__", name));
      else
        moveFile(path.join(utilsSrc, "__tests__", name), path.join(STAFF, "utils", "__tests__", name));
    }
  }
  for (const name of fs.readdirSync(utilsSrc)) {
    if (name === "__tests__") continue;
    if (SHARED_UTILS.has(name)) moveFile(path.join(utilsSrc, name), path.join(SHARED, "utils", name));
    else if (STAFF_UTILS.has(name)) moveFile(path.join(utilsSrc, name), path.join(STAFF, "utils", name));
    else if (BORROWER_UTILS.has(name)) moveFile(path.join(utilsSrc, name), path.join(BORROWER, "utils", name));
  }

  console.log("Moving integrations, types, constants, config...");
  moveEntireDir(path.join(SRC, "integrations"), path.join(SHARED, "integrations"));
  moveEntireDir(path.join(SRC, "types"), path.join(SHARED, "types"));
  moveEntireDir(path.join(SRC, "constants"), path.join(SHARED, "constants"));
  moveEntireDir(path.join(SRC, "config"), path.join(SHARED, "config"));

  console.log("Moving shared services...");
  moveFile(
    path.join(SRC, "services", "repositories", "loanProductsRepository.ts"),
    path.join(SHARED, "services", "repositories", "loanProductsRepository.ts")
  );
  moveFile(
    path.join(SRC, "services", "repositories", "workflowRepository.ts"),
    path.join(SHARED, "services", "repositories", "workflowRepository.ts")
  );

  // index.css -> shared
  moveFile(path.join(SRC, "index.css"), path.join(SHARED, "index.css"));
  moveFile(path.join(SRC, "vite-env.d.ts"), path.join(SHARED, "vite-env.d.ts"));

  // --- STAFF ---
  console.log("Moving staff pages & components...");
  moveEntireDir(path.join(SRC, "pages", "admin"), path.join(STAFF, "pages", "admin"));
  for (const name of STAFF_PAGES) {
    moveFile(path.join(SRC, "pages", name), path.join(STAFF, "pages", name));
  }
  moveEntireDir(path.join(SRC, "components", "admin"), path.join(STAFF, "components", "admin"));
  moveEntireDir(path.join(SRC, "components", "home"), path.join(STAFF, "components", "home"));
  moveEntireDir(path.join(SRC, "components", "layout"), path.join(STAFF, "components", "layout"));
  moveEntireDir(path.join(SRC, "components", "loans"), path.join(STAFF, "components", "loans"));

  moveFile(
    path.join(SRC, "services", "repositories", "houseRepository.ts"),
    path.join(STAFF, "services", "repositories", "houseRepository.ts")
  );
  moveFile(
    path.join(SRC, "services", "repositories", "houseWorkflowRepository.ts"),
    path.join(STAFF, "services", "repositories", "houseWorkflowRepository.ts")
  );
  moveFile(
    path.join(SRC, "services", "repositories", "houseWorkflowRepository.test.ts"),
    path.join(STAFF, "services", "repositories", "houseWorkflowRepository.test.ts")
  );
  moveEntireDir(path.join(SRC, "contexts"), path.join(STAFF, "contexts"));

  // --- BORROWER ---
  console.log("Moving borrower pages & components...");
  for (const name of BORROWER_PAGES) {
    moveFile(path.join(SRC, "pages", name), path.join(BORROWER, "pages", name));
  }
  moveEntireDir(path.join(SRC, "components", "dashboard"), path.join(BORROWER, "components", "dashboard"));
  moveEntireDir(path.join(SRC, "components", "auth"), path.join(BORROWER, "components", "auth"));

  // Auth.tsx stays at root temporarily - handled manually
  // App.tsx, main.tsx - handled manually

  console.log("Rewriting imports...");
  processTsFiles(SHARED, SHARED, true);
  processTsFiles(STAFF, STAFF);
  processTsFiles(BORROWER, BORROWER);

  console.log("Migration file moves complete.");
}

migrate();
