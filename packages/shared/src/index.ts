/** @phinduloans/shared — cross-app UI, hooks, utils, Supabase client */
export {
  borrowerAppPath,
  ensureCorrectHost,
  getBorrowerAppUrl,
  getCanonicalOriginForMode,
  getExpectedModeForStaffWebBuild,
  getOfficeBaseUrl,
  getSiteModeFromHostname,
  isDevHost,
  isOfficeSiteMode,
  officePath,
} from "./config/siteMode";
export type { SiteMode } from "./config/siteMode";
