import { expect, test, type Browser } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  authenticatedGet,
  authenticatedPatch,
  authenticatedPost,
  getAuthenticatedUserId
} from "./helpers/browser-session";
import { e2eRunId } from "./helpers/env";
import { buildValidWorkOrderPayload } from "./helpers/work-order-payload";

/**
 * Focused work-order lifecycle gate fixture.
 * Safe console output: statuses and yes/no flags only.
 */
async function runLifecycleGate(browser: Browser): Promise<{
  create_status: number;
  approval_status: string;
  assignment_present: "yes" | "no";
  start_status: number;
  stock_issue_status: number;
  technician_completion_status: number;
  supervisor_verification_status: number;
  final_status: string;
  history_ok: "yes" | "no";
  tenant_isolation: "yes" | "no";
}> {
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  let workOrderId = "";
  let createStatus = 0;
  let approvalStatus = "unknown";
  let assignmentPresent: "yes" | "no" = "no";
  let startStatus = 0;
  let stockIssueStatus = 0;
  let technicianCompletionStatus = 0;
  let supervisorVerificationStatus = 0;
  let finalStatus = "unknown";
  let historyOk: "yes" | "no" = "no";
  let tenantIsolation: "yes" | "no" = "no";

  try {
    await loginViaUi(managerPage, "manager-a");
    const payload = await buildValidWorkOrderPayload(managerPage, {
      title: `E2E WO GATE ${e2eRunId().slice(-8)}`,
      type: "CORRECTIVE",
      priority: "MEDIUM"
    });
    const create = await authenticatedPost(managerPage, "/api/backend/work-orders", {
      data: { ...payload, requiresApproval: true }
    });
    createStatus = create.status();
    const created = await create.json();
    workOrderId = String((created.data || created).id || (created.data || created)._id || "");

    const selfApprove = await authenticatedPatch(
      managerPage,
      `/api/backend/work-orders/${workOrderId}/approve`,
      { data: { notes: "gate self approve" } }
    );
    expect(selfApprove.status()).toBe(403);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await loginViaUi(adminPage, "admin-a");
      const approve = await authenticatedPatch(
        adminPage,
        `/api/backend/work-orders/${workOrderId}/approve`,
        { data: { notes: "gate admin approve" } }
      );
      expect(approve.status()).toBe(200);
      approvalStatus = String((await approve.json()).data?.approvalStatus || "APPROVED");
    } finally {
      await adminContext.close();
    }

    const techResolveContext = await browser.newContext();
    const techResolvePage = await techResolveContext.newPage();
    let technicianId = "";
    try {
      await loginViaUi(techResolvePage, "tech-a");
      technicianId = await getAuthenticatedUserId(techResolvePage);
    } finally {
      await techResolveContext.close();
    }

    const assign = await authenticatedPost(managerPage, `/api/backend/work-orders/${workOrderId}/assign`, {
      data: { technicianId }
    });
    assignmentPresent = assign.status() === 200 ? "yes" : "no";

    const techContext = await browser.newContext();
    const techPage = await techContext.newPage();
    try {
      await loginViaUi(techPage, "tech-a");
      const start = await authenticatedPatch(techPage, `/api/backend/work-orders/${workOrderId}/status`, {
        data: { status: "IN_PROGRESS" }
      });
      startStatus = start.status();

      const invContext = await browser.newContext();
      const invPage = await invContext.newPage();
      try {
        await loginViaUi(invPage, "inventory-a");
        const list = await authenticatedGet(invPage, "/api/backend/inventory/parts");
        const items = (await list.json()).data?.items || (await list.json()).data || [];
        const part = (Array.isArray(items) ? items : []).find((p: { partNumber?: string }) =>
          String(p.partNumber || "").includes(`E2E-PART-${e2eRunId()}`)
        );
        if (part?.id) {
          const issue = await authenticatedPost(
            invPage,
            `/api/backend/inventory/parts/${part.id}/stock-out`,
            {
              data: {
                quantity: 1,
                workOrderId,
                notes: "gate stock issue",
                idempotencyKey: `e2e-wo-gate-${e2eRunId()}`
              }
            }
          );
          stockIssueStatus = issue.status();
        }
      } finally {
        await invContext.close();
      }

      const complete = await authenticatedPatch(techPage, `/api/backend/work-orders/${workOrderId}/status`, {
        data: {
          status: "COMPLETED",
          completionNote: "gate technician completion",
          actualCost: 99,
          actualHours: 1.5
        }
      });
      technicianCompletionStatus = complete.status();
    } finally {
      await techContext.close();
    }

    const verifyContext = await browser.newContext();
    const verifyPage = await verifyContext.newPage();
    try {
      await loginViaUi(verifyPage, "admin-a");
      const verify = await authenticatedPost(
        verifyPage,
        `/api/backend/work-orders/${workOrderId}/verify-supervisor`,
        { data: { verificationNote: "gate supervisor verify" } }
      );
      supervisorVerificationStatus = verify.status();
    } finally {
      await verifyContext.close();
    }

    const detail = await authenticatedGet(managerPage, `/api/backend/work-orders/${workOrderId}`);
    finalStatus = String((await detail.json()).data?.status || "unknown");
    const history = await authenticatedGet(managerPage, `/api/backend/work-orders/${workOrderId}/history`);
    historyOk = history.status() === 200 ? "yes" : "no";

    const tenantBContext = await browser.newContext();
    const tenantBPage = await tenantBContext.newPage();
    try {
      await loginViaUi(tenantBPage, "admin-b");
      const cross = await authenticatedGet(tenantBPage, `/api/backend/work-orders/${workOrderId}`);
      tenantIsolation = [403, 404].includes(cross.status()) ? "yes" : "no";
    } finally {
      await tenantBContext.close();
    }
  } finally {
    await managerContext.close();
  }

  return {
    create_status: createStatus,
    approval_status: approvalStatus,
    assignment_present: assignmentPresent,
    start_status: startStatus,
    stock_issue_status: stockIssueStatus,
    technician_completion_status: technicianCompletionStatus,
    supervisor_verification_status: supervisorVerificationStatus,
    final_status: finalStatus,
    history_ok: historyOk,
    tenant_isolation: tenantIsolation
  };
}

test.describe("E2E work-order lifecycle diagnostic @wo-lifecycle-gate", () => {
  test("WO-LIFECYCLE-DIAG-001 gate lifecycle flags", async ({ browser }) => {
    const flags = await runLifecycleGate(browser);
    console.log(
      JSON.stringify({
        create_status: flags.create_status,
        approval_status: flags.approval_status,
        assignment_present: flags.assignment_present,
        start_status: flags.start_status,
        stock_issue_status: flags.stock_issue_status,
        technician_completion_status: flags.technician_completion_status,
        supervisor_verification_status: flags.supervisor_verification_status,
        final_status: flags.final_status,
        history_ok: flags.history_ok,
        tenant_isolation: flags.tenant_isolation
      })
    );

    expect(flags.create_status).toBe(201);
    expect(flags.approval_status).toBe("APPROVED");
    expect(flags.assignment_present).toBe("yes");
    expect(flags.start_status).toBe(200);
    expect(flags.stock_issue_status).toBe(200);
    expect(flags.technician_completion_status).toBe(200);
    expect(flags.supervisor_verification_status).toBe(200);
    expect(flags.final_status).toBe("COMPLETED");
    expect(flags.history_ok).toBe("yes");
    expect(flags.tenant_isolation).toBe("yes");
  });
});
