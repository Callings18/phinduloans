import { expect, test, type Page } from "@playwright/test";

type Creds = { email: string; password: string };

const lowStaffCreds: Creds | null =
  process.env.E2E_STAFF_LOW_EMAIL && process.env.E2E_STAFF_LOW_PASSWORD
    ? {
        email: process.env.E2E_STAFF_LOW_EMAIL,
        password: process.env.E2E_STAFF_LOW_PASSWORD,
      }
    : null;

const financeCreds: Creds | null =
  process.env.E2E_FINANCE_EMAIL && process.env.E2E_FINANCE_PASSWORD
    ? {
        email: process.env.E2E_FINANCE_EMAIL,
        password: process.env.E2E_FINANCE_PASSWORD,
      }
    : null;

/** Borrower-only account (non-staff) — optional; extends launch-matrix coverage for borrower flows */
const borrowerCreds: Creds | null =
  process.env.E2E_BORROWER_EMAIL && process.env.E2E_BORROWER_PASSWORD
    ? {
        email: process.env.E2E_BORROWER_EMAIL,
        password: process.env.E2E_BORROWER_PASSWORD,
      }
    : null;

/** e.g. MARKETEER, PAYDAY_SOFT — must exist in `loan_products.product_code` for staff user */
const houseProductCode = process.env.E2E_HOUSE_PRODUCT_CODE?.trim() || "";

async function login(page: Page, creds: Creds) {
  await page.goto("/auth");
  await page.fill("#email", creds.email);
  await page.fill("#password", creds.password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test.describe("borrower portal smoke", () => {
  test("unauthenticated profile deep-link redirects to auth", async ({ page }) => {
    await page.goto("/profile?tab=documents");
    await page.waitForURL(/\/auth/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/auth/);
  });

  test("borrower can load dashboard after sign-in", async ({ page }) => {
    test.skip(!borrowerCreds, "Set E2E_BORROWER_EMAIL and E2E_BORROWER_PASSWORD (non-staff borrower)");
    await login(page, borrowerCreds!);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Welcome back/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("admin hardening smoke", () => {
  test("finance staff can open loan product houses hub", async ({ page }) => {
    test.skip(!financeCreds, "Set E2E_FINANCE_EMAIL and E2E_FINANCE_PASSWORD (role should include loans:view)");
    await login(page, financeCreds!);
    await page.goto("/admin/houses");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Loan Product Houses" })).toBeVisible();
  });

  test("finance staff can open global disbursements, repayments, and reports", async ({ page }) => {
    test.skip(!financeCreds, "Set E2E_FINANCE_EMAIL and E2E_FINANCE_PASSWORD");
    await login(page, financeCreds!);

    await page.goto("/admin/disbursements");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Disbursements" })).toBeVisible();

    await page.goto("/admin/repayments");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Repayments" })).toBeVisible();

    await page.goto("/admin/reports");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Reports & Export" })).toBeVisible();
  });

  test("finance staff can open a house dashboard when E2E_HOUSE_PRODUCT_CODE is set", async ({ page }) => {
    test.skip(!financeCreds, "Set E2E_FINANCE_EMAIL and E2E_FINANCE_PASSWORD");
    test.skip(!houseProductCode, "Set E2E_HOUSE_PRODUCT_CODE (e.g. MARKETEER) — user needs house:dashboard_view for that product");
    await login(page, financeCreds!);
    await page.goto(`/admin/houses/${encodeURIComponent(houseProductCode)}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Total loans", { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test("route denial for low-privileged staff on settings", async ({ page }) => {
    test.skip(!lowStaffCreds, "Set E2E_STAFF_LOW_EMAIL and E2E_STAFF_LOW_PASSWORD");
    await login(page, lowStaffCreds!);
    await page.goto("/admin/settings");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/admin(\/)?$/);
  });

  test("expense flow surfaces approve action and executes if pending exists", async ({ page }) => {
    test.skip(!financeCreds, "Set E2E_FINANCE_EMAIL and E2E_FINANCE_PASSWORD");
    await login(page, financeCreds!);
    await page.goto("/admin/expenses");
    await page.waitForLoadState("networkidle");

    const actionsMenu = page.getByRole("button", { name: "Actions" }).first();
    if ((await actionsMenu.count()) === 0) test.skip(true, "No expenses available");

    await actionsMenu.click();
    const approveItem = page.getByRole("menuitem", { name: "Approve" }).first();
    const hasApprove = (await approveItem.count()) > 0;
    if (!hasApprove) test.skip(true, "No pending expense found for approval");

    await approveItem.click();
    await expect(page.getByText("Expense status updated")).toBeVisible();
  });

  test("write-off flow surfaces approve action and executes if pending exists", async ({ page }) => {
    test.skip(!financeCreds, "Set E2E_FINANCE_EMAIL and E2E_FINANCE_PASSWORD");
    await login(page, financeCreds!);
    await page.goto("/admin/write-offs");
    await page.waitForLoadState("networkidle");

    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    if ((await approveButton.count()) === 0) test.skip(true, "No pending write-off found");

    await approveButton.click();
    await page.getByRole("button", { name: "Approve Write-Off" }).click();
    await expect(page.getByText("Write-off approved successfully")).toBeVisible();
  });
});
