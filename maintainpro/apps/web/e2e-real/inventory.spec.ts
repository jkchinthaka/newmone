import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  authenticatedGet,
  authenticatedMutationWithoutCsrf,
  authenticatedPost,
  getAuthenticatedUserId,
  getCsrfHeader
} from "./helpers/browser-session";
import { e2eRunId } from "./helpers/env";
import { buildValidWorkOrderPayload } from "./helpers/work-order-payload";

/** Canonical Nest stock-out action success status. */
const STOCK_OUT_SUCCESS = 200 as const;

async function findTenantAPart(page: Page) {
  const list = await authenticatedGet(page, "/api/backend/inventory/parts");
  expect(list.status()).toBe(200);
  const body = await list.json();
  const items = body.data?.items || body.data || body.items || [];
  const part = (Array.isArray(items) ? items : []).find((p: { partNumber?: string }) =>
    String(p.partNumber || "").includes(`E2E-PART-${e2eRunId()}`)
  );
  expect(part?.id).toBeTruthy();
  return part as { id: string; quantityInStock: number; partNumber: string; reorderPoint?: number };
}

async function createTenantAWorkOrder(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginViaUi(page, "manager-a");
    await getAuthenticatedUserId(page);
    const payload = await buildValidWorkOrderPayload(page, {
      title: `E2E INV WO ${e2eRunId().slice(-8)}`
    });
    const create = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    expect(create.status()).toBe(201);
    const body = await create.json();
    const wo = body.data || body;
    const id = String(wo.id || wo._id || "");
    expect(id.length).toBeGreaterThan(0);
    return id;
  } finally {
    await context.close();
  }
}

test.describe.serial("E2E inventory controls @full-stack @erp-control @security", () => {
  let workOrderId = "";
  let partId = "";
  let openingQty = 0;

  test("E2E-INV-001 Inventory Keeper lists Tenant A inventory with HTTP 200", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const list = await authenticatedGet(page, "/api/backend/inventory/parts");
    expect(list.status()).toBe(200);
    const body = await list.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/"accessToken"\s*:/);
    expect(serialized).not.toContain("E2E-B-PART-");
    const part = await findTenantAPart(page);
    partId = part.id;
    openingQty = Number(part.quantityInStock);
    expect(openingQty).toBeGreaterThan(0);
  });

  test("E2E-INV-002 opening seeded stock is correct", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const part = await findTenantAPart(page);
    expect(Number(part.quantityInStock)).toBe(25);
    partId = part.id;
    openingQty = 25;
  });

  test("E2E-INV-003 valid work-order-linked issue succeeds with exact status", async ({
    page,
    browser
  }) => {
    workOrderId = await createTenantAWorkOrder(browser);
    await loginViaUi(page, "inventory-a");
    const part = await findTenantAPart(page);
    partId = part.id;
    openingQty = Number(part.quantityInStock);
    const issue = await authenticatedPost(page, `/api/backend/inventory/parts/${partId}/stock-out`, {
      data: {
        quantity: 1,
        workOrderId,
        notes: "E2E authorized issue",
        idempotencyKey: `e2e-inv-issue-${e2eRunId()}-primary`
      }
    });
    expect(issue.status()).toBe(STOCK_OUT_SUCCESS);
    expect([400, 422]).not.toContain(issue.status());
    const body = await issue.json();
    expect(JSON.stringify(body)).not.toMatch(/"accessToken"\s*:/);
  });

  test("E2E-INV-004 successful issue deducts quantity exactly once", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const detail = await authenticatedGet(page, `/api/backend/inventory/parts/${partId}`);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    const qty = Number((body.data || body).quantityInStock);
    expect(qty).toBe(openingQty - 1);
  });

  test("E2E-INV-005 duplicate replay does not deduct twice", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const beforeRes = await authenticatedGet(page, `/api/backend/inventory/parts/${partId}`);
    const beforeBody = await beforeRes.json();
    const qtyBefore = Number((beforeBody.data || beforeBody).quantityInStock);

    const replay = await authenticatedPost(page, `/api/backend/inventory/parts/${partId}/stock-out`, {
      data: {
        quantity: 1,
        workOrderId,
        notes: "E2E authorized issue",
        idempotencyKey: `e2e-inv-issue-${e2eRunId()}-primary`
      }
    });
    expect(replay.status()).toBe(STOCK_OUT_SUCCESS);

    const afterRes = await authenticatedGet(page, `/api/backend/inventory/parts/${partId}`);
    const afterBody = await afterRes.json();
    const qtyAfter = Number((afterBody.data || afterBody).quantityInStock);
    expect(qtyAfter).toBe(qtyBefore);
  });

  test("E2E-INV-006 excess stock issue is rejected with exact 400", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const negative = await authenticatedPost(page, `/api/backend/inventory/parts/${partId}/stock-out`, {
      data: {
        quantity: 999999,
        workOrderId,
        notes: "E2E negative",
        idempotencyKey: `e2e-inv-issue-${e2eRunId()}-negative`
      }
    });
    expect(negative.status()).toBe(400);
    const text = (await negative.text()).toLowerCase();
    expect(text).toMatch(/stock|below|insufficient|cannot/);
  });

  test("E2E-INV-007 stock movement history reconciles", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const detailRes = await authenticatedGet(page, `/api/backend/inventory/parts/${partId}`);
    const detailBody = await detailRes.json();
    const currentQty = Number((detailBody.data || detailBody).quantityInStock);

    const movements = await authenticatedGet(page, `/api/backend/inventory/parts/${partId}/movements`);
    expect(movements.status()).toBe(200);
    const movBody = await movements.json();
    const rows = movBody.data || movBody || [];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    const outQty = (rows as Array<{ type?: string; quantity?: number }>)
      .filter((m) => m.type === "OUT")
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
    const inQty = (rows as Array<{ type?: string; quantity?: number }>)
      .filter((m) => m.type === "IN")
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
    expect(25 - outQty + inQty).toBe(currentQty);
  });

  test("E2E-INV-008 low-stock status updates when threshold crossed", async ({ page, browser }) => {
    const wo = await createTenantAWorkOrder(browser);
    await loginViaUi(page, "inventory-a");
    const part = await findTenantAPart(page);
    const detailRes = await authenticatedGet(page, `/api/backend/inventory/parts/${part.id}`);
    const detailBefore = await detailRes.json();
    const qty = Number((detailBefore.data || detailBefore).quantityInStock);
    const reorder = Number((detailBefore.data || detailBefore).reorderPoint ?? 8);
    const need = Math.max(1, qty - reorder + 1);
    const issue = await authenticatedPost(page, `/api/backend/inventory/parts/${part.id}/stock-out`, {
      data: {
        quantity: need,
        workOrderId: wo,
        notes: "E2E low-stock cross",
        idempotencyKey: `e2e-inv-issue-${e2eRunId()}-lowstock`
      }
    });
    expect(issue.status()).toBe(STOCK_OUT_SUCCESS);

    const low = await authenticatedGet(page, "/api/backend/inventory/low-stock");
    expect(low.status()).toBe(200);
    const lowBody = await low.json();
    const lowItems = lowBody.data || lowBody || [];
    const found = (Array.isArray(lowItems) ? lowItems : []).some(
      (p: { partNumber?: string; id?: string }) =>
        p.id === part.id || String(p.partNumber || "").includes(`E2E-PART-${e2eRunId()}`)
    );
    expect(found).toBe(true);
  });

  test("E2E-INV-009 Inventory Keeper cannot delete inventory master data", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const part = await findTenantAPart(page);
    const csrf = await getCsrfHeader(page);
    const del = await page.request.delete(`/api/backend/inventory/parts/${part.id}`, {
      headers: csrf
    });
    expect(del.status()).toBe(403);
  });

  test("E2E-INV-010 Technician cannot perform unauthorized stock issue", async ({ page }) => {
    await loginViaUi(page, "tech-a");
    const csrf = await getCsrfHeader(page).catch(() => ({}) as Record<string, string>);
    const response = await page.request.post("/api/backend/inventory/parts/not-a-real-id/stock-out", {
      headers: csrf,
      data: { quantity: 1, workOrderId: "not-a-real-wo" }
    });
    expect([401, 403]).toContain(response.status());
  });

  test("E2E-INV-011 Tenant A cannot list Tenant B inventory", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const list = await authenticatedGet(page, "/api/backend/inventory/parts");
    expect(list.status()).toBe(200);
    expect(JSON.stringify(await list.json())).not.toContain("E2E-B-PART-");
  });

  test("E2E-INV-012 Tenant A cannot issue Tenant B part", async ({ page, browser }) => {
    const wo = workOrderId || (await createTenantAWorkOrder(browser));
    const bContext = await browser.newContext();
    const bPage = await bContext.newPage();
    let bPartId = "";
    try {
      await loginViaUi(bPage, "admin-b");
      const bList = await authenticatedGet(bPage, "/api/backend/inventory/parts");
      expect(bList.status()).toBe(200);
      const items = (await bList.json()).data || [];
      const bPart = (Array.isArray(items) ? items : []).find((p: { partNumber?: string }) =>
        String(p.partNumber || "").includes(`E2E-B-PART-${e2eRunId()}`)
      );
      bPartId = String(bPart?.id || "");
      expect(bPartId.length).toBeGreaterThan(0);
    } finally {
      await bContext.close();
    }

    await loginViaUi(page, "inventory-a");
    const issue = await authenticatedPost(page, `/api/backend/inventory/parts/${bPartId}/stock-out`, {
      data: {
        quantity: 1,
        workOrderId: wo,
        notes: "cross-tenant blocked",
        idempotencyKey: `e2e-inv-issue-${e2eRunId()}-xtenant-part`
      }
    });
    expect([403, 404]).toContain(issue.status());
  });

  test("E2E-INV-013 Tenant A part cannot link Tenant B work order", async ({ page, browser }) => {
    const bContext = await browser.newContext();
    const bPage = await bContext.newPage();
    let bWoId = "";
    try {
      await loginViaUi(bPage, "admin-b");
      await getAuthenticatedUserId(bPage);
      const payload = await buildValidWorkOrderPayload(bPage, {
        title: `E2E INV B WO ${e2eRunId().slice(-8)}`
      });
      const create = await authenticatedPost(bPage, "/api/backend/work-orders", { data: payload });
      expect(create.status()).toBe(201);
      const body = await create.json();
      const wo = body.data || body;
      bWoId = String(wo.id || wo._id || "");
      expect(bWoId.length).toBeGreaterThan(0);
    } finally {
      await bContext.close();
    }

    await loginViaUi(page, "inventory-a");
    const part = await findTenantAPart(page);
    const issue = await authenticatedPost(page, `/api/backend/inventory/parts/${part.id}/stock-out`, {
      data: {
        quantity: 1,
        workOrderId: bWoId,
        notes: "cross-tenant wo blocked",
        idempotencyKey: `e2e-inv-issue-${e2eRunId()}-xtenant-wo`
      }
    });
    expect(issue.status()).toBe(400);
  });

  test("E2E-INV-014 missing CSRF returns exactly 403 CSRF_INVALID", async ({ page, browser }) => {
    const wo = workOrderId || (await createTenantAWorkOrder(browser));
    await loginViaUi(page, "inventory-a");
    const part = await findTenantAPart(page);
    const response = await authenticatedMutationWithoutCsrf(
      page,
      `/api/backend/inventory/parts/${part.id}/stock-out`,
      {
        data: { quantity: 1, workOrderId: wo, notes: "csrf missing" }
      }
    );
    expect(response.status()).toBe(403);
    const json = (await response.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("CSRF_INVALID");
  });

  test("E2E-INV-015 correct CSRF reaches inventory business validation", async ({ page, browser }) => {
    const wo = workOrderId || (await createTenantAWorkOrder(browser));
    await loginViaUi(page, "inventory-a");
    const part = await findTenantAPart(page);
    const response = await authenticatedPost(page, `/api/backend/inventory/parts/${part.id}/stock-out`, {
      data: {
        quantity: 1,
        workOrderId: wo,
        notes: "csrf ok business path",
        idempotencyKey: `e2e-inv-issue-${e2eRunId()}-csrf-ok`
      }
    });
    expect(response.status()).not.toBe(403);
    expect([STOCK_OUT_SUCCESS, 400]).toContain(response.status());
  });

  test("E2E-INV-016 responses contain no token fields", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const list = await authenticatedGet(page, "/api/backend/inventory/parts");
    const text = await list.text();
    expect(text).not.toMatch(/"accessToken"\s*:/);
    expect(text).not.toMatch(/"refreshToken"\s*:/);
  });
});
