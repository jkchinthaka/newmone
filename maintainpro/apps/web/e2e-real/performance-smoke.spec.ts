import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";

test.describe("E2E performance smoke @full-stack @smoke", () => {
  test("health p95-ish single probe under 500ms in disposable env", async ({ request }) => {
    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const started = Date.now();
      const response = await request.get("/api/health");
      expect(response.status()).toBe(200);
      samples.push(Date.now() - started);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
    expect(p95).toBeLessThan(500);
  });

  test("login completes within timeout and dashboard has content", async ({ page }) => {
    const started = Date.now();
    await loginViaUi(page, "admin-a");
    expect(Date.now() - started).toBeLessThan(30_000);
    await page.goto("/");
    await expect(page.locator("body")).not.toBeEmpty();
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});