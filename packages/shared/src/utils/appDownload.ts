/**
 * Android APK sideload (optional). Keep off /auth and other login URLs — Chrome Safe Browsing
 * flags finance sites that push software installs next to credential flows.
 * Use {@link openBorrowerInstallPage} from in-app nudges; call {@link downloadApk} only from /install.
 */
export const APK_URL = "/downloads/PhinduCredit.apk";
export const APK_FILENAME = "PhinduCredit.apk";
export const BORROWER_INSTALL_PAGE_PATH = "/install";

/** Set VITE_PLAY_STORE_URL when the Play listing is live. */
export const PLAY_STORE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_PLAY_STORE_URL?.trim()) ||
  "";

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream;
}

/** Navigate to the dedicated install page (safe on auth/dashboard). */
export function openBorrowerInstallPage(): void {
  if (typeof window === "undefined") return;
  window.location.assign(BORROWER_INSTALL_PAGE_PATH);
}

/** Direct APK download — only from /install after explicit user consent. */
export function downloadApk(): void {
  const a = document.createElement("a");
  a.href = APK_URL;
  a.download = APK_FILENAME;
  a.rel = "noopener noreferrer nofollow";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
