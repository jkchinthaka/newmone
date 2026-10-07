import { expect, test } from "@playwright/test";
import { e2eApiUrl } from "../helpers/env";
import { assertNoRuntimeOverlay } from "../helpers/session";

test.describe("Smoke › login page", () => {
  test("login page loads with email and password fields", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.ok() || response?.status() === 200).toBeTruthy();
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible();
    await assertNoRuntimeOverlay(page);
  });

  test("API health endpoint is healthy", async ({ request }) => {
    const response = await request.get(`${e2eApiUrl()}/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    const status = body?.data?.status || body?.status;
    expect(String(status).toLowerCase()).toMatch(/healthy|ok|degraded/);
  });
});
