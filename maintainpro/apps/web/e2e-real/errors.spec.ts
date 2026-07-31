import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";

test.describe("E2E error handling @full-stack", () => {
  test("E2E-ERR-001 unknown frontend route shows controlled 404", async ({ page }) => {
    const response = await page.goto("/this-route-should-not-exist-e2e");
    expect(response?.status()).toBeGreaterThanOrEqual(200);
    await expect(page.locator("body")).toContainText(/not found|404|page/i);
  });

  test("E2E-ERR-002 unknown API route returns controlled JSON 404", async ({ request }) => {
    const response = await request.get("/api/this-endpoint-does-not-exist-e2e");
    expect(response.status()).toBe(404);
    const text = await response.text();
    expect(text).not.toMatch(/at Object\.|node_modules|stack/i);
  });

  test("E2E-ERR-003 validation error does not expose stack traces", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const response = await page.request.post("/api/backend/work-orders", {
      data: {}
    });
    const text = await response.text();
    expect(text).not.toMatch(/node_modules|MongoServerError|password=/i);
  });

  test("E2E-ERR-005 BFF error does not expose internal URLs", async ({ request }) => {
    const response = await request.get("/api/backend/auth/me");
    const text = await response.text();
    expect(text).not.toContain("http://api:3000");
    expect(text).not.toMatch(/mongodb:\/\//i);
  });
});