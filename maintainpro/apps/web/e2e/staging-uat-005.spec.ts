import { expect, test, type Page } from "@playwright/test";

const stagingWeb = (process.env.MAINTAINPRO_WEB_URL ?? process.env.STAGING_WEB_URL ?? "").replace(
  /\/+$/,
  ""
);
const seedPassword = process.env.MAINTAINPRO_SMOKE_PASSWORD ?? process.env.MAINTAINPRO_SEED_PASSWORD ?? "";
const configured = Boolean(stagingWeb && seedPassword.length >= 12);

async function loginAs(page: Page, email: string) {
  await page.goto(`${stagingWeb}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(seedPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|admin|work-orders|inventory|fleet|system-health)/, { timeout: 90_000 });
  await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
}

test.describe("UAT-005 production cutover readiness browser checks", () => {
  test.skip(!configured, "Set MAINTAINPRO_WEB_URL and MAINTAINPRO_SMOKE_PASSWORD (min 12 chars)");

  test("admin system health shows provider diagnostics", async ({ page }) => {
    await loginAs(page, "admin@maintainpro.local");
    await page.goto(`${stagingWeb}/system-health`);
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Production Readiness" })).toBeVisible();
    const providerSection = page.locator('section[aria-labelledby="provider-readiness-heading"]');
    await expect(providerSection.getByRole("heading", { name: "Provider diagnostics (cutover)" })).toBeVisible();
    await expect(providerSection.getByText("Evidence storage")).toBeVisible();
    await expect(providerSection.getByText(/DISABLED|MISCONFIGURED|ENABLED|UNKNOWN/)).toBeVisible();
  });

  test("notification UAT panel shows honest disabled staging state", async ({ page }) => {
    await loginAs(page, "admin@maintainpro.local");
    await page.goto(`${stagingWeb}/system-health`);
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);
    const notificationSection = page.locator('section[aria-labelledby="notification-uat-heading"]');
    await expect(notificationSection.getByRole("heading", { name: "Staged Email/SMS test sends" })).toBeVisible();
    await expect(
      notificationSection.getByText(/EMAIL_DISABLED|Email delivery is disabled|disabled by EMAIL_MODE|^disabled$/i)
    ).toBeVisible({ timeout: 60_000 });
  });
});
