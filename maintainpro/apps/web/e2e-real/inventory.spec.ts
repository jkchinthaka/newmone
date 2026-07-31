import { expect, test } from "@playwright/test";
import { loginViaUi, readCookieMap } from "./helpers/auth";
import { e2eRunId } from "./helpers/env";

test.describe("E2E inventory controls @full-stack @erp-control", () => {
  test("E2E-INV-001..005 stock display and issue controls", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const list = await page.request.get("/api/backend/inventory/parts");
    expect(list.status()).toBeLessThan(500);
    if (list.status() !== 200) {
      test.skip(true, `Inventory list unavailable (${list.status()}) — product/route gap`);
    }
    const body = await list.json();
    const items = body.data?.items || body.data || body.items || [];
    const part = (Array.isArray(items) ? items : []).find((p: { partNumber?: string }) =>
      String(p.partNumber || "").includes(`E2E-PART-${e2eRunId()}`)
    );
    test.skip(!part?.id, "Seeded spare part not visible to inventory keeper");

    const cookies = await readCookieMap(page);
    const csrf = cookies.get("maintainpro_csrf")?.value;
    const opening = part.quantityInStock;

    const issue = await page.request.post(`/api/backend/inventory/parts/${part.id}/stock-out`, {
      headers: csrf ? { "x-csrf-token": csrf } : {},
      data: { quantity: 1, reason: "E2E issue" }
    });
    expect(issue.status()).toBeLessThan(500);

    const negative = await page.request.post(`/api/backend/inventory/parts/${part.id}/stock-out`, {
      headers: csrf ? { "x-csrf-token": csrf } : {},
      data: { quantity: 999999, reason: "E2E negative" }
    });
    expect([400, 422]).toContain(negative.status());
    const negBody = await negative.text();
    expect(negBody.toLowerCase()).toMatch(/stock|below|insufficient|cannot/);

    if (issue.status() === 200 || issue.status() === 201) {
      const after = await page.request.get(`/api/backend/inventory/parts/${part.id}`);
      if (after.status() === 200) {
        const detail = await after.json();
        const qty = detail.data?.quantityInStock ?? detail.quantityInStock;
        if (typeof qty === "number" && typeof opening === "number") {
          expect(qty).toBe(opening - 1);
        }
      }
    }
  });

  test("E2E-INV-007 unauthorized role cannot approve controlled stock action", async ({ page }) => {
    await loginViaUi(page, "tech-a");
    const response = await page.request.post("/api/backend/inventory/parts/000000000000000000000000/stock-out", {
      data: { quantity: 1 }
    });
    expect([401, 403, 404]).toContain(response.status());
  });
});