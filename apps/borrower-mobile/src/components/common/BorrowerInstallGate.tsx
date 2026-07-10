import type { ReactNode } from "react";

/**
 * @deprecated Web-first product: never block the browser.
 * Kept as a pass-through so any leftover imports stay safe.
 * Soft install UX lives in BorrowerInstallNudge + /install (APK).
 */
export function BorrowerInstallGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
