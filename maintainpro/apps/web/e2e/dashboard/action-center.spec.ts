import { expect, test } from "../fixtures/qa";
import { assertNoRuntimeOverlay, authenticatedGet } from "../helpers/session";

test.describe("Dashboard › action center", () => {
  test("home loads and queue summary is reachable", async ({ page }) => {
    await page.goto("/action-center");
    await expect(page).not.toHaveURL(/\/login/);
    await assertNoRuntimeOverlay(page);

    const queues = await authenticatedGet(page, "/api/backend/work-orders/queues");
    expect([200, 403]).toContain(queues.status());
  });
});
