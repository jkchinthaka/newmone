import { expect, test } from "../fixtures/qa";
import { assertNoRuntimeOverlay } from "../helpers/session";

test.describe("Smoke › authenticated shell", () => {
  test("action-center loads without runtime overlay", async ({ page }) => {
    const response = await page.goto("/action-center");
    expect(response?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
    await assertNoRuntimeOverlay(page);
    await expect(page.locator("body")).toBeVisible();
    await expect(
      page.getByRole("heading").or(page.getByRole("navigation")).or(page.locator("main")).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("maintenance jobs page loads", async ({ page }) => {
    const response = await page.goto("/maintenance/jobs");
    expect(response?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
    await assertNoRuntimeOverlay(page);
  });

  test("primary nav reaches work orders", async ({ page }) => {
    await page.goto("/action-center");
    await assertNoRuntimeOverlay(page);
    const woLink = page.getByRole("link", { name: /work orders|jobs|maintenance/i }).first();
    if (await woLink.count()) {
      await woLink.click();
      await expect(page).not.toHaveURL(/\/login/);
      await assertNoRuntimeOverlay(page);
    } else {
      await page.goto("/work-orders");
      await expect(page).not.toHaveURL(/\/login/);
      await assertNoRuntimeOverlay(page);
    }
  });
});
