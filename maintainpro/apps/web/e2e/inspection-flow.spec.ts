import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function seedPassword() {
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!fs.existsSync(envPath)) return "";
  const env = fs.readFileSync(envPath, "utf8");
  const match = env.match(/^MAINTAINPRO_SEED_PASSWORD=(.*)$/m);
  return match?.[1]?.trim().replace(/^"|"$/g, "") ?? "";
}

test.describe("inspection signed-in smoke", () => {
  test("opens inspections after login", async ({ page }) => {
    const password = seedPassword();
    test.skip(!password, "Local seed password is not available");

    await page.goto("/login");
    await page.locator("#login-email").fill("admin@maintainpro.local");
    await page.locator("#login-password").fill(password);
    const login = page.waitForResponse(
      (response) => response.url().includes("/auth/login") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    expect((await login).status()).toBe(200);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/maintenance/inspections");
    await expect(page.getByRole("heading", { name: "Inspections" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Inspection" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/maintenance/inspections");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 8
    );
    expect(overflow).toBe(false);
  });
});
