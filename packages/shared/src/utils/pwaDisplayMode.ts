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
 * When true, borrower apply/dashboard are blocked until the PWA/APK is installed.
 * Product default is web-first: gate is always OFF.
 * Kept for backwards-compatible env reads; prefer soft nudge + /install APK page.
 */
export function isBorrowerWebInstallGateEnabled(): boolean {
  return false;
}
