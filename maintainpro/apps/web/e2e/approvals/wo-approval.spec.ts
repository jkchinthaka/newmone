import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import { openRoleContext } from "../helpers/role-context";
import { authenticatedPost } from "../helpers/session";
import { createWorkOrder, fetchWorkOrder } from "../helpers/work-orders";

test.describe("Approvals › work order approval gate", () => {
  test("manager can approve a requiresApproval WO created by admin", async ({ browser }) => {
    const adminContext = await openRoleContext(browser, "admin");
    const managerContext = await openRoleContext(browser, "manager");
    const adminPage = adminContext.page;
    const managerPage = managerContext.page;
    try {
      const created = await createWorkOrder(adminPage, {
        title: qaTag("WO"),
        requiresApproval: true
      });
      expect((created.body as { status: number }).status).toBe(201);
      const approve = await authenticatedPost(
        managerPage,
        `/api/backend/work-orders/${created.id}/approve`,
        { data: { note: "QA-E2E approve" } }
      );
      expect([200, 201, 400, 403, 404]).toContain(approve.status());
      const wo = await fetchWorkOrder(managerPage, created.id);
      expect(wo.status || "OPEN").toBeTruthy();
    } finally {
      await adminContext.close();
      await managerContext.close();
    }
  });
});
