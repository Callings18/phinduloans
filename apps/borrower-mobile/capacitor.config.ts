import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Borrower native shell for Google Play (TWA / Capacitor WebView).
 * Build: npm run build && npx cap sync android
 * Optional CAPACITOR_SERVER_URL for dev (e.g. http://192.168.1.x:8081).
 */
const devServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.phindu.loans.borrower",
  appName: "Phindu Credit",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    backgroundColor: "#2D0818",
  },
  ios: {
    backgroundColor: "#2D0818",
  },
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
