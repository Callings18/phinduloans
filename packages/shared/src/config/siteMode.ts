/**
 * Three-domain routing: phindu.com (marketing), office.phindu.com (staff),
 * app.phindu.com (borrower PWA). Hostname guards run at app boot via ensureCorrectHost.
 */

export type SiteMode = "marketing" | "office" | "borrower";

const DEFAULT_BORROWER_APP_URL = "https://app.phindu.com";
const DEFAULT_OFFICE_URL = "https://office.phindu.com";
const DEFAULT_MARKETING_URL = "https://phindu.com";

export function getBorrowerAppUrl(): string {
  return (import.meta.env.VITE_BORROWER_APP_URL || DEFAULT_BORROWER_APP_URL).replace(/\/+$/, "");
}

export function getOfficeBaseUrl(): string {
  return (import.meta.env.VITE_OFFICE_BASE_URL || DEFAULT_OFFICE_URL).replace(/\/+$/, "");
}

function getMarketingBaseUrl(): string {
  return (import.meta.env.VITE_MARKETING_BASE_URL || DEFAULT_MARKETING_URL).replace(/\/+$/, "");
}

export function borrowerAppPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getBorrowerAppUrl()}${normalized}`;
}

export function officePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getOfficeBaseUrl()}${normalized}`;
}

/** Staff-web build flag: marketing (default) or office. */
export function isOfficeSiteMode(): boolean {
  return (import.meta.env.VITE_SITE_MODE || "").toLowerCase() === "office";
}

export function getExpectedModeForStaffWebBuild(): SiteMode {
  return isOfficeSiteMode() ? "office" : "marketing";
}

export function getSiteModeFromHostname(hostname?: string): SiteMode | "dev" {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();

  if (host === "localhost" || host === "127.0.0.1") {
    return "dev";
  }
  // Railway preview hosts must not bounce to phindu.com until custom domains are attached.
  if (host.endsWith(".up.railway.app") || host.endsWith(".railway.app")) {
    return "dev";
  }
  if (host === "phindu.com" || host === "www.phindu.com") {
    return "marketing";
  }
  if (host === "office.phindu.com") {
    return "office";
  }
  if (host === "app.phindu.com") {
    return "borrower";
  }

  return "dev";
}

export function isDevHost(hostname?: string): boolean {
  return getSiteModeFromHostname(hostname) === "dev";
}

export function getCanonicalOriginForMode(mode: SiteMode): string {
  switch (mode) {
    case "marketing":
      return getMarketingBaseUrl();
    case "office":
      return getOfficeBaseUrl();
    case "borrower":
      return getBorrowerAppUrl();
  }
}

/**
 * Redirects to the canonical origin when the current hostname does not match
 * the expected site mode. Skips redirect on localhost / unknown preview hosts.
 */
export function ensureCorrectHost(expectedMode: SiteMode): void {
  if (typeof window === "undefined") return;

  const hostMode = getSiteModeFromHostname();
  if (hostMode === "dev") return;

  if (hostMode !== expectedMode) {
    const correctOrigin = getCanonicalOriginForMode(expectedMode);
    window.location.replace(correctOrigin + window.location.pathname + window.location.search);
  }
}

const BORROWER_PATH_PREFIXES = [
  "/dashboard",
  "/profile",
  "/apply",
  "/pre-qualify",
  "/install",
  "/download",
  "/app",
  "/auth",
  "/login",
];

/**
 * On marketing host, bounce borrower paths (and Supabase auth hash) to app.phindu.com
 * before React paints. Call from staff-web main.tsx only.
 * Staff auth lives only on office.phindu.com — marketing /auth → borrower Login.
 */
export function redirectBorrowerPathsOffMarketing(): void {
  if (typeof window === "undefined") return;
  if (getSiteModeFromHostname() !== "marketing") return;

  const { pathname, search, hash } = window.location;
  const hasAuthHash =
    Boolean(hash) &&
    (hash.includes("access_token") || hash.includes("type=magiclink") || hash.includes("type=recovery"));

  if (hasAuthHash) {
    window.location.replace(`${borrowerAppPath("/dashboard")}${hash}`);
    return;
  }

  const isBorrowerPath = BORROWER_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isBorrowerPath) {
    window.location.replace(`${getBorrowerAppUrl()}${pathname}${search}${hash}`);
  }
}
