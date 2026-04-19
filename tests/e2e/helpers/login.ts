import { expect, type Page } from "@playwright/test";

export type E2ECreds = { email: string; password: string };

/** Password sign-in on `/auth`, then open borrower dashboard. */
export async function signInBorrowerAndOpenDashboard(page: Page, creds: E2ECreds) {
  await page.goto("/auth");
  await page.fill("#email", creds.email);
  await page.fill("#password", creds.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("borrower-dashboard-welcome")).toBeVisible({ timeout: 25_000 });
}
