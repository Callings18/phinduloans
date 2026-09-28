/**
 * Native APK download for Android users.
 * iOS / desktop fall back to PWA install instructions.
 */
export const APK_URL = "/downloads/PhinduCredit.apk";
export const APK_FILENAME = "PhinduCredit.apk";

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

export function downloadApk(): void {
  const a = document.createElement("a");
  a.href = APK_URL;
  a.download = APK_FILENAME;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
