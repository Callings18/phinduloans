/**
 * Detect whether the app is running as an installed PWA (standalone).
 * Covers Chromium (display-mode) and iOS Safari (navigator.standalone).
 */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const standaloneMq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    typeof (window.navigator as Navigator & { standalone?: boolean }).standalone === "boolean" &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneMq || iosStandalone;
}

/**
 * When true, borrower apply/dashboard and browser-tab signup are blocked until the PWA is installed.
 * - `VITE_BORROWER_WEB_INSTALL_GATE=false` — always off (e.g. local testing).
 * - `VITE_BORROWER_WEB_INSTALL_GATE=true` — always on.
 * - unset — on in production builds only.
 */
export function isBorrowerWebInstallGateEnabled(): boolean {
  const raw = import.meta.env.VITE_BORROWER_WEB_INSTALL_GATE;
  if (raw === "false" || raw === "0") {
    return false;
  }
  if (raw === "true" || raw === "1") {
    return true;
  }
  return import.meta.env.PROD;
}
