import { expect, test } from "@playwright/test";
import {
  assertNoLegacyTokenStorage,
  loginViaUi,
  readCookieMap
} from "./helpers/auth";
import {
  authenticatedGet,
  CANONICAL_LOGOUT_SUCCESS_STATUS,
  cookieNamesPresent,
  logoutBrowserSession
} from "./helpers/browser-session";
import { e2eEmail, e2ePassword } from "./helpers/env";
import { navigateToProtectedRouteAndExpectLogin } from "./helpers/protected-navigation";

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

  test("E2E-AUTH-011 logout clears cookies", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const before = await cookieNamesPresent(page);
    expect(before.access).toBeTruthy();
    expect(before.refresh).toBeTruthy();
    expect(before.csrf).toBeTruthy();

    const response = await logoutBrowserSession(page);
    expect(response.status()).toBe(CANONICAL_LOGOUT_SUCCESS_STATUS);
    const body = await response.json().catch(() => ({}));
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/"accessToken"\s*:/);
    expect(serialized).not.toMatch(/"refreshToken"\s*:/);
    expect(serialized).toMatch(/loggedOut|Logout successful/i);

    const setCookies = response
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value)
      .join("\n");
    expect(setCookies.toLowerCase()).toMatch(/maintainpro_access=/);
    expect(setCookies.toLowerCase()).toMatch(/maintainpro_refresh=/);
    expect(setCookies.toLowerCase()).toMatch(/maintainpro_csrf=/);

    const me = await authenticatedGet(page, "/api/backend/auth/me");
    expect(me.status()).toBe(401);

    const after = await readCookieMap(page);
    const access = after.get("maintainpro_access");
    const refresh = after.get("maintainpro_refresh");
    const csrf = after.get("maintainpro_csrf");
    const accessGone = !access || !access.value || access.expires * 1000 < Date.now();
    const refreshGone = !refresh || !refresh.value || refresh.expires * 1000 < Date.now();
    const csrfGone = !csrf || !csrf.value || csrf.expires * 1000 < Date.now();
    expect(accessGone).toBeTruthy();
    expect(refreshGone).toBeTruthy();
    expect(csrfGone).toBeTruthy();
  });

  test("E2E-AUTH-012 protected page redirects after logout", async ({ page }) => {
    const { loginResponse } = await loginViaUi(page, "admin-a");
    expect(loginResponse.status()).toBe(200);

    await page.goto("/work-orders");
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

    const beforeLogout = await cookieNamesPresent(page);
    expect(beforeLogout.access).toBeTruthy();
    expect(beforeLogout.refresh).toBeTruthy();
    expect(beforeLogout.csrf).toBeTruthy();

    const sessionBefore = await authenticatedGet(page, "/api/backend/auth/me");
    expect(sessionBefore.status()).toBe(200);

    // logoutBrowserSession requires matching CSRF; missing CSRF is covered in session-diagnostic.
    const logout = await logoutBrowserSession(page);
    expect(logout.status()).toBe(CANONICAL_LOGOUT_SUCCESS_STATUS);

    const me = await authenticatedGet(page, "/api/backend/auth/me");
    expect(me.status()).toBe(401);

    const after = await readCookieMap(page);
    const access = after.get("maintainpro_access");
    const refresh = after.get("maintainpro_refresh");
    const csrf = after.get("maintainpro_csrf");
    const accessGone = !access || !access.value || access.expires * 1000 < Date.now();
    const refreshGone = !refresh || !refresh.value || refresh.expires * 1000 < Date.now();
    const csrfGone = !csrf || !csrf.value || csrf.expires * 1000 < Date.now();
    expect(accessGone).toBeTruthy();
    expect(refreshGone).toBeTruthy();
    expect(csrfGone).toBeTruthy();

    await navigateToProtectedRouteAndExpectLogin(page, "/work-orders");
  });
});
