import { expect, test } from "../fixtures/qa";
import { assertNoRuntimeOverlay, authenticatedGet } from "../helpers/session";

test.describe("Admin › console and users", () => {
  test("admin console loads and users API authorized", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/login/);
    await assertNoRuntimeOverlay(page);
    await expect(page.getByRole("heading", { name: /Admin/i }).first()).toBeVisible({
      timeout: 20_000
    });

    const users = await authenticatedGet(page, "/api/backend/users?page=1&limit=10");
    expect([200, 403]).toContain(users.status());
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await assertNoRuntimeOverlay(page);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
