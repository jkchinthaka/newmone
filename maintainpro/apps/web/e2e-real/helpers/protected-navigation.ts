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
  const loginRedirect = page.waitForURL(/\/login(?:\?|$)/, { timeout: 10_000 });

  const navigation = page.goto(protectedPath, { waitUntil: "commit" }).catch((error: unknown) => {
    const message = String(error);
    if (!message.includes("net::ERR_ABORTED")) {
      throw error;
    }
  });

  await Promise.all([navigation, loginRedirect]);

  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator("#login-email")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  // Protected work-order shell must not remain visible after logout redirect.
  await expect(page.getByText(/\d+\s+work order\(s\) shown/i)).not.toBeVisible();
  await expect(page.getByRole("heading", { name: /work orders/i })).not.toBeVisible();
}
