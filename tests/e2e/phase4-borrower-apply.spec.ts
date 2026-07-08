import { expect, test } from "@playwright/test";
import { signInBorrowerAndOpenDashboard, type E2ECreds } from "./helpers/login";

/** Borrower Vite dev server defaults to 8081 — override with E2E_BASE_URL when needed. */
const borrowerBaseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:8081";

const borrowerCreds: E2ECreds | null =
  process.env.E2E_BORROWER_EMAIL && process.env.E2E_BORROWER_PASSWORD
    ? { email: process.env.E2E_BORROWER_EMAIL, password: process.env.E2E_BORROWER_PASSWORD }
    : null;

let serverReachable = false;

test.describe("Phase 4 — borrower apply & dashboard navigation", () => {
  test.use({ baseURL: borrowerBaseUrl });

  test.beforeAll(async ({ request }) => {
    try {
      const res = await request.get(borrowerBaseUrl, { timeout: 8_000 });
      serverReachable = res.status() < 500;
    } catch {
      serverReachable = false;
    }
  });

  test.beforeEach(() => {
    test.skip(
      !serverReachable,
      `Start borrower dev server (npm run dev:borrower) at ${borrowerBaseUrl} or set E2E_BASE_URL`,
    );
  });

  test("unauthenticated /apply redirects to auth with next=dashboard", async ({ page }) => {
    await page.goto("/apply");
    await page.waitForURL(/\/auth/, { timeout: 15_000 });
    expect(page.url()).toMatch(/next=%2Fdashboard|next=\/dashboard/);
  });

  test("authenticated borrower /apply redirects to dashboard", async ({ page }) => {
    test.skip(!borrowerCreds, "Set E2E_BORROWER_EMAIL and E2E_BORROWER_PASSWORD");
    await signInBorrowerAndOpenDashboard(page, borrowerCreds!);
    await page.goto("/apply");
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByTestId("borrower-dashboard-welcome")).toBeVisible({ timeout: 15_000 });
  });

  test("dashboard tabs load via ?tab= query param", async ({ page }) => {
    test.skip(!borrowerCreds, "Set E2E_BORROWER_EMAIL and E2E_BORROWER_PASSWORD");

    const tabs: { tab: string; heading: RegExp | string; testId?: string }[] = [
      { tab: "home", heading: /Welcome back/i, testId: "borrower-dashboard-welcome" },
      { tab: "loans", heading: /My Loans|Loan/i },
      { tab: "payments", heading: /Payment/i },
      { tab: "profile", heading: /Profile|KYC/i, testId: "borrower-profile-tab" },
    ];

    await signInBorrowerAndOpenDashboard(page, borrowerCreds!);

    for (const { tab, heading, testId } of tabs) {
      await page.goto(`/dashboard?tab=${tab}`);
      await page.waitForLoadState("networkidle");
      if (testId) {
        await expect(page.getByTestId(testId)).toBeVisible({ timeout: 20_000 });
      } else {
        await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({
          timeout: 20_000,
        });
      }
    }
  });

  test("apply tab opens loan application entry point", async ({ page }) => {
    test.skip(!borrowerCreds, "Set E2E_BORROWER_EMAIL and E2E_BORROWER_PASSWORD");
    await signInBorrowerAndOpenDashboard(page, borrowerCreds!);
    await page.goto("/dashboard?tab=apply");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Apply for Loan/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
