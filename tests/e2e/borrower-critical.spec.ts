import { expect, test } from "@playwright/test";
import { signInBorrowerAndOpenDashboard, type E2ECreds } from "./helpers/login";

const borrowerCreds: E2ECreds | null =
  process.env.E2E_BORROWER_EMAIL && process.env.E2E_BORROWER_PASSWORD
    ? { email: process.env.E2E_BORROWER_EMAIL, password: process.env.E2E_BORROWER_PASSWORD }
    : null;

test.describe("borrower critical path", () => {
  test("dashboard welcome visible after sign-in", async ({ page }) => {
    test.skip(!borrowerCreds, "Set E2E_BORROWER_EMAIL and E2E_BORROWER_PASSWORD");
    await signInBorrowerAndOpenDashboard(page, borrowerCreds!);
    await expect(page.getByTestId("borrower-dashboard-welcome")).toContainText(/Welcome back/i);
  });

  test("deep-link opens KYC workspace sheet", async ({ page }) => {
    test.skip(!borrowerCreds, "Set E2E_BORROWER_EMAIL and E2E_BORROWER_PASSWORD");
    await signInBorrowerAndOpenDashboard(page, borrowerCreds!);
    await page.goto("/dashboard?tab=profile&kyc=documents");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("borrower-kyc-sheet")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "KYC & payout" })).toBeVisible();
    await page.getByTestId("borrower-kyc-sheet-done").click();
    await expect(page.getByTestId("borrower-kyc-sheet")).toBeHidden({ timeout: 12_000 });
  });

  test("profile personal tab: validation blocks save; valid name saves", async ({ page }) => {
    test.skip(!borrowerCreds, "Set E2E_BORROWER_EMAIL and E2E_BORROWER_PASSWORD");
    await signInBorrowerAndOpenDashboard(page, borrowerCreds!);
    await page.goto("/dashboard?tab=profile");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("borrower-profile-tab")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("borrower-profile-edit").click();
    await page.getByTestId("borrower-profile-full-name").fill("No");
    await expect(page.getByTestId("borrower-profile-save")).toBeDisabled();
    await expect(page.getByTestId("borrower-profile-validation-error")).toContainText(/at least 3/i);

    const unique = `E2E Borrower ${Date.now()}`;
    await page.getByTestId("borrower-profile-full-name").fill(unique);
    await expect(page.getByTestId("borrower-profile-save")).toBeEnabled();
    await page.getByTestId("borrower-profile-save").click();
    await expect(page.getByText("Profile updated successfully", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("payment claim dialog: submit when pending repayment exists", async ({ page }) => {
    test.skip(!borrowerCreds, "Set E2E_BORROWER_EMAIL and E2E_BORROWER_PASSWORD");
    await signInBorrowerAndOpenDashboard(page, borrowerCreds!);
    await page.goto("/dashboard?tab=payments");
    await page.waitForLoadState("networkidle");

    const openClaim = page.getByTestId("borrower-open-payment-claim").first();
    if ((await openClaim.count()) === 0) {
      test.skip(true, "No pending repayments for this borrower — seed an active loan + schedule or use a fixture account");
    }

    await openClaim.click();
    await expect(page.getByTestId("borrower-payment-claim-dialog")).toBeVisible({ timeout: 15_000 });
    const ref = `E2E-${Date.now()}`;
    await page.locator("#claim-reference").fill(ref);
    const amount = page.locator("#claim-amount");
    if ((await amount.inputValue()) === "") {
      await amount.fill("1");
    }
    await page.getByTestId("borrower-payment-claim-submit").click();
    await expect(page.getByText("Payment reference submitted", { exact: false })).toBeVisible({ timeout: 25_000 });
  });
});
