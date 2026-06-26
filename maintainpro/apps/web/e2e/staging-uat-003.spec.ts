import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const stagingWeb = (process.env.MAINTAINPRO_WEB_URL ?? process.env.STAGING_WEB_URL ?? "").replace(
  /\/+$/,
  ""
);
const seedPassword = process.env.MAINTAINPRO_SMOKE_PASSWORD ?? process.env.MAINTAINPRO_SEED_PASSWORD ?? "";
const configured = Boolean(stagingWeb && seedPassword.length >= 12);

const screenshotDir = path.join(__dirname, "../../../docs/screenshots/staging");

const personas = {
  admin: "admin@maintainpro.local",
  manager: "manager@maintainpro.local",
  technician: "tech@maintainpro.local",
  security: "security@maintainpro.local",
  inventory: "inventory@maintainpro.local"
} as const;

async function loginAs(page: Page, email: string) {
  await page.goto(`${stagingWeb}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(seedPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|admin|work-orders|inventory|fleet)/, { timeout: 90_000 });
  await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
}

async function waitForWarmData(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

async function capture(page: Page, filename: string) {
  await waitForWarmData(page);
  await page.screenshot({
    path: path.join(screenshotDir, filename),
    fullPage: true
  });
}

test.describe("UAT-003 staging MVP lifecycle portfolio capture", () => {
  test.skip(!configured, "Set MAINTAINPRO_WEB_URL and MAINTAINPRO_SMOKE_PASSWORD (min 12 chars)");

  test("warm session — full screenshot portfolio after data load", async ({ page }) => {
    await page.goto(`${stagingWeb}/login`);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await capture(page, "01-login.png");

    await loginAs(page, personas.admin);
    await capture(page, "02-admin-dashboard.png");

    await page.goto(`${stagingWeb}/admin`);
    await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
    await capture(page, "03-admin-console.png");

    await page.goto(`${stagingWeb}/work-orders`);
    await expect(page.getByRole("heading", { name: "Work Orders", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Loading work orders" })).toHaveCount(0, {
      timeout: 60_000
    });
    await capture(page, "05-work-order-list.png");

    const editButton = page.getByRole("button", { name: "Edit work order" }).first();
    await expect(editButton).toBeVisible({ timeout: 60_000 });
    await editButton.click();
    await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible({ timeout: 30_000 });
    await waitForWarmData(page);
    await capture(page, "06-work-order-detail.png");
    const closeModal = page.getByRole("button", { name: "Close" });
    if (await closeModal.count()) {
      await closeModal.first().click();
    } else {
      await page.keyboard.press("Escape");
    }

    await page.goto(`${stagingWeb}/system-health`);
    await expect(page.getByRole("heading", { name: /System Health/i })).toBeVisible();
    await capture(page, "10-erp-system-health.png");

    await page.goto(`${stagingWeb}/settings`);
    const auditTab = page.getByRole("tab", { name: /Audit/i });
    if (await auditTab.count()) {
      await auditTab.click();
      await waitForWarmData(page);
      await capture(page, "12-audit-trail.png");
    }

    const signOut = page.getByRole("button", { name: /Sign out|Log out/i });
    if (await signOut.count()) {
      await signOut.first().click();
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    }
  });

  test("manager dashboard and reports", async ({ page }) => {
    await loginAs(page, personas.manager);
    await capture(page, "04-manager-dashboard.png");

    await page.goto(`${stagingWeb}/reports`);
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
    await capture(page, "11-reports-dashboard.png");
  });

  test("technician jobs surface", async ({ page }) => {
    await loginAs(page, personas.technician);
    await page.goto(`${stagingWeb}/work-orders`);
    await expect(page.getByRole("heading", { name: "Work Orders", exact: true })).toBeVisible();
    await capture(page, "07-technician-jobs.png");
  });

  test("security officer fleet gate surface", async ({ page }) => {
    await loginAs(page, personas.security);
    await page.goto(`${stagingWeb}/fleet`);
    await expect(page.locator("body")).toContainText(/Fleet|Live map|vehicle/i);
    await capture(page, "08-security-fleet-gate.png");
  });

  test("inventory stock surface", async ({ page }) => {
    await loginAs(page, personas.inventory);
    await page.goto(`${stagingWeb}/inventory`);
    await expect(page.getByRole("heading", { name: /Inventory/i })).toBeVisible();
    await capture(page, "09-inventory-stock.png");
  });
});
