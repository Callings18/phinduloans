import { useLocation } from "react-router-dom";
import PWAInstallPrompt from "@phinduloans/shared/components/common/PWAInstallPrompt";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";

/**
 * Soft install nudge (APK / PWA) — borrowers only, after login.
 * Never blocks the web app. Hidden on auth/install pages and for staff.
 */
export function BorrowerInstallNudge() {
  const { user, isLoading, isStaff } = useAuth();
  const { pathname } = useLocation();

  const onAuthOrInstall =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/install") ||
    pathname.startsWith("/download");

  const enabled = !isLoading && Boolean(user) && !isStaff && !onAuthOrInstall;

  return <PWAInstallPrompt enabled={enabled} />;
}
