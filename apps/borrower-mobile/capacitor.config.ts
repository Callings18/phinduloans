import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Borrower mobile shell: ships apps/borrower-mobile/dist as the native app.
 * Optional CAPACITOR_SERVER_URL for dev (e.g. http://192.168.1.x:8081).
 */
const devServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.phindu.loans.borrower",
  appName: "Phindu Loans",
  webDir: "dist",
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: devServerUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
