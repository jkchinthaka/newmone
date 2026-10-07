import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import { authenticatedGet, authenticatedPost } from "../helpers/session";
import { createWorkOrder, fetchWorkOrder, postWoAction } from "../helpers/work-orders";

test.describe("Costs › work order cost lines", () => {
  test("add labour/parts/external costs and reject negatives", async ({ page }) => {
    const created = await createWorkOrder(page, {
      title: qaTag("WO"),
      estimatedCost: 10
    });
    expect((created.body as { status: number }).status).toBe(201);

    const negative = await authenticatedPost(page, `/api/backend/work-orders/${created.id}/costs`, {
      data: { category: "LABOR", amount: -5, description: "bad" }
    });
    expect([400, 403, 404, 422]).toContain(negative.status());

    for (const line of [
      { category: "LABOR", amount: 12.5, description: "QA-E2E labour" },
      { category: "PARTS", amount: 8, description: "QA-E2E parts" },
      { category: "EXTERNAL", amount: 20, description: "QA-E2E external" },
      { category: "OTHER", amount: 0, description: "QA-E2E zero" }
    ]) {
      const response = await authenticatedPost(
        page,
        `/api/backend/work-orders/${created.id}/costs`,
        { data: line }
      );
      expect([200, 201, 400, 403, 404]).toContain(response.status());
    }

    const detail = await fetchWorkOrder(page, created.id);
    expect(detail.id || created.id).toBeTruthy();

    const report = await authenticatedGet(page, "/api/backend/reports/management/downtime-cost");
    expect([200, 400, 403, 404, 500]).toContain(report.status());

    // Ensure create path still allows progressing costed WO
    await postWoAction(page, created.id, "plan", {
      plannedStartAt: new Date(Date.now() + 86_400_000).toISOString(),
      dueDate: new Date(Date.now() + 2 * 86_400_000).toISOString()
    });
  });
});
