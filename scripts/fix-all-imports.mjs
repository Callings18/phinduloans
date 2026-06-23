import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REPLACEMENTS = [
  [/@\/components\/ui\//g, "@phinduloans/shared/components/ui/"],
  [/@\/hooks\/useAuth/g, "@phinduloans/shared/hooks/useAuth"],
  [/@\/hooks\/use-toast/g, "@phinduloans/shared/hooks/use-toast"],
  [/@\/hooks\/use-mobile/g, "@phinduloans/shared/hooks/use-mobile"],
  [/@\/hooks\/useMediaQuery/g, "@phinduloans/shared/hooks/useMediaQuery"],
  [/@\/hooks\/usePwaInstallPrompt/g, "@phinduloans/shared/hooks/usePwaInstallPrompt"],
  [/@\/hooks\/useSystemSettings/g, "@phinduloans/shared/hooks/useSystemSettings"],
  [/@\/hooks\/useFeatureFlags/g, "@phinduloans/shared/hooks/useFeatureFlags"],
  [/@\/hooks\/useProductLoanRules/g, "@phinduloans/shared/hooks/useProductLoanRules"],
  [/@\/lib\/utils/g, "@phinduloans/shared/lib/utils"],
  [/@\/lib\/businessCalendar/g, "@phinduloans/shared/lib/businessCalendar"],
  [/@\/lib\/disbursementCalendar/g, "@phinduloans/shared/lib/disbursementCalendar"],
  [/@\/lib\/marketeerCalculations/g, "@phinduloans/shared/lib/marketeerCalculations"],
  [/@\/integrations\/supabase\//g, "@phinduloans/shared/integrations/supabase/"],
  [/@\/types\//g, "@phinduloans/shared/types/"],
  [/@\/constants\//g, "@phinduloans/shared/constants/"],
  [/@\/config\//g, "@phinduloans/shared/config/"],
  [/@\/services\/repositories\/loanProductsRepository/g, "@phinduloans/shared/services/repositories/loanProductsRepository"],
  [/@\/services\/repositories\/workflowRepository/g, "@phinduloans/shared/services/repositories/workflowRepository"],
  [/from "\.\.\/common\/ThemeToggle"/g, 'from "@phinduloans/shared/components/common/ThemeToggle"'],
  [/from "\.\.\/common\/NotificationCenter"/g, 'from "@phinduloans/shared/components/common/NotificationCenter"'],
  [/from "\.\.\/\.\.\/common\/ThemeToggle"/g, 'from "@phinduloans/shared/components/common/ThemeToggle"'],
  [/from "\.\.\/\.\.\/common\/NotificationCenter"/g, 'from "@phinduloans/shared/components/common/NotificationCenter"'],
  [/from "@\/components\/common\/ErrorBoundary"/g, 'from "@phinduloans/shared/components/common/ErrorBoundary"'],
  [/from "@\/components\/common\/QueryStateView"/g, 'from "@phinduloans/shared/components/common/QueryStateView"'],
  [/from "@\/components\/common\/LoanComparison"/g, 'from "@phinduloans/shared/components/common/LoanComparison"'],
  [/from "@\/components\/common\/SignaturePad"/g, 'from "@phinduloans/shared/components/common/SignaturePad"'],
  [/from "@\/components\/common\/LegacyDataFallback"/g, 'from "@phinduloans/shared/components/common/LegacyDataFallback"'],
  [/from "@\/components\/common\/DocumentUploader"/g, 'from "@phinduloans/shared/components/common/DocumentUploader"'],
  [/from "@\/components\/common\/PWAInstallPrompt"/g, 'from "@phinduloans/shared/components/common/PWAInstallPrompt"'],
];

const UTILS = [
  "loanCalculations", "loanBalance", "paymentAllocation", "repaymentRemaining",
  "createRepaymentSchedule", "repaymentFrequencyLabels", "generateLoanSchedule",
  "generateLoanContract", "generateRepaymentReceipt", "generateStatement",
  "handlePaymentReceipt", "exportLoanScheduleCsv", "borrowerPortalIntegration",
  "authHelpers", "mapSupabaseError", "rpcResult", "legacyData", "notificationService",
  "sendDirectNotification", "pushNotifications", "pwaDisplayMode", "storageHelpers",
  "errorHandler", "auditLog", "houseProductPolicySpec", "notifyBorrowerPortal",
];

for (const u of UTILS) {
  REPLACEMENTS.push([new RegExp(`@/utils/${u}`, "g"), `@phinduloans/shared/utils/${u}`]);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name)) {
      let content = fs.readFileSync(full, "utf8");
      let next = content;
      for (const [re, rep] of REPLACEMENTS) next = next.replace(re, rep);
      if (next !== content) fs.writeFileSync(full, next);
    }
  }
}

for (const dir of [
  path.join(ROOT, "apps", "staff-web", "src"),
  path.join(ROOT, "apps", "borrower-mobile", "src"),
]) {
  console.log("Fixing", dir);
  walk(dir);
}
console.log("Done");
