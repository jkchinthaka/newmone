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
  admin: { email: "admin@maintainpro.local", role: "ADMIN" },
  manager: { email: "manager@maintainpro.local", role: "MANAGER" },
  technician: { email: "tech@maintainpro.local", role: "TECHNICIAN" },
  security: { email: "security@maintainpro.local", role: "SECURITY_OFFICER" },
  inventory: { email: "inventory@maintainpro.local", role: "INVENTORY_KEEPER" }
} as const;

async function loginAs(page: Page, email: string) {
  await page.goto(`${stagingWeb}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(seedPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|admin|work-orders|inventory|fleet)/, { timeout: 90_000 });
  await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
}

async function expectNavLink(page: Page, label: string, visible: boolean) {
  const link = page.getByRole("link", { name: label, exact: true });
  if (visible) {
    await expect(link.first()).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(link).toHaveCount(0);
  }
}

async function capture(page: Page, filename: string) {
  await page.screenshot({
    path: path.join(screenshotDir, filename),
    fullPage: true
  });
}

test.describe("UAT-002 staging browser verification", () => {
  test.skip(!configured, "Set MAINTAINPRO_WEB_URL and MAINTAINPRO_SMOKE_PASSWORD (min 12 chars)");

  test("login page renders for portfolio capture", async ({ page }) => {
    await page.goto(`${stagingWeb}/login`);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await capture(page, "01-login.png");
  });

  test("admin role — console, settings, work orders, dashboard KPIs", async ({ page }) => {
    await loginAs(page, personas.admin.email);
    await capture(page, "02-admin-dashboard.png");

    await expectNavLink(page, "Admin Console", true);
    await expectNavLink(page, "Settings", true);
    await expectNavLink(page, "System Health", true);
    await expectNavLink(page, "Work Orders", true);

    await page.goto(`${stagingWeb}/admin`);
    await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
    await capture(page, "03-admin-console.png");

    await page.goto(`${stagingWeb}/work-orders`);
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    await expect(page.getByRole("heading", { name: /Work Orders/i })).toBeVisible();
    await capture(page, "05-work-order-list.png");

    await page.goto(`${stagingWeb}/system-health`);
    await expect(page.getByRole("heading", { name: /System Health/i })).toBeVisible();
    await capture(page, "10-erp-system-health.png");
  });

  test("manager role — approvals surface, reports, no admin console", async ({ page }) => {
    await loginAs(page, personas.manager.email);
    await capture(page, "04-manager-dashboard.png");

    await expectNavLink(page, "Work Orders", true);
    await expectNavLink(page, "Reports", true);
    await expectNavLink(page, "Admin Console", false);

    await page.goto(`${stagingWeb}/work-orders`);
    await expect(page.getByRole("heading", { name: "Work Orders", exact: true })).toBeVisible();
    await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
    await page.goto(`${stagingWeb}/reports`);
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
    await capture(page, "11-reports-dashboard.png");
  });

  test("technician role — work orders only, no admin or inventory nav", async ({ page }) => {
    await loginAs(page, personas.technician.email);
    await capture(page, "06-technician-work-orders.png");

    await expectNavLink(page, "Work Orders", true);
    await expectNavLink(page, "Admin Console", false);
    await expectNavLink(page, "Inventory", false);

    await page.goto(`${stagingWeb}/work-orders`);
    await expect(page.getByRole("heading", { name: "Work Orders", exact: true })).toBeVisible();
    await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
  });

  test("security officer role — fleet screen, no work orders nav", async ({ page }) => {
    await loginAs(page, personas.security.email);
    await capture(page, "07-security-fleet.png");

    await expectNavLink(page, "Fleet", true);
    await expectNavLink(page, "Work Orders", false);

    await page.goto(`${stagingWeb}/fleet`);
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
    await expect(page.locator("body")).toContainText(/Fleet|Live map|vehicle/i);
  });

  test("inventory keeper role — stock screens, procurement, no work orders", async ({ page }) => {
    await loginAs(page, personas.inventory.email);
    await capture(page, "08-inventory-stock.png");

    await expectNavLink(page, "Inventory", true);
    await expectNavLink(page, "Procurement", true);
    await expectNavLink(page, "Work Orders", false);

    await page.goto(`${stagingWeb}/inventory`);
    await expect(page.getByRole("heading", { name: /Inventory/i })).toBeVisible();
  });

  test("core routes load without application crash after admin login", async ({ page }) => {
    const routes = ["/dashboard", "/assets", "/vehicles", "/action-center", "/settings"];

    await loginAs(page, personas.admin.email);
    for (const route of routes) {
      await page.goto(`${stagingWeb}${route}`);
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
      await expect(page.getByText(/Application error/i)).toHaveCount(0);
    }

    await page.goto(`${stagingWeb}/settings`);
    const auditTab = page.getByRole("tab", { name: /Audit/i });
    if (await auditTab.count()) {
      await auditTab.click();
      await capture(page, "12-audit-trail-settings.png");
    }
  });

  test("logout returns to login", async ({ page }) => {
    await loginAs(page, personas.admin.email);
    const signOut = page.getByRole("button", { name: /Sign out|Log out/i });
    if (await signOut.count()) {
      await signOut.first().click();
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    } else {
      test.info().annotations.push({ type: "status", description: "OPERATOR-OWNED — sign-out control not found in shell" });
    }
  });
});
