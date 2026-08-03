import { expect, type Page } from "@playwright/test";

/**
 * Verify that a logged-out browser cannot keep a protected page open.
 *
 * The dashboard shell performs a client-side redirect to /login. That redirect
 * can cancel the original page.goto() request, so ERR_ABORTED/frame-detached
 * errors are acceptable only while the browser is settling on the login page.
 */
export async function navigateToProtectedRouteAndExpectLogin(
  page: Page,
  protectedPath = "/work-orders"
): Promise<void> {
  await page.goto(protectedPath, { waitUntil: "commit" }).catch((error: unknown) => {
    const message = String(error);

    if (
      !message.includes("net::ERR_ABORTED") &&
      !message.toLowerCase().includes("frame was detached")
    ) {
      throw error;
    }

    return null;
  });

  await expect
    .poll(
      () => {
        try {
          return new URL(page.url()).pathname;
        } catch {
          return "";
        }
      },
      {
        timeout: 15_000,
        intervals: [100, 250, 500, 1_000]
      }
    )
    .toBe("/login");

  await expect(page.locator("#login-email")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({
    timeout: 15_000
  });

  // The protected work-order shell must not remain visible after logout.
  await expect(page.getByText(/\d+\s+work order\(s\) shown/i)).not.toBeVisible();
  await expect(page.getByRole("heading", { name: /work orders/i })).not.toBeVisible();
}
