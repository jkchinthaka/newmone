import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  authenticatedGet,
  authenticatedPatch,
  authenticatedPost,
  getAuthenticatedUserId
} from "./helpers/browser-session";
import { e2eRunId } from "./helpers/env";
import {
  assertNoAccessTokensInBody,
  buildValidWorkOrderPayload
} from "./helpers/work-order-payload";

type WorkOrderRecord = {
  id?: string;
  _id?: string;
  status?: string;
  approvalStatus?: string;
  title?: string;
  actualCost?: number;
  actualHours?: number;
  quantityInStock?: number;
};

function unwrapWorkOrder(body: unknown): WorkOrderRecord {
  const envelope = body as { data?: WorkOrderRecord };
  return (envelope.data || body) as WorkOrderRecord;
}

function workOrderIdFrom(body: unknown): string {
  const wo = unwrapWorkOrder(body);
  return String(wo.id || wo._id || "");
}

async function createApprovalPendingWorkOrder(
  browser: Browser,
  actor: "manager-a" | "admin-a" = "manager-a",
  titleSuffix = "pending"
): Promise<{ id: string; title: string }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginViaUi(page, actor);
    const title = `E2E WO LC ${titleSuffix} ${e2eRunId().slice(-8)}`;
    const base = await buildValidWorkOrderPayload(page, {
      title,
      type: "CORRECTIVE",
      priority: "MEDIUM"
    });
    const create = await authenticatedPost(page, "/api/backend/work-orders", {
      data: { ...base, requiresApproval: true }
    });
    expect(create.status()).toBe(201);
    const body = await create.json();
    assertNoAccessTokensInBody(body);
    const id = workOrderIdFrom(body);
    expect(id.length).toBeGreaterThan(0);
    return { id, title };
  } finally {
    await context.close();
  }
}

async function createAutoApprovedWorkOrder(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginViaUi(page, "manager-a");
    const base = await buildValidWorkOrderPayload(page, {
      title: `E2E WO LC unassigned ${e2eRunId().slice(-8)}`,
      type: "CORRECTIVE",
      priority: "MEDIUM"
    });
    const create = await authenticatedPost(page, "/api/backend/work-orders", {
      data: { ...base, requiresApproval: false }
    });
    expect(create.status()).toBe(201);
    const id = workOrderIdFrom(await create.json());
    expect(id.length).toBeGreaterThan(0);
    return id;
  } finally {
    await context.close();
  }
}

async function findTenantAPart(page: Page) {
  const list = await authenticatedGet(page, "/api/backend/inventory/parts");
  expect(list.status()).toBe(200);
  const body = await list.json();
  const items = body.data?.items || body.data || body.items || [];
  const part = (Array.isArray(items) ? items : []).find((p: { partNumber?: string }) =>
    String(p.partNumber || "").includes(`E2E-PART-${e2eRunId()}`)
  );
  expect(part?.id).toBeTruthy();
  return part as { id: string; quantityInStock: number; partNumber: string };
}

test.describe.serial("E2E work-order lifecycle @full-stack @security @erp-control", () => {
  let workOrderId = "";
  let lifecycleTitle = "";
  let stockIssueKey = "";
  let partId = "";
  let openingQty = 0;
  const actualCost = 175.5;
  const actualHours = 2.25;

  test("E2E-WO-LC-001 manager-a creates WO requiring approval", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "manager-a");
      lifecycleTitle = `E2E WO LC ${e2eRunId().slice(-8)}`;
      const base = await buildValidWorkOrderPayload(page, {
        title: lifecycleTitle,
        type: "CORRECTIVE",
        priority: "MEDIUM"
      });
      const create = await authenticatedPost(page, "/api/backend/work-orders", {
        data: { ...base, requiresApproval: true }
      });
      expect(create.status()).toBe(201);
      const body = await create.json();
      assertNoAccessTokensInBody(body);
      workOrderId = workOrderIdFrom(body);
      expect(workOrderId.length).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-LC-002 verify status OPEN and approvalStatus PENDING", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const detail = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}`);
    expect(detail.status()).toBe(200);
    const wo = unwrapWorkOrder(await detail.json());
    expect(wo.status).toBe("OPEN");
    expect(wo.approvalStatus).toBe("PENDING");
  });

  test("E2E-WO-LC-003 submit-for-approval when needed returns 200", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const submit = await authenticatedPost(
      page,
      `/api/backend/work-orders/${workOrderId}/submit-for-approval`,
      { data: { notes: "E2E submit for approval" } }
    );
    expect(submit.status()).toBe(200);
    const wo = unwrapWorkOrder(await submit.json());
    expect(wo.approvalStatus).toBe("PENDING");
  });

  test("E2E-WO-LC-004 admin-a approves; manager self-approve blocked with 403", async ({
    page,
    browser
  }) => {
    await loginViaUi(page, "manager-a");
    const selfApprove = await authenticatedPatch(
      page,
      `/api/backend/work-orders/${workOrderId}/approve`,
      { data: { notes: "self approve attempt" } }
    );
    expect(selfApprove.status()).toBe(403);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await loginViaUi(adminPage, "admin-a");
      const approve = await authenticatedPatch(
        adminPage,
        `/api/backend/work-orders/${workOrderId}/approve`,
        { data: { notes: "E2E admin approval" } }
      );
      expect(approve.status()).toBe(200);
      const wo = unwrapWorkOrder(await approve.json());
      expect(wo.approvalStatus).toBe("APPROVED");
    } finally {
      await adminContext.close();
    }
  });

  test("E2E-WO-LC-005 manager-a assigns tech-a via POST assign", async ({ page, browser }) => {
    const techContext = await browser.newContext();
    const techPage = await techContext.newPage();
    let technicianId = "";
    try {
      await loginViaUi(techPage, "tech-a");
      technicianId = await getAuthenticatedUserId(techPage);
    } finally {
      await techContext.close();
    }

    await loginViaUi(page, "manager-a");
    const assign = await authenticatedPost(page, `/api/backend/work-orders/${workOrderId}/assign`, {
      data: { technicianId }
    });
    expect(assign.status()).toBe(200);
    const wo = unwrapWorkOrder(await assign.json());
    expect(String(wo.status || "OPEN")).toMatch(/OPEN|ASSIGNED|IN_PROGRESS/);
  });

  test("E2E-WO-LC-006 manager-a updates planning fields via PATCH", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const plannedStartAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const plannedEndAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const patch = await authenticatedPatch(page, `/api/backend/work-orders/${workOrderId}`, {
      data: { plannedStartAt, plannedEndAt, estimatedHours: 3 }
    });
    expect(patch.status()).toBe(200);
  });

  test("E2E-WO-LC-007 tech-a starts IN_PROGRESS via PATCH status", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "tech-a");
      const start = await authenticatedPatch(page, `/api/backend/work-orders/${workOrderId}/status`, {
        data: { status: "IN_PROGRESS" }
      });
      expect(start.status()).toBe(200);
      const wo = unwrapWorkOrder(await start.json());
      expect(wo.status).toBe("IN_PROGRESS");
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-LC-008 tech-a POST notes returns 200", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "tech-a");
      const note = await authenticatedPost(page, `/api/backend/work-orders/${workOrderId}/notes`, {
        data: { note: "E2E lifecycle progress note" }
      });
      expect(note.status()).toBe(200);
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-LC-009 inventory-a stock-out linked to WO returns 200", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "inventory-a");
      const part = await findTenantAPart(page);
      partId = part.id;
      openingQty = Number(part.quantityInStock);
      stockIssueKey = `e2e-wo-lc-issue-${e2eRunId()}`;
      const issue = await authenticatedPost(
        page,
        `/api/backend/inventory/parts/${partId}/stock-out`,
        {
          data: {
            quantity: 1,
            workOrderId,
            notes: "E2E lifecycle stock issue",
            idempotencyKey: stockIssueKey
          }
        }
      );
      expect(issue.status()).toBe(200);
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-LC-010 stock issue deducts quantity exactly once", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "inventory-a");
      const beforeRes = await authenticatedGet(page, `/api/backend/inventory/parts/${partId}`);
      expect(beforeRes.status()).toBe(200);
      const qtyBefore = Number(unwrapWorkOrder(await beforeRes.json()).quantityInStock);

      const replay = await authenticatedPost(
        page,
        `/api/backend/inventory/parts/${partId}/stock-out`,
        {
          data: {
            quantity: 1,
            workOrderId,
            notes: "E2E lifecycle stock replay",
            idempotencyKey: stockIssueKey
          }
        }
      );
      expect(replay.status()).toBe(200);

      const afterRes = await authenticatedGet(page, `/api/backend/inventory/parts/${partId}`);
      expect(afterRes.status()).toBe(200);
      const qtyAfter = Number(unwrapWorkOrder(await afterRes.json()).quantityInStock);
      expect(qtyAfter).toBe(qtyBefore);
      expect(openingQty - 1).toBe(qtyBefore);
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-LC-011 evidence note path; photo evidence waived when storage off", async ({
    browser
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "tech-a");
      const evidence = await authenticatedPost(page, `/api/backend/work-orders/${workOrderId}/evidence`, {
        data: {
          evidenceType: "TECHNICIAN_NOTE",
          note: "E2E note-only evidence metadata"
        }
      });
      expect(evidence.status()).toBe(201);
      // Photo before/after requirements are waived when STORAGE_UPLOADS_ENABLED is off (Option A).
      // LC-012 proves technician completion succeeds without uploaded photos in that mode.
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-LC-012 tech-a technician completion with note cost hours", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "tech-a");
      const complete = await authenticatedPatch(page, `/api/backend/work-orders/${workOrderId}/status`, {
        data: {
          status: "COMPLETED",
          completionNote: "E2E technician completion note",
          actualCost,
          actualHours
        }
      });
      expect(complete.status()).toBe(200);
      const wo = unwrapWorkOrder(await complete.json());
      expect(wo.status).toBe("TECHNICIAN_COMPLETED");
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-LC-013 technician completion persists TECHNICIAN_COMPLETED", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const detail = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}`);
    expect(detail.status()).toBe(200);
    const wo = unwrapWorkOrder(await detail.json());
    expect(wo.status).toBe("TECHNICIAN_COMPLETED");
  });

  test("E2E-WO-LC-014 admin-a verify-supervisor returns 200", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "admin-a");
      const verify = await authenticatedPost(
        page,
        `/api/backend/work-orders/${workOrderId}/verify-supervisor`,
        { data: { verificationNote: "E2E supervisor verification" } }
      );
      expect(verify.status()).toBe(200);
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-LC-015 final status COMPLETED after supervisor verification", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const detail = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}`);
    expect(detail.status()).toBe(200);
    const wo = unwrapWorkOrder(await detail.json());
    expect(wo.status).toBe("COMPLETED");
  });

  test("E2E-WO-LC-016 actual cost and hours persist on GET", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const detail = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}`);
    expect(detail.status()).toBe(200);
    const wo = unwrapWorkOrder(await detail.json());
    expect(Number(wo.actualCost)).toBe(actualCost);
    expect(Number(wo.actualHours)).toBe(actualHours);
  });

  test("E2E-WO-LC-017 GET activity timeline returns 200", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const activity = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}/activity`);
    expect(activity.status()).toBe(200);
  });

  test("E2E-WO-LC-018 GET history returns 200 and WO remains COMPLETED", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const history = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}/history`);
    expect(history.status()).toBe(200);
    const detail = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}`);
    expect(detail.status()).toBe(200);
    expect(unwrapWorkOrder(await detail.json()).status).toBe("COMPLETED");
  });

  test("E2E-WO-LC-019 parts inventory linkage covered by stock issue", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const movements = await authenticatedGet(
      page,
      `/api/backend/inventory/parts/${partId}/movements`
    );
    expect(movements.status()).toBe(200);
    const rows = (await movements.json()).data || (await movements.json()) || [];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  test("E2E-WO-LC-020 list contains completed WO by title match", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const list = await authenticatedGet(page, "/api/backend/work-orders");
    expect(list.status()).toBe(200);
    const body = await list.json();
    const items = body.data?.items || body.data || body.items || [];
    const found = (Array.isArray(items) ? items : []).some(
      (wo: { title?: string; status?: string }) =>
        wo.title === lifecycleTitle && wo.status === "COMPLETED"
    );
    expect(found).toBe(true);
  });
});

test.describe("E2E work-order lifecycle negatives @full-stack @security @erp-control", () => {
  test("E2E-WO-NEG-001 start before approval denied with 400", async ({ browser }) => {
    const { id } = await createApprovalPendingWorkOrder(browser, "manager-a", "neg-pre-approval");
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "tech-a");
      const start = await authenticatedPatch(page, `/api/backend/work-orders/${id}/status`, {
        data: { status: "IN_PROGRESS" }
      });
      expect(start.status()).toBe(400);
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-NEG-003 unassigned approved WO cannot start with 400", async ({ browser }) => {
    const id = await createAutoApprovedWorkOrder(browser);
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "tech-a");
      const start = await authenticatedPatch(page, `/api/backend/work-orders/${id}/status`, {
        data: { status: "IN_PROGRESS" }
      });
      expect(start.status()).toBe(400);
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-NEG-006 tech cannot verify-supervisor with 403", async ({ browser }) => {
    const context = await browser.newContext();
    const managerPage = await context.newPage();
    let id = "";
    let technicianId = "";
    try {
      await loginViaUi(managerPage, "manager-a");
      const base = await buildValidWorkOrderPayload(managerPage, {
        title: `E2E WO LC neg verify ${e2eRunId().slice(-8)}`,
        type: "CORRECTIVE",
        priority: "MEDIUM"
      });
      const create = await authenticatedPost(managerPage, "/api/backend/work-orders", {
        data: { ...base, requiresApproval: false }
      });
      expect(create.status()).toBe(201);
      id = workOrderIdFrom(await create.json());

      const techContext = await browser.newContext();
      const techResolvePage = await techContext.newPage();
      try {
        await loginViaUi(techResolvePage, "tech-a");
        technicianId = await getAuthenticatedUserId(techResolvePage);
      } finally {
        await techContext.close();
      }

      const assign = await authenticatedPost(managerPage, `/api/backend/work-orders/${id}/assign`, {
        data: { technicianId }
      });
      expect(assign.status()).toBe(200);
    } finally {
      await context.close();
    }

    const techContext = await browser.newContext();
    const techPage = await techContext.newPage();
    try {
      await loginViaUi(techPage, "tech-a");
      const start = await authenticatedPatch(techPage, `/api/backend/work-orders/${id}/status`, {
        data: { status: "IN_PROGRESS" }
      });
      expect(start.status()).toBe(200);

      const techComplete = await authenticatedPatch(techPage, `/api/backend/work-orders/${id}/status`, {
        data: {
          status: "COMPLETED",
          completionNote: "E2E neg verify setup",
          actualCost: 50,
          actualHours: 1
        }
      });
      expect(techComplete.status()).toBe(200);

      const verify = await authenticatedPost(techPage, `/api/backend/work-orders/${id}/verify-supervisor`, {
        data: { verificationNote: "tech attempt" }
      });
      expect(verify.status()).toBe(403);
    } finally {
      await techContext.close();
    }
  });

  test("E2E-WO-NEG-010 cross-tenant admin-b cannot GET tenant A WO", async ({ browser }) => {
    const { id } = await createApprovalPendingWorkOrder(browser, "manager-a", "neg-xtenant");
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginViaUi(page, "admin-b");
      const cross = await authenticatedGet(page, `/api/backend/work-orders/${id}`);
      expect([403, 404]).toContain(cross.status());
    } finally {
      await context.close();
    }
  });

  test("E2E-WO-NEG-015 missing CSRF on status mutation returns 403 CSRF_INVALID", async ({
    page,
    browser
  }) => {
    const { id } = await createApprovalPendingWorkOrder(browser, "manager-a", "neg-csrf");
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await loginViaUi(adminPage, "admin-a");
      const approve = await authenticatedPatch(adminPage, `/api/backend/work-orders/${id}/approve`, {
        data: { notes: "approve for csrf test" }
      });
      expect(approve.status()).toBe(200);
    } finally {
      await adminContext.close();
    }

    const techContext = await browser.newContext();
    const techPage = await techContext.newPage();
    let technicianId = "";
    try {
      await loginViaUi(techPage, "tech-a");
      technicianId = await getAuthenticatedUserId(techPage);
    } finally {
      await techContext.close();
    }

    await loginViaUi(page, "manager-a");
    const assign = await authenticatedPost(page, `/api/backend/work-orders/${id}/assign`, {
      data: { technicianId }
    });
    expect(assign.status()).toBe(200);

    const response = await page.request.patch(`/api/backend/work-orders/${id}/status`, {
      data: { status: "IN_PROGRESS" }
    });
    expect(response.status()).toBe(403);
    const json = (await response.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("CSRF_INVALID");
  });
});
