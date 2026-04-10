import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Borrower shell: ship `dist/` as the app. Optional CAPACITOR_SERVER_URL for dev
 * (e.g. http://192.168.1.x:5173) to load the Vite dev server; omit in production.
 */
const devServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.phindu.loans.borrower',
  appName: 'Phindu Loans',
  webDir: 'dist',
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: devServerUrl.startsWith('http://'),
        },
      }
    : {}),
};

export default config;
