import { expect, test } from "@playwright/test";

const stagingWeb = (process.env.MAINTAINPRO_WEB_URL ?? process.env.STAGING_WEB_URL ?? "").replace(
  /\/+$/,
  ""
);
const stagingApi = (
  process.env.MAINTAINPRO_API_URL ??
  process.env.STAGING_API_URL ??
  ""
).replace(/\/+$/, "");
const smokeEmail = (process.env.MAINTAINPRO_SMOKE_EMAIL ?? process.env.SMOKE_LOGIN_EMAIL ?? "").trim();
const smokePassword = process.env.MAINTAINPRO_SMOKE_PASSWORD ?? process.env.SMOKE_LOGIN_PASSWORD ?? "";

const configured = Boolean(stagingWeb && stagingApi && smokeEmail && smokePassword);

test.describe("staging browser UAT (UAT-001)", () => {
  test.skip(!configured, "Set MAINTAINPRO_WEB_URL, MAINTAINPRO_API_URL, MAINTAINPRO_SMOKE_EMAIL, MAINTAINPRO_SMOKE_PASSWORD");

  test("valid login reaches dashboard without session_expired redirect", async ({ page }) => {
    await page.goto(`${stagingWeb}/login`);

    await page.locator('input[name="email"]').fill(smokeEmail);
    await page.locator('input[name="password"]').fill(smokePassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL(/\/(dashboard|admin|work-orders)/, { timeout: 60_000 });
    await expect(page).not.toHaveURL(/reason=session_expired/);
    await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
  });

  test("wrong password shows invalid credentials and stays on login", async ({ page }) => {
    await page.goto(`${stagingWeb}/login`);

    await page.locator('input[name="email"]').fill(smokeEmail);
    await page.locator('input[name="password"]').fill("WrongPass123!@#");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/reason=session_expired/);
  });

  test("admin console loads without React hook crash", async ({ page }) => {
    await page.goto(`${stagingWeb}/login`);
    await page.locator('input[name="email"]').fill(smokeEmail);
    await page.locator('input[name="password"]').fill(smokePassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(dashboard|admin|work-orders)/, { timeout: 60_000 });

    await page.goto(`${stagingWeb}/admin`);
    await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
    await expect(page.getByText("Administration modules")).toBeVisible();
  });

  test("action center loads without crash", async ({ page }) => {
    await page.goto(`${stagingWeb}/login`);
    await page.locator('input[name="email"]').fill(smokeEmail);
    await page.locator('input[name="password"]').fill(smokePassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(dashboard|admin|work-orders)/, { timeout: 60_000 });

    await page.goto(`${stagingWeb}/action-center`);
    await expect(page.getByRole("heading", { name: /Action Center/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
  });

  test("core routes load after login", async ({ page }) => {
    const routes = [
      "/dashboard",
      "/work-orders",
      "/cleaning/issues",
      "/facilities",
      "/assets",
      "/inventory",
      "/reports",
      "/system-health",
      "/settings"
    ];

    await page.goto(`${stagingWeb}/login`);
    await page.locator('input[name="email"]').fill(smokeEmail);
    await page.locator('input[name="password"]').fill(smokePassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(dashboard|admin|work-orders)/, { timeout: 60_000 });

    for (const route of routes) {
      await page.goto(`${stagingWeb}${route}`);
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
      await expect(page.getByText(/Application error/i)).toHaveCount(0);
    }
  });
});
