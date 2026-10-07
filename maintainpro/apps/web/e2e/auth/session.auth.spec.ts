import { expect, test } from "../fixtures/qa";
import { loginViaUi } from "../helpers/auth";
import {
  assertNoRuntimeOverlay,
  authenticatedGet,
  cookiePresence,
  logoutViaUi
} from "../helpers/session";

test.describe("Auth › authenticated session", () => {
  test("session persists across refresh without false logout", async ({ page }) => {
    await page.goto("/action-center");
    await expect(page).not.toHaveURL(/\/login/);
    const before = await cookiePresence(page);
    expect(before.access).toBe(true);

    await page.reload();
    await expect(page).not.toHaveURL(/reason=session_expired/);
    await expect(page).not.toHaveURL(/\/login/);
    await assertNoRuntimeOverlay(page);

    const me = await authenticatedGet(page, "/api/backend/auth/me");
    expect(me.status()).toBe(200);
    const after = await cookiePresence(page);
    expect(after.access || after.refresh).toBe(true);
  });

  test("logout clears session and blocks protected route", async ({ browser }) => {
    // Isolate from shared admin storageState: logging out the shared session
    // revokes its refresh token and poisons every later chromium-qa test.
    // Still a real login → logout → protected-route check (no auth bypass).
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "admin");
      await page.goto("/action-center");
      await expect(page).not.toHaveURL(/\/login/);
      await logoutViaUi(page);
      const me = await authenticatedGet(page, "/api/backend/auth/me");
      expect([401, 403]).toContain(me.status());
      // QA-E2E-AUTH-REDIRECT (class A): after cookies/local session are cleared, the app
      // must redirect protected routes to /login. Do not weaken this assertion.
      await page.goto("/action-center");
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    } finally {
      await context.close();
    }
  });
});
