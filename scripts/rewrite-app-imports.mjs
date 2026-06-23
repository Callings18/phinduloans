/**
 * Rewrite @/ imports in apps and packages/shared to @phinduloans/shared where appropriate.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SHARED_PREFIXES = [
  "components/ui/",
  "components/common/ErrorBoundary",
  "components/common/PWAInstallPrompt",
  "components/common/ThemeToggle",
  "components/common/NotificationCenter",
  "components/common/SignaturePad",
  "components/common/LoanComparison",
  "components/common/QueryStateView",
  "components/common/DocumentUploader",
  "components/common/LegacyDataFallback",
  "hooks/useAuth",
  "hooks/use-toast",
  "hooks/use-mobile",
  "hooks/useMediaQuery",
  "hooks/usePwaInstallPrompt",
  "hooks/useSystemSettings",
  "hooks/useFeatureFlags",
  "hooks/useProductLoanRules",
  "lib/utils",
  "lib/businessCalendar",
  "lib/disbursementCalendar",
  "lib/marketeerCalculations",
  "integrations/supabase/",
  "types/",
  "constants/",
  "config/",
  "services/repositories/loanProductsRepository",
  "services/repositories/workflowRepository",
  "utils/loanCalculations",
  "utils/loanBalance",
  "utils/paymentAllocation",
  "utils/repaymentRemaining",
  "utils/createRepaymentSchedule",
  "utils/repaymentFrequencyLabels",
  "utils/generateLoanSchedule",
  "utils/generateLoanContract",
  "utils/generateRepaymentReceipt",
  "utils/generateStatement",
  "utils/handlePaymentReceipt",
  "utils/exportLoanScheduleCsv",
  "utils/borrowerPortalIntegration",
  "utils/authHelpers",
  "utils/mapSupabaseError",
  "utils/rpcResult",
  "utils/legacyData",
  "utils/notificationService",
  "utils/sendDirectNotification",
  "utils/pushNotifications",
  "utils/pwaDisplayMode",
  "utils/storageHelpers",
  "utils/errorHandler",
  "utils/auditLog",
  "utils/houseProductPolicySpec",
  "utils/notifyBorrowerPortal",
];

const RELATIVE_COMMON = [
  ["ThemeToggle", "@phinduloans/shared/components/common/ThemeToggle"],
  ["NotificationCenter", "@phinduloans/shared/components/common/NotificationCenter"],
  ["ErrorBoundary", "@phinduloans/shared/components/common/ErrorBoundary"],
  ["LoanComparison", "@phinduloans/shared/components/common/LoanComparison"],
  ["QueryStateView", "@phinduloans/shared/components/common/QueryStateView"],
  ["SignaturePad", "@phinduloans/shared/components/common/SignaturePad"],
  ["PWAInstallPrompt", "@phinduloans/shared/components/common/PWAInstallPrompt"],
  ["LegacyDataFallback", "@phinduloans/shared/components/common/LegacyDataFallback"],
  ["DocumentUploader", "@phinduloans/shared/components/common/DocumentUploader"],
];

function rewriteContent(content, allShared = false) {
  let out = content;

  // Fix relative imports to moved common components
  for (const [name, target] of RELATIVE_COMMON) {
    out = out.replace(
      new RegExp(`from ["'](\\.\\./)+common/${name}["']`, "g"),
      `from "${target}"`
    );
    out = out.replace(
      new RegExp(`from ["']@/components/common/${name}["']`, "g"),
      `from "${target}"`
    );
  }

  if (allShared) {
    return out.replace(/@\//g, "@phinduloans/shared/");
  }

  // In apps: rewrite @/ -> @phinduloans/shared/ for shared modules
  out = out.replace(/from ["']@\/([^"']+)["']/g, (match, importPath) => {
    const isShared = SHARED_PREFIXES.some(
      (p) => importPath === p.replace(/\/$/, "") || importPath.startsWith(p)
    );
    if (isShared) {
      return `from "@phinduloans/shared/${importPath}"`;
    }
    return match;
  });

  // Also handle dynamic import("@/utils/...")
  out = out.replace(/import\(["']@\/([^"']+)["']\)/g, (match, importPath) => {
    const isShared = SHARED_PREFIXES.some(
      (p) => importPath === p.replace(/\/$/, "") || importPath.startsWith(p)
    );
    if (isShared) {
      return `import("@phinduloans/shared/${importPath}")`;
    }
    return match;
  });

  return out;
}

function walk(dir, allShared = false) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, allShared);
    else if (/\.tsx?$/.test(entry.name)) {
      const original = fs.readFileSync(full, "utf8");
      const next = rewriteContent(original, allShared);
      if (next !== original) fs.writeFileSync(full, next);
    }
  }
}

console.log("Rewriting shared package imports...");
walk(path.join(ROOT, "packages", "shared", "src"), true);
console.log("Rewriting staff-web imports...");
walk(path.join(ROOT, "apps", "staff-web", "src"));
console.log("Rewriting borrower-mobile imports...");
walk(path.join(ROOT, "apps", "borrower-mobile", "src"));
console.log("Done.");
