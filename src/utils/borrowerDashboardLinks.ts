/** Deep links into the in-dashboard borrower profile module (not legacy `/profile`). */

export type BorrowerProfileSection = "personal" | "kyc" | "security" | "notifications";

export function borrowerDashboardProfileHref(options?: {
  openKycWorkspace?: boolean;
  profileSection?: BorrowerProfileSection;
  viewToken?: string | null;
}) {
  const qs = new URLSearchParams();
  qs.set("tab", "profile");
  if (options?.openKycWorkspace) qs.set("kyc", "documents");
  if (options?.profileSection && options.profileSection !== "personal") {
    qs.set("profileSection", options.profileSection);
  }
  if (options?.viewToken) qs.set("view", options.viewToken);
  return `/dashboard?${qs.toString()}`;
}

/** Map legacy `/profile?tab=` values to dashboard query params. */
export function borrowerDashboardHrefFromLegacyProfileTab(legacyTab: string | null) {
  if (legacyTab === "documents" || legacyTab === "kyc") {
    return borrowerDashboardProfileHref({ openKycWorkspace: true });
  }
  if (legacyTab === "security") {
    return borrowerDashboardProfileHref({ profileSection: "security" });
  }
  if (legacyTab === "notifications") {
    return borrowerDashboardProfileHref({ profileSection: "notifications" });
  }
  return borrowerDashboardProfileHref();
}
