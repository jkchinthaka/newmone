import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import { assertNoRuntimeOverlay, authenticatedPatch } from "../helpers/session";
import { createWorkOrder, fetchWorkOrder } from "../helpers/work-orders";

test.describe("Planning › schedule persistence", () => {
  test("open planning page and persist WO schedule via API", async ({ page }) => {
    await page.goto("/maintenance/plans");
    await assertNoRuntimeOverlay(page);

    const created = await createWorkOrder(page, { title: qaTag("WO") });
    expect((created.body as { status: number }).status).toBe(201);

    const start = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const end = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const patch = await authenticatedPatch(page, `/api/backend/work-orders/${created.id}`, {
      data: { plannedStartAt: start, plannedEndAt: end, dueDate: end }
    });
    expect([200, 201]).toContain(patch.status());

    const reloaded = await fetchWorkOrder(page, created.id);
    expect(String(reloaded.plannedStartAt || "")).toBeTruthy();

    // Reschedule must keep start < end/due — patching start alone can violate date order (400).
    const rescheduleStart = new Date(Date.now() + 4 * 86_400_000).toISOString();
    const rescheduleEnd = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const reschedule = await authenticatedPatch(page, `/api/backend/work-orders/${created.id}`, {
      data: {
        plannedStartAt: rescheduleStart,
        plannedEndAt: rescheduleEnd,
        dueDate: rescheduleEnd
      }
    });
    expect([200, 201]).toContain(reschedule.status());
    const after = await fetchWorkOrder(page, created.id);
    expect(String(after.plannedStartAt || "")).not.toEqual("");
  });
});
