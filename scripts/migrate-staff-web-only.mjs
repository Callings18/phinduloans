/** Re-populate apps/staff-web/src from restored git src/ */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const STAFF = path.join(ROOT, "apps", "staff-web", "src");

const STAFF_COMMON = new Set(["BulkActions.tsx", "PaginationControls.tsx", "GuidedTour.tsx", "ResponsiveDataViews.tsx", "PhinduAI.tsx"]);
const STAFF_HOOKS = new Set(["usePermissions.ts", "useAdminDashboardStats.ts", "useHouseData.ts", "useRealtimeInvalidate.ts", "useLoanProductModules.ts", "useProductAccess.ts", "useLoanProductFilter.ts", "useLoanReviewChecklist.ts", "usePMIC.ts"]);
const STAFF_UTILS = new Set(["adminHousePaths.ts", "houseProfit.ts", "payrollCalculations.ts", "payrollRunCsvExport.ts", "payslipPdfGenerator.ts", "generateDemandLetter.ts", "generateClearanceCertificate.ts", "generatePMICExport.ts", "pmicEligibilityCalculator.ts", "reportExportEngine.ts", "reportQueryGuards.ts", "exportBorrowerData.ts", "smsService.ts", "appDownload.ts"]);
const STAFF_PAGES = new Set(["Index.tsx", "About.tsx", "Calculator.tsx", "Install.tsx", "NotFound.tsx"]);

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function copyFile(s, d) { ensureDir(path.dirname(d)); fs.copyFileSync(s, d); }
function copyDir(s, d) {
  ensureDir(d);
  for (const e of fs.readdirSync(s, { withFileTypes: true })) {
    const sp = path.join(s, e.name), dp = path.join(d, e.name);
    if (e.isDirectory()) copyDir(sp, dp);
    else copyFile(sp, dp);
  }
}

ensureDir(STAFF);
copyDir(path.join(SRC, "pages", "admin"), path.join(STAFF, "pages", "admin"));
for (const p of STAFF_PAGES) copyFile(path.join(SRC, "pages", p), path.join(STAFF, "pages", p));
copyDir(path.join(SRC, "components", "admin"), path.join(STAFF, "components", "admin"));
copyDir(path.join(SRC, "components", "home"), path.join(STAFF, "components", "home"));
copyDir(path.join(SRC, "components", "layout"), path.join(STAFF, "components", "layout"));
if (fs.existsSync(path.join(SRC, "components", "loans"))) copyDir(path.join(SRC, "components", "loans"), path.join(STAFF, "components", "loans"));
for (const n of STAFF_COMMON) copyFile(path.join(SRC, "components", "common", n), path.join(STAFF, "components", "common", n));
for (const n of STAFF_HOOKS) copyFile(path.join(SRC, "hooks", n), path.join(STAFF, "hooks", n));
copyFile(path.join(SRC, "lib", "adminDashboardStats.ts"), path.join(STAFF, "lib", "adminDashboardStats.ts"));
for (const n of STAFF_UTILS) {
  if (fs.existsSync(path.join(SRC, "utils", n))) copyFile(path.join(SRC, "utils", n), path.join(STAFF, "utils", n));
}
if (fs.existsSync(path.join(SRC, "utils", "__tests__"))) {
  ensureDir(path.join(STAFF, "utils", "__tests__"));
  for (const n of fs.readdirSync(path.join(SRC, "utils", "__tests__"))) {
    if (n.includes("adminHouse") || n.includes("houseProfit"))
      copyFile(path.join(SRC, "utils", "__tests__", n), path.join(STAFF, "utils", "__tests__", n));
  }
}
copyFile(path.join(SRC, "services", "repositories", "houseRepository.ts"), path.join(STAFF, "services", "repositories", "houseRepository.ts"));
copyFile(path.join(SRC, "services", "repositories", "houseWorkflowRepository.ts"), path.join(STAFF, "services", "repositories", "houseWorkflowRepository.ts"));
copyFile(path.join(SRC, "services", "repositories", "houseWorkflowRepository.test.ts"), path.join(STAFF, "services", "repositories", "houseWorkflowRepository.test.ts"));
copyDir(path.join(SRC, "contexts"), path.join(STAFF, "contexts"));

console.log("Staff-web src restored from git src/");
