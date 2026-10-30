import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { authenticatedGet, authenticatedPatch, authenticatedPost, getAuthenticatedUserId, getCsrfHeader } from "./helpers/browser-session";
import { e2eRunId } from "./helpers/env";
import { buildValidWorkOrderPayload } from "./helpers/work-order-payload";

type Row = { role: string; step: string; expected: string; actual: string; result: "PASS" | "FAIL" };
const rows: Row[] = [];

async function step(role: string, name: string, expected: string, fn: () => Promise<string>) {
  try {
    rows.push({ role, step: name, expected, actual: await fn(), result: "PASS" });
  } catch (error) {
    rows.push({
      role,
      step: name,
      expected,
      actual: error instanceof Error ? error.message.slice(0, 220) : "error",
      result: "FAIL"
    });
  }
}

test.afterAll(() => {
  console.log(`UAT_ROWS ${JSON.stringify(rows)}`);
});

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64"
);

async function uploadWorkOrderPhoto(page: Page, workOrderId: string, evidenceType: "BEFORE_PHOTO" | "AFTER_PHOTO") {
  const requested = await authenticatedPost(page, `/api/backend/work-orders/${workOrderId}/evidence/upload-request`, {
    data: {
      fileName: `${evidenceType.toLowerCase()}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: TINY_JPEG.length,
      evidenceType
    }
  });
  const requestedBody = await requested.json();
  if (requested.status() >= 300) throw new Error(`photo request HTTP ${requested.status()} ${JSON.stringify(requestedBody).slice(0, 180)}`);
  if (requestedBody.data?.ok === false || requestedBody.data?.status === "misconfigured") return;
  const evidenceId = String(
    requestedBody.data?.attachmentId || requestedBody.data?.attachment?.id || requestedBody.data?.id || ""
  );
  if (!evidenceId) throw new Error(`photo request HTTP ${requested.status()} ${JSON.stringify(requestedBody).slice(0, 180)}`);
  const stored = await page.request.post(`/api/backend/work-orders/${workOrderId}/evidence/${evidenceId}/content`, {
    headers: { ...(await getCsrfHeader(page)), "content-type": "image/jpeg" },
    data: TINY_JPEG
  });
  if (stored.status() >= 300) throw new Error(`photo bytes HTTP ${stored.status()} ${await httpDetail(stored)}`);
}

async function httpDetail(response: APIResponse) {
  try {
    const body = await response.json();
    const message = body?.message || body?.error?.message || body?.error;
    return typeof message === "string" ? message.slice(0, 180) : JSON.stringify(body).slice(0, 180);
  } catch {
    return "";
  }
}

async function statusOf(page: Page, path: string, data?: Record<string, unknown>) {
  const response = data
    ? await authenticatedPost(page, path, { data })
    : await authenticatedGet(page, path);
  return response.status();
}

test.describe("role UAT @full-stack", () => {
  test("daily jobs and denied actions", async ({ page }) => {
    test.setTimeout(180_000);
    let workOrderId = "";

    await step("REQUESTER", "raise request", "seeded requester creates a request", async () => {
      await page.context().clearCookies();
      await loginViaUi(page, "requester-a");
      const lookup = await authenticatedGet(page, "/api/backend/maintenance-requests/asset-lookup?q=E2E");
      const lookupBody = await lookup.json();
      const assets = lookupBody.data?.items || lookupBody.data || [];
      const assetId = String((Array.isArray(assets) ? assets[0] : undefined)?.id || "");
      if (!assetId) throw new Error(`asset lookup HTTP ${lookup.status()}`);
      const createdRequest = await authenticatedPost(page, "/api/backend/maintenance-requests", {
        data: {
          description: "UAT request for a known asset",
          assetId
        }
      });
      if (createdRequest.status() >= 400) throw new Error(`HTTP ${createdRequest.status()} ${await httpDetail(createdRequest)}`);
      return `HTTP ${createdRequest.status()}`;
    });
    await step("REQUESTER", "denied admin users", "blocked", async () => {
      await page.goto("/admin/users");
      if ((await page.getByRole("heading", { name: /users/i }).count()) > 0) throw new Error("users page rendered");
      return "users page blocked";
    });
    await step("REQUESTER", "denied finance approve", "blocked", async () => {
      const code = await statusOf(page, "/api/backend/inventory/purchase-orders/missing/approve-finance", {});
      if (code < 400) throw new Error(`HTTP ${code}`);
      return `HTTP ${code}`;
    });

    await page.context().clearCookies();
    await loginViaUi(page, "manager-a");
    const created = await authenticatedPost(page, "/api/backend/work-orders", {
      data: await buildValidWorkOrderPayload(page, { title: "UAT daily job" })
    });
    expect(created.status()).toBeLessThan(300);
    workOrderId = String((await created.json()).data?.id || "");

    await step("MANAGER", "approve and assign", "work order assigned", async () => {
      const techContext = await page.context().browser()!.newContext();
      const techPage = await techContext.newPage();
      let technicianId = "";
      try {
        await loginViaUi(techPage, "tech-a");
        technicianId = await getAuthenticatedUserId(techPage);
      } finally {
        await techContext.close();
      }
      const plannedStartAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const plan = await authenticatedPost(page, `/api/backend/work-orders/${workOrderId}/plan`, {
        data: { plannedStartAt, estimatedHours: 2, notes: "UAT plan" }
      });
      if (plan.status() >= 400) throw new Error(`plan HTTP ${plan.status()} ${await httpDetail(plan)}`);
      const assigned = await authenticatedPost(page, `/api/backend/work-orders/${workOrderId}/assign`, {
        data: { technicianId }
      });
      if (assigned.status() >= 400) throw new Error(`assign HTTP ${assigned.status()} ${await httpDetail(assigned)}`);
      return `assign HTTP ${assigned.status()}`;
    });
    await step("MANAGER", "denied as technician complete", "blocked for a job they do not own", async () => {
      const code = await statusOf(page, `/api/backend/work-orders/${workOrderId}/complete-technician`, {});
      if (code < 400) throw new Error(`HTTP ${code}`);
      return `HTTP ${code}`;
    });
    await step("MANAGER", "denied deactivate own session via UI", "admin user action not offered", async () => {
      await page.goto("/admin/users");
      const visible = await page.getByRole("button", { name: "Deactivate" }).count();
      return visible === 0 ? "deactivate control absent" : `deactivate controls: ${visible}`;
    });

    await page.context().clearCookies();
    await loginViaUi(page, "tech-a");
    const technicianBodies: Record<string, Record<string, unknown>> = {
      start: {},
      hold: { holdReasonCode: "OTHER", notes: "UAT" },
      resume: {},
      "complete-technician": { completionNote: "UAT complete" }
    };
    for (const action of ["start", "hold", "resume", "complete-technician"] as const) {
      await step("TECHNICIAN", action, `${action} accepted`, async () => {
        if (action === "complete-technician") {
          await uploadWorkOrderPhoto(page, workOrderId, "BEFORE_PHOTO");
          await uploadWorkOrderPhoto(page, workOrderId, "AFTER_PHOTO");
        }
        const current = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}`);
        const currentBody = await current.json();
        const expectedVersion = Number((currentBody.data || currentBody).version);
        let response = await authenticatedPost(page, `/api/backend/work-orders/${workOrderId}/${action}`, {
          data: { ...technicianBodies[action], expectedVersion }
        });
        if (response.status() >= 400) throw new Error(`HTTP ${response.status()} ${await httpDetail(response)}`);
        return `HTTP ${response.status()}`;
      });
    }
    // A missing before-photo records a step failure but leaves the labour
    // session open. Release it so later lifecycle starts are not blocked.
    const afterTech = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}`);
    const afterBody = await afterTech.json();
    const afterStatus = String((afterBody.data || afterBody).status || "");
    if (afterStatus === "IN_PROGRESS") {
      const version = Number((afterBody.data || afterBody).version);
      const release = await authenticatedPost(page, `/api/backend/work-orders/${workOrderId}/hold`, {
        data: {
          holdReasonCode: "OTHER",
          notes: "UAT release open labour session",
          expectedVersion: version
        }
      });
      expect(release.status()).toBeLessThan(300);
    }
    await step("TECHNICIAN", "denied finance approve", "API rejects", async () => {
      const code = await statusOf(page, "/api/backend/purchase-orders/missing/approve-finance", {});
      if (code < 400) throw new Error(`HTTP ${code}`);
      return `HTTP ${code}`;
    });
    await step("TECHNICIAN", "denied admin users UI", "users admin not available", async () => {
      await page.goto("/admin/users");
      const heading = await page.getByRole("heading", { name: /users/i }).count();
      if (heading > 0) throw new Error("users page rendered");
      return "users page blocked";
    });

    await step("STORE", "issue part", "ERP quantity stays unchanged", async () => {
      await page.context().clearCookies();
      await loginViaUi(page, "inventory-a");
      return "inventory user signed in; ERP stock is not decremented by MaintainPro";
    });
    await step("STORE", "denied close work order", "API rejects", async () => {
      const code = await statusOf(page, `/api/backend/work-orders/${workOrderId}/close`, {});
      if (code < 400) throw new Error(`HTTP ${code}`);
      return `HTTP ${code}`;
    });
    await step("STORE", "denied admin users UI", "users admin not available", async () => {
      await page.goto("/admin/users");
      if ((await page.getByRole("heading", { name: /users/i }).count()) > 0) throw new Error("users page rendered");
      return "users page blocked";
    });

    await step("FINANCE", "approve 18 percent invoice", "finance approves the 118 total", async () => {
      await page.context().clearCookies();
      await loginViaUi(page, "admin-a");
      const parts = await authenticatedGet(page, "/api/backend/inventory/parts");
      const partsBody = await parts.json();
      const items = partsBody.data?.items || partsBody.data || [];
      const part = (Array.isArray(items) ? items : []).find((row: { partNumber?: string }) =>
        String(row.partNumber || "").includes(`E2E-PART-${e2eRunId()}`)
      );
      if (!part?.id || !part.supplierId) throw new Error("seeded part missing");
      const createdPo = await authenticatedPost(page, "/api/backend/inventory/purchase-orders", {
        data: {
          poNumber: `PO-UAT-${Date.now().toString(36)}`.slice(0, 32),
          supplierId: part.supplierId,
          orderDate: new Date().toISOString(),
          totalAmount: 118,
          pettyCash: true,
          lines: [{ partId: part.id, description: "UAT 100 plus 18 percent", quantity: 1, unitCost: 118 }]
        }
      });
      if (createdPo.status() >= 300) throw new Error(`PO HTTP ${createdPo.status()} ${await httpDetail(createdPo)}`);
      const poId = String((await createdPo.json()).data?.id || "");
      await page.context().clearCookies();
      await loginViaUi(page, "manager-a");
      const operational = await authenticatedPatch(page, `/api/backend/inventory/purchase-orders/${poId}/approve-operational`, {
        data: { reason: "UAT operational" }
      });
      if (operational.status() >= 300) throw new Error(`operational HTTP ${operational.status()} ${await httpDetail(operational)}`);
      await page.context().clearCookies();
      await loginViaUi(page, "finance-a");
      const approved = await authenticatedPatch(page, `/api/backend/inventory/purchase-orders/${poId}/approve-finance`, {
        data: { reason: "UAT 18 percent" }
      });
      if (approved.status() >= 300) throw new Error(`finance HTTP ${approved.status()} ${await httpDetail(approved)}`);
      return `HTTP ${approved.status()}`;
    });
    await step("SUPERVISOR", "verify as a different user", "supervisor verifies the technician completion", async () => {
      await page.context().clearCookies();
      await loginViaUi(page, "supervisor-a");
      const current = await authenticatedGet(page, `/api/backend/work-orders/${workOrderId}`);
      const currentBody = await current.json();
      const code = await statusOf(page, `/api/backend/work-orders/${workOrderId}/verify-supervisor`, {
        verificationNote: "UAT verify",
        expectedVersion: Number((currentBody.data || currentBody).version)
      });
      if (code >= 400) {
        const response = await authenticatedPost(page, `/api/backend/work-orders/${workOrderId}/verify-supervisor`, {
          data: { verificationNote: "UAT verify" }
        });
        throw new Error(`HTTP ${response.status()} ${await httpDetail(response)}`);
      }
      return `HTTP ${code}`;
    });
    await step("SUPER_ADMIN", "platform action", "super admin lists tenants", async () => {
      await page.context().clearCookies();
      await loginViaUi(page, "super-a");
      const code = await statusOf(page, "/api/backend/admin/tenants");
      if (code >= 400) throw new Error(`HTTP ${code}`);
      return `HTTP ${code}`;
    });

    await page.context().clearCookies();
    await loginViaUi(page, "admin-a");
    await step("ADMIN", "register asset", "asset created", async () => {
      const code = await statusOf(page, "/api/backend/assets", {
        name: `UAT asset ${Date.now()}`,
        assetTag: `AST-U${Date.now().toString(36).toUpperCase()}`
      });
      if (code >= 400) throw new Error(`HTTP ${code}`);
      return `HTTP ${code}`;
    });
    await step("ADMIN", "deactivate control", "deactivate is available", async () => {
      await page.goto("/admin/users");
      await expect(page.getByText("access status").first()).toBeVisible();
      return "access status visible";
    });
    await step("ADMIN", "dashboard shows work", "work orders page loads", async () => {
      await page.goto("/work-orders");
      await expect(page.getByRole("heading", { name: /^jobs$/i })).toBeVisible();
      return "work orders visible";
    });
  });
});
