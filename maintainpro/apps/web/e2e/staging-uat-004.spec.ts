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
  await page.waitForURL(/\/(dashboard|admin|work-orders|inventory|fleet)/, { timeout: 90_000 });
  await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
}

test.describe("UAT-004 production hardening browser checks", () => {
  test.skip(!configured, "Set MAINTAINPRO_WEB_URL and MAINTAINPRO_SMOKE_PASSWORD (min 12 chars)");

  test("security officer can open fleet gate page", async ({ page }) => {
    await loginAs(page, "security@maintainpro.local");
    await page.goto(`${stagingWeb}/fleet/gate`);
    await expect(page.getByRole("heading", { name: "Fleet gate operations" })).toBeVisible();
    await expect(page.getByLabel("Vehicle list")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gate out" })).toBeVisible();
  });

  test("technician cannot access fleet gate route", async ({ page }) => {
    await loginAs(page, "tech@maintainpro.local");
    await page.goto(`${stagingWeb}/fleet/gate`);
    await expect(page.getByText(/Minified React error/i)).toHaveCount(0);
    await expect(page.getByText("Access restricted")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fleet gate operations" })).toHaveCount(0);
  });
});
