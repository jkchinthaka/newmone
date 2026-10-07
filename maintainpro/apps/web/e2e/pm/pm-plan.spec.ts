import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import { authenticatedGet, authenticatedPost, unwrapList } from "../helpers/session";
import { resolveAssetId } from "../helpers/work-orders";

test.describe("PM › plan create and due evaluation", () => {
  test("rejects interval 0 and negative interval; accepts valid plan", async ({ page }) => {
    const assetId = await resolveAssetId(page);
    const code = qaTag("PM").slice(0, 40);

    const zero = await authenticatedPost(page, "/api/backend/planning/pm-plans", {
      data: {
        code: `${code}-Z`,
        name: `${code} zero`,
        assetId,
        status: "ACTIVE",
        triggers: [{ kind: "CALENDAR", intervalDays: 0 }]
      }
    });
    expect(zero.status()).toBeGreaterThanOrEqual(400);

    const negative = await authenticatedPost(page, "/api/backend/planning/pm-plans", {
      data: {
        code: `${code}-N`,
        name: `${code} negative`,
        assetId,
        status: "ACTIVE",
        triggers: [{ kind: "CALENDAR", intervalDays: -3 }]
      }
    });
    expect(negative.status()).toBeGreaterThanOrEqual(400);

    const valid = await authenticatedPost(page, "/api/backend/planning/pm-plans", {
      data: {
        code,
        name: `${code} valid`,
        assetId,
        status: "ACTIVE",
        priority: "MEDIUM",
        workType: "PREVENTIVE",
        triggers: [{ kind: "CALENDAR", intervalDays: 30 }]
      }
    });
    // Keep failing test if API shape differs — do not weaken business rules.
    expect([200, 201]).toContain(valid.status());
    const body = await valid.json();
    const id = String(body?.data?.id || body?.data?._id || body?.id || "").trim();
    expect(id.length).toBeGreaterThan(0);

    const due = await authenticatedGet(page, "/api/backend/planning/due-work");
    expect([200, 403]).toContain(due.status());

    const auto = await authenticatedPost(page, `/api/backend/planning/pm-plans/${id}/auto-wo`, {
      data: {}
    });
    expect([200, 201, 400, 409]).toContain(auto.status());

    const list = await authenticatedGet(page, "/api/backend/planning/pm-plans?page=1&limit=50");
    expect(list.status()).toBe(200);
    const rows = unwrapList(await list.json());
    expect(rows.some((row) => String((row as { code?: string }).code || "") === code)).toBeTruthy();
  });

  test("asset is required for ACTIVE PM plan", async ({ page }) => {
    const response = await authenticatedPost(page, "/api/backend/planning/pm-plans", {
      data: {
        code: qaTag("PM").slice(0, 40),
        name: "QA-E2E missing asset",
        status: "ACTIVE",
        triggers: [{ kind: "CALENDAR", intervalDays: 14 }]
      }
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
