import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import { openRoleContext } from "../helpers/role-context";
import { assertNoRuntimeOverlay, authenticatedGet } from "../helpers/session";
import {
  clearTechnicianActiveSessions,
  createWorkOrder,
  expectWorkOrderStatus,
  postWoAction,
  resolveTechnicianIdFromTechSession,
  runTechnicianExecution
} from "../helpers/work-orders";

test.describe("Technician workflow › My Jobs", () => {
  test("tech can execute assigned job but cannot verify/close", async ({ browser }) => {
    const managerContext = await openRoleContext(browser, "manager");
    const managerPage = managerContext.page;
    let workOrderId = "";
    try {
      const created = await createWorkOrder(managerPage, { title: qaTag("WO") });
      expect((created.body as { status: number }).status).toBe(201);
      workOrderId = created.id;
      const plan = await postWoAction(managerPage, workOrderId, "plan", {
        plannedStartAt: new Date(Date.now() + 86_400_000).toISOString(),
        dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString()
      });
      expect(plan.status).toBe(200);
      const technicianId = await resolveTechnicianIdFromTechSession(browser);
      const assign = await postWoAction(managerPage, workOrderId, "assign", {
        technicianId,
        reason: "QA-E2E assign"
      });
      expect(assign.status, JSON.stringify(assign.body)).toBe(200);
    } finally {
      await managerContext.close();
    }

    const techContext = await openRoleContext(browser, "tech");
    const techPage = techContext.page;
    try {
      await techPage.goto("/work-orders/my");
      await expect(techPage).not.toHaveURL(/\/login/);
      await assertNoRuntimeOverlay(techPage);

      await clearTechnicianActiveSessions(techPage);
      await runTechnicianExecution(techPage, workOrderId, {
        holdResume: true,
        completionNote: "QA-E2E done"
      });
      await expectWorkOrderStatus(techPage, workOrderId, "TECHNICIAN_COMPLETED");

      const verifyDenied = await postWoAction(techPage, workOrderId, "verify-supervisor", {
        verificationNote: "should fail"
      });
      expect([401, 403]).toContain(verifyDenied.status);

      const closeDenied = await postWoAction(techPage, workOrderId, "close", {
        note: "should fail"
      });
      expect([401, 403]).toContain(closeDenied.status);

      const queues = await authenticatedGet(techPage, "/api/backend/work-orders/queues");
      expect([200, 403]).toContain(queues.status());
    } finally {
      await techContext.close();
    }
  });
});
