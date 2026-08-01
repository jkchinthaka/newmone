import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  authenticatedGet,
  authenticatedMutationWithoutCsrf,
  CANONICAL_LOGOUT_SUCCESS_STATUS,
  cookieNamesPresent,
  logoutBrowserSession
} from "./helpers/browser-session";

/**
 * Safe session/CSRF diagnostic — reports statuses and cookie presence only.
 * Never prints emails, passwords, tokens, CSRF values, or cookie values.
 */
test.describe("E2E session diagnostic @full-stack @security @smoke", () => {
  test("SESSION-DIAG-001 browser vs isolated request cookie isolation", async ({ page, request }) => {
    const login = await loginViaUi(page, "admin-a");
    expect(login.loginResponse.status()).toBe(200);

    const names = await cookieNamesPresent(page);
    console.log(
      [
        `login_status=${login.loginResponse.status()}`,
        `browser_access_cookie=${names.access ? "yes" : "no"}`,
        `browser_refresh_cookie=${names.refresh ? "yes" : "no"}`,
        `browser_csrf_cookie=${names.csrf ? "yes" : "no"}`
      ].join(" ")
    );

    const isolatedMe = await request.get("/api/backend/auth/me");
    console.log(`isolated_request_auth_me_status=${isolatedMe.status()}`);
    expect(isolatedMe.status()).toBe(401);

    const browserMe = await authenticatedGet(page, "/api/backend/auth/me");
    console.log(`browser_context_auth_me_status=${browserMe.status()}`);
    expect(browserMe.status()).toBe(200);

    const missingCsrf = await authenticatedMutationWithoutCsrf(page, "/api/backend/auth/logout", {
      data: {}
    });
    console.log(`logout_missing_csrf_status=${missingCsrf.status()}`);
    expect(missingCsrf.status()).toBe(403);

    const logout = await logoutBrowserSession(page);
    console.log(`logout_valid_csrf_status=${logout.status()}`);
    expect(logout.status()).toBe(CANONICAL_LOGOUT_SUCCESS_STATUS);

    const postMe = await authenticatedGet(page, "/api/backend/auth/me");
    console.log(`post_logout_auth_me_status=${postMe.status()}`);
    expect(postMe.status()).toBe(401);

    const after = await cookieNamesPresent(page);
    const cleared = !after.access && !after.refresh && !after.csrf;
    // Cookies may remain with empty/expired values depending on jar semantics.
    console.log(`cookies_cleared_names_absent=${cleared ? "yes" : "partial_or_expired"}`);
  });
});