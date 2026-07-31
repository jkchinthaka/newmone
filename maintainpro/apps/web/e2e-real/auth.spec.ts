import { expect, test } from "@playwright/test";
import {
  assertNoLegacyTokenStorage,
  loginViaUi,
  readCookieMap
} from "./helpers/auth";
import { e2eEmail, e2ePassword } from "./helpers/env";

test.describe("E2E authentication @full-stack @security @smoke", () => {
  test("E2E-AUTH-001 valid admin login succeeds", async ({ page }) => {
    const { loginResponse } = await loginViaUi(page, "admin-a");
    expect(loginResponse.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/login$/);
    await assertNoLegacyTokenStorage(page);
  });

  test("E2E-AUTH-002 invalid password returns generic error", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill(e2eEmail("admin-a"));
    await page.locator("#login-password").fill("DefinitelyWrongPass999!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("E2E-AUTH-003 unknown email returns same generic error pattern", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill(`unknown.${Date.now()}@e2e.maintainpro.test`);
    await page.locator("#login-password").fill(e2ePassword());
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("E2E-AUTH-004..009 cookie flags and token non-exposure", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const cookies = await readCookieMap(page);
    const access = cookies.get("maintainpro_access");
    const refresh = cookies.get("maintainpro_refresh");
    const csrf = cookies.get("maintainpro_csrf");
    expect(access?.httpOnly).toBeTruthy();
    expect(refresh?.httpOnly).toBeTruthy();
    expect(csrf?.httpOnly).toBeFalsy();
    expect(access?.secure).toBeFalsy();
    expect(access?.sameSite?.toLowerCase()).toBe("lax");
    await assertNoLegacyTokenStorage(page);
    // Do not print cookie values
  });

  test("E2E-AUTH-010 browser refresh preserves session", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    await page.reload();
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test("E2E-AUTH-011 logout clears cookies", async ({ page, request }) => {
    await loginViaUi(page, "admin-a");
    const cookies = await readCookieMap(page);
    const csrf = cookies.get("maintainpro_csrf")?.value;
    const response = await request.post("/api/backend/auth/logout", {
      headers: csrf ? { "x-csrf-token": csrf } : {}
    });
    expect([200, 201, 204]).toContain(response.status());
    const after = await readCookieMap(page);
    // Cookies may be cleared or expired; access should be gone or empty
    const access = after.get("maintainpro_access");
    expect(!access || !access.value || access.expires < Date.now() / 1000).toBeTruthy();
  });

  test("E2E-AUTH-012 protected page redirects after logout", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    await page.goto("/work-orders");
    // logout via UI if available, else API then navigate
    await page.request.post("/api/backend/auth/logout").catch(() => undefined);
    await page.goto("/work-orders");
    await expect(page).toHaveURL(/login/i);
  });
});