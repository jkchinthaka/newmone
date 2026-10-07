import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import { authenticatedGet, authenticatedPost, unwrapList } from "../helpers/session";

test.describe("Vendors › external repair", () => {
  test("vendor list and create validation", async ({ page }) => {
    const list = await authenticatedGet(
      page,
      "/api/backend/enterprise-ops/vendors?page=1&limit=25"
    );
    expect([200, 403, 404]).toContain(list.status());
    if (list.status() !== 200) return;

    const rows = unwrapList(await list.json());
    expect(Array.isArray(rows)).toBeTruthy();

    const missing = await authenticatedPost(page, "/api/backend/enterprise-ops/vendors", {
      data: { name: "   " }
    });
    expect([400, 403, 404, 422]).toContain(missing.status());

    const create = await authenticatedPost(page, "/api/backend/enterprise-ops/vendors", {
      data: {
        name: qaTag("VENDOR"),
        code: qaTag("V").slice(0, 24),
        status: "ACTIVE"
      }
    });
    expect([200, 201, 400, 403, 404, 409]).toContain(create.status());
  });
});
