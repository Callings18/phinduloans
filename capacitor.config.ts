import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Legacy root Capacitor config. Prefer apps/borrower-mobile/capacitor.config.ts
 * for Play Store / iOS builds (com.phindu.loans.borrower).
 */
const config: CapacitorConfig = {
  appId: "com.phindu.loans.borrower",
  appName: "Phindu Credit",
  webDir: "apps/borrower-mobile/dist",
};

export default config;
