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

test.describe("reliability signed-in policy", () => {
  test("saves policy from a draft and opens an RCA record", async ({ page }) => {
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

    await page.goto("/maintenance/reliability");
    await expect(page.getByRole("heading", { name: "Reliability" })).toBeVisible();
    const windowField = page.getByRole("spinbutton", { name: /Repeat failure window/i });
    const original = await windowField.inputValue();
    await windowField.fill(String(Number(original) === 90 ? 89 : 90));
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText("Unsaved changes")).toHaveCount(0);
    await expect(windowField).toHaveValue(original);

    await page.getByRole("radio", { name: "Require manager review" }).check();
    await expect(page.getByText(/manager review required/)).toBeVisible();
    await page.getByRole("button", { name: "Save Policy" }).click();
    await expect(page.getByText("Unsaved changes")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("radio", { name: "Require manager review" })).toBeChecked();

    await page.getByRole("radio", { name: "Flag only" }).check();
    await windowField.fill(original);
    await page.getByRole("button", { name: "Save Policy" }).click();
    await expect(page.getByText("Unsaved changes")).toHaveCount(0);

    await page.getByRole("tab", { name: "Repeat failures" }).click();
    await expect(page).toHaveURL(/tab=repeats/);
    await expect(page.getByText(/No repeat failures detected|Fault code|couldn't load repeat failures/i)).toBeVisible();

    await page.getByRole("tab", { name: "RCA / CAPA" }).click();
    await page.getByPlaceholder("Problem statement").fill("Reliability phase 1 verification");
    await page.getByRole("button", { name: "Create RCA" }).click();
    await expect(page.getByRole("heading", { name: /RCA / })).toBeVisible();
    await page.getByPlaceholder("Action").fill("Inspect the bearing");
    await page.getByRole("button", { name: "Add CAPA" }).click();
    await expect(page.getByText("Inspect the bearing")).toBeVisible();
    await page.getByRole("button", { name: "Record effectiveness" }).click();
    await expect(page.getByText("Current: EFFECTIVE")).toBeVisible();
  });
});
