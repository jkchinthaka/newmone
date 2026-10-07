import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import { assertNoTokensInBody } from "../helpers/session";
import {
  createWorkOrder,
  fetchWorkOrder,
  resolveAssetId,
  workOrderId
} from "../helpers/work-orders";

function futureIso(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

test.describe("Work orders › creation validation", () => {
  test("valid create with asset, priority, future dates, and zero cost", async ({ page }) => {
    const title = qaTag("WO");
    const created = await createWorkOrder(page, {
      title,
      priority: "HIGH",
      estimatedCost: 0,
      plannedStartAt: futureIso(1),
      plannedEndAt: futureIso(2),
      dueDate: futureIso(3)
    });
    expect(created.body).toBeTruthy();
    const status = (created.body as { status: number }).status;
    expect(status, JSON.stringify(created.body)).toBe(201);
    expect(created.id.length).toBeGreaterThan(0);
    assertNoTokensInBody((created.body as { json: unknown }).json);

    const wo = await fetchWorkOrder(page, created.id);
    expect(wo.title).toContain("QA-E2E-WO");
    expect(wo.status).toBe("OPEN");
    expect(wo.assetId || (await resolveAssetId(page))).toBeTruthy();
  });

  test("whitespace title is rejected", async ({ page }) => {
    const created = await createWorkOrder(page, { title: "   " });
    const status = (created.body as { status: number }).status;
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("negative cost is rejected", async ({ page }) => {
    const created = await createWorkOrder(page, {
      title: qaTag("WO"),
      estimatedCost: -12
    });
    const status = (created.body as { status: number }).status;
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("invalid date order is rejected", async ({ page }) => {
    const created = await createWorkOrder(page, {
      title: qaTag("WO"),
      plannedStartAt: futureIso(5),
      plannedEndAt: futureIso(1)
    });
    const status = (created.body as { status: number }).status;
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("past due date is rejected where prohibited", async ({ page }) => {
    const past = new Date();
    past.setDate(past.getDate() - 2);
    const created = await createWorkOrder(page, {
      title: qaTag("WO"),
      dueDate: past.toISOString()
    });
    const status = (created.body as { status: number }).status;
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("missing asset/vehicle/location is rejected", async ({ page }) => {
    const { authenticatedPost, getAuthenticatedUser } = await import("../helpers/session");
    const user = await getAuthenticatedUser(page);
    const response = await authenticatedPost(page, "/api/backend/work-orders", {
      data: {
        title: qaTag("WO"),
        description: "missing target",
        priority: "MEDIUM",
        type: "CORRECTIVE",
        createdById: user.id
      }
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(workOrderId(await response.json().catch(() => ({}))).length).toBe(0);
  });
});
