import { expect, type Page } from "@playwright/test";

/**
 * Post-logout protected navigation is a client-side redirect race, not middleware.
 * Dashboard layout (app/(dashboard)/layout.tsx) calls router.replace("/login?...")
 * when the session is expired. Playwright page.goto("/work-orders") can therefore
 * observe net::ERR_ABORTED when that client redirect cancels the document load,
 * especially under mobile-smoke. Treat ERR_ABORTED as acceptable only when the
 * final URL is the login page; re-throw every other failure.
 */
export async function navigateToProtectedRouteAndExpectLogin(
  page: Page,
  protectedPath = "/work-orders"
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(protectedPath, { waitUntil: "domcontentloaded" }).catch((error: unknown) => {
        const message = String(error);
        if (
          !message.includes("net::ERR_ABORTED") &&
          !message.includes("frame was detached") &&
          !message.includes("Navigation interrupted")
        ) {
          throw error;
        }
      });

      await page.waitForURL(/\/login(?:\?|$)/, { timeout: 15_000 });
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      await expect(page.locator("#login-email")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

      // Protected work-order shell must not remain visible after logout redirect.
      await expect(page.getByText(/\d+\s+work order\(s\) shown/i)).not.toBeVisible();
      await expect(page.getByRole("heading", { name: /work orders/i })).not.toBeVisible();
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(400);
    }
  }
  throw lastError;
}
