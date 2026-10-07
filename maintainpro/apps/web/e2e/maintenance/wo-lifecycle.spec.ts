import type { Browser } from "@playwright/test";
import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import { openRoleContext } from "../helpers/role-context";
import { getAuthenticatedUser } from "../helpers/session";
import {
  clearTechnicianActiveSessions,
  createWorkOrder,
  expectWorkOrderStatus,
  fetchWorkOrder,
  postWoAction,
  resolveTechnicianIdFromTechSession,
  verifyWorkOrderQr
} from "../helpers/work-orders";

async function pageAs(browser: Browser, role: "admin" | "manager" | "tech") {
  return openRoleContext(browser, role);
}

function futureIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

test.describe.serial("WO lifecycle › OPEN→…→CLOSED across roles", () => {
  let workOrderId = "";
  let title = "";

  test("manager creates OPEN work order", async ({ browser }) => {
    const { page, close } = await pageAs(browser, "manager");
    try {
      title = qaTag("WO");
      const created = await createWorkOrder(page, {
        title,
        priority: "MEDIUM",
        estimatedCost: 25,
        plannedStartAt: futureIso(1),
        plannedEndAt: futureIso(2),
        dueDate: futureIso(3)
      });
      expect((created.body as { status: number }).status, JSON.stringify(created.body)).toBe(201);
      workOrderId = created.id;
      await expectWorkOrderStatus(page, workOrderId, "OPEN");
    } finally {
      await close();
    }
  });

  test("manager plans work order → PLANNED", async ({ browser }) => {
    const { page, close } = await pageAs(browser, "manager");
    try {
      const result = await postWoAction(page, workOrderId, "plan", {
        plannedStartAt: futureIso(1),
        dueDate: futureIso(3),
        estimatedHours: 2
      });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      await expectWorkOrderStatus(page, workOrderId, "PLANNED");
    } finally {
      await close();
    }
  });

  test("manager assigns technician → ASSIGNED", async ({ browser }) => {
    const { page, close } = await pageAs(browser, "manager");
    try {
      const technicianId = await resolveTechnicianIdFromTechSession(browser);
      const result = await postWoAction(page, workOrderId, "assign", {
        technicianId,
        reason: "QA-E2E assignment"
      });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      const wo = await fetchWorkOrder(page, workOrderId);
      expect(wo.status).toBe("ASSIGNED");
      expect(String(wo.technicianId || wo.assignedToId || "")).toBeTruthy();
    } finally {
      await close();
    }
  });

  test("technician starts → IN_PROGRESS", async ({ browser }) => {
    const { page, close } = await pageAs(browser, "tech");
    try {
      await clearTechnicianActiveSessions(page);
      const result = await postWoAction(page, workOrderId, "start", {});
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      await expectWorkOrderStatus(page, workOrderId, "IN_PROGRESS");
    } finally {
      await close();
    }
  });

  test("technician holds → ON_HOLD then resumes → IN_PROGRESS", async ({ browser }) => {
    const { page, close } = await pageAs(browser, "tech");
    try {
      const hold = await postWoAction(page, workOrderId, "hold", {
        holdReasonCode: "WAITING_PARTS",
        delayReason: "QA-E2E waiting for part",
        notes: "QA-E2E hold"
      });
      expect(hold.status, JSON.stringify(hold.body)).toBe(200);
      await expectWorkOrderStatus(page, workOrderId, "ON_HOLD");

      const resume = await postWoAction(page, workOrderId, "resume", {});
      expect(resume.status, JSON.stringify(resume.body)).toBe(200);
      await expectWorkOrderStatus(page, workOrderId, "IN_PROGRESS");
    } finally {
      await close();
    }
  });

  test("technician completes → TECHNICIAN_COMPLETED", async ({ browser }) => {
    const { page, close } = await pageAs(browser, "tech");
    try {
      const qr = await verifyWorkOrderQr(page, workOrderId);
      expect([200, 201]).toContain(qr.status);
      const result = await postWoAction(page, workOrderId, "complete-technician", {
        completionNote: "QA-E2E technician completion note"
      });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      await expectWorkOrderStatus(page, workOrderId, "TECHNICIAN_COMPLETED");
    } finally {
      await close();
    }
  });

  test("manager verifies → VERIFIED with verifier metadata", async ({ browser }) => {
    const { page, close } = await pageAs(browser, "manager");
    try {
      const manager = await getAuthenticatedUser(page);
      const result = await postWoAction(page, workOrderId, "verify-supervisor", {
        verificationNote: "QA-E2E verified",
        actualCost: 25,
        actualHours: 1.5
      });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      const wo = await fetchWorkOrder(page, workOrderId);
      expect(wo.status).toBe("VERIFIED");
      expect(String(wo.verifiedById || "")).toBeTruthy();
      expect(String(wo.verifiedAt || "")).toBeTruthy();
      // Same-user maker-checker: if API stores verifier, it should be the manager actor.
      if (wo.verifiedById) {
        expect(String(wo.verifiedById)).toBe(manager.id);
      }
    } finally {
      await close();
    }
  });

  test("manager closes → CLOSED", async ({ browser }) => {
    const { page, close } = await pageAs(browser, "manager");
    try {
      const result = await postWoAction(page, workOrderId, "close", {
        note: "QA-E2E close"
      });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      await expectWorkOrderStatus(page, workOrderId, "CLOSED");
    } finally {
      await close();
    }
  });

  test("close without verification is blocked on a fresh WO", async ({ browser }) => {
    const { page, close } = await pageAs(browser, "manager");
    try {
      const created = await createWorkOrder(page, { title: qaTag("WO") });
      expect((created.body as { status: number }).status).toBe(201);
      const closeAttempt = await postWoAction(page, created.id, "close", {
        note: "invalid close"
      });
      expect(closeAttempt.status).toBeGreaterThanOrEqual(400);
    } finally {
      await close();
    }
  });
});
