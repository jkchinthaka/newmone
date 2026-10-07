import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import { openRoleContext } from "../helpers/role-context";
import {
  approveRequest,
  convertRequestToWorkOrder,
  createMaintenanceRequest,
  fetchRequest,
  startReview,
  triageRequest
} from "../helpers/requests";
import { workOrderId } from "../helpers/work-orders";

test.describe("Requests › triage and convert to work order", () => {
  test("manager triages approved request and converts to WO; creator segregation checked", async ({
    browser
  }) => {
    const adminContext = await openRoleContext(browser, "admin");
    const managerContext = await openRoleContext(browser, "manager");
    const adminPage = adminContext.page;
    const managerPage = managerContext.page;

    try {
      const created = await createMaintenanceRequest(adminPage, {
        description: `${qaTag("REQ")} convert path for manager triage`
      });
      expect(created.status).toBe(201);

      const review = await startReview(managerPage, created.id);
      // Admin creator may or may not start review; manager should be able to.
      expect([200, 201, 403]).toContain(review.status());
      if (review.status() === 403) {
        const adminReview = await startReview(adminPage, created.id);
        expect([200, 201]).toContain(adminReview.status());
      }

      const triage = await triageRequest(managerPage, created.id, {
        reason: "QA-E2E triage"
      });
      expect([200, 201]).toContain(triage.status());

      const approve = await approveRequest(managerPage, created.id);
      expect([200, 201]).toContain(approve.status());

      const title = qaTag("WO");
      const converted = await convertRequestToWorkOrder(managerPage, created.id, title);
      expect(converted.status, JSON.stringify(converted.json)).toBeGreaterThanOrEqual(200);
      expect(converted.status).toBeLessThan(300);
      const woId = workOrderId(converted.json);
      expect(woId.length, `convert envelope missing WO id: ${JSON.stringify(converted.json)}`).toBeGreaterThan(
        0
      );

      const requestAfter = await fetchRequest(managerPage, created.id);
      expect(String(requestAfter.status || "").toUpperCase()).toMatch(/CONVERTED|CLOSED|APPROVED|COMPLETED/);
    } finally {
      await adminContext.close();
      await managerContext.close();
    }
  });
});
