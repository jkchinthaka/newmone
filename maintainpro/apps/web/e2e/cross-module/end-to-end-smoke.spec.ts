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
import {
  clearTechnicianActiveSessions,
  expectWorkOrderStatus,
  fetchWorkOrder,
  postWoAction,
  resolveTechnicianIdFromTechSession,
  runTechnicianExecution,
  workOrderId
} from "../helpers/work-orders";

/**
 * Critical business path (API-assisted with role storageState):
 * admin request → manager triage/approve/convert → plan → assign →
 * tech start → hold/resume → complete → manager verify → close.
 *
 * Does not weaken business rules (QR, labour session, SoD).
 */
test.describe("Cross-module › request → WO → execute critical path", () => {
  test("admin request → manager convert → tech complete → manager verify/close", async ({
    browser
  }) => {
    const admin = await openRoleContext(browser, "admin");
    const manager = await openRoleContext(browser, "manager");
    const tech = await openRoleContext(browser, "tech");
    const adminPage = admin.page;
    const managerPage = manager.page;
    const techPage = tech.page;

    try {
      const req = await createMaintenanceRequest(adminPage, {
        description: `${qaTag("REQ")} cross-module critical path`
      });
      expect(req.status, JSON.stringify(req.json)).toBe(201);
      expect(req.id.length).toBeGreaterThan(0);

      const review = await startReview(managerPage, req.id);
      expect([200, 201, 403]).toContain(review.status());
      if (review.status() === 403) {
        const adminReview = await startReview(adminPage, req.id);
        expect([200, 201]).toContain(adminReview.status());
      }

      const triage = await triageRequest(managerPage, req.id, { reason: "QA-E2E critical path" });
      expect([200, 201]).toContain(triage.status());

      const approve = await approveRequest(managerPage, req.id);
      expect([200, 201]).toContain(approve.status());

      const converted = await convertRequestToWorkOrder(managerPage, req.id, qaTag("WO"));
      expect(converted.status, JSON.stringify(converted.json)).toBeGreaterThanOrEqual(200);
      expect(converted.status).toBeLessThan(300);
      const woId = workOrderId(converted.json);
      expect(woId.length, JSON.stringify(converted.json)).toBeGreaterThan(0);

      const requestAfter = await fetchRequest(managerPage, req.id);
      expect(String(requestAfter.status || "").toUpperCase()).toMatch(
        /CONVERTED|CLOSED|APPROVED|COMPLETED/
      );

      const plan = await postWoAction(managerPage, woId, "plan", {
        plannedStartAt: new Date(Date.now() + 86_400_000).toISOString(),
        dueDate: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        estimatedHours: 1
      });
      expect(plan.status, JSON.stringify(plan.body)).toBe(200);

      const technicianId = await resolveTechnicianIdFromTechSession(browser);
      const assign = await postWoAction(managerPage, woId, "assign", {
        technicianId,
        reason: "QA-E2E critical path assign"
      });
      expect(assign.status, JSON.stringify(assign.body)).toBe(200);

      await clearTechnicianActiveSessions(techPage);
      await runTechnicianExecution(techPage, woId, {
        holdResume: true,
        completionNote: "QA-E2E cross complete"
      });
      await expectWorkOrderStatus(techPage, woId, "TECHNICIAN_COMPLETED");

      // SoD: technician must not verify own completion
      const techVerify = await postWoAction(techPage, woId, "verify-supervisor", {
        verificationNote: "should fail"
      });
      expect([401, 403]).toContain(techVerify.status);

      const verify = await postWoAction(managerPage, woId, "verify-supervisor", {
        verificationNote: "QA-E2E ok",
        actualCost: 1,
        actualHours: 1
      });
      expect(verify.status, JSON.stringify(verify.body)).toBe(200);
      const verified = await fetchWorkOrder(managerPage, woId);
      expect(verified.status).toBe("VERIFIED");
      expect(String(verified.verificationStatus || "").toUpperCase()).toBe("VERIFIED");
      expect(String(verified.verifiedById || "")).toBeTruthy();

      const close = await postWoAction(managerPage, woId, "close", { note: "QA-E2E close" });
      expect(close.status, JSON.stringify(close.body)).toBe(200);
      await expectWorkOrderStatus(managerPage, woId, "CLOSED");

      // Return to service when asset-linked (best-effort; do not fail suite if policy blocks).
      const closed = await fetchWorkOrder(managerPage, woId);
      if (closed.assetId) {
        const rts = await authenticatedReturnToService(managerPage, woId);
        expect([200, 201, 400, 403, 409]).toContain(rts);
      }
    } finally {
      await admin.close();
      await manager.close();
      await tech.close();
    }
  });
});

async function authenticatedReturnToService(page: import("@playwright/test").Page, woId: string) {
  const { authenticatedPost } = await import("../helpers/session");
  const response = await authenticatedPost(page, `/api/backend/work-orders/${woId}/return-to-service`, {
    data: { note: "QA-E2E return to service" }
  });
  return response.status();
}
