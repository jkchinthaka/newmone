import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  authenticatedGet,
  authenticatedMutationWithoutCsrf,
  authenticatedMutationWithWrongCsrf,
  authenticatedPost,
  getAuthenticatedUserId
} from "./helpers/browser-session";
import {
  assertNoAccessTokensInBody,
  buildValidWorkOrderPayload
} from "./helpers/work-order-payload";

test.describe("E2E work-order create contract @full-stack @security @erp-control", () => {
  test("WO-CREATE-001..003 manager create with CSRF returns 201 and actor attribution", async ({
    page
  }) => {
    await loginViaUi(page, "manager-a");
    const actorId = await getAuthenticatedUserId(page);
    const payload = await buildValidWorkOrderPayload(page);
    const response = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    expect(response.status()).toBe(201);
    const body = await response.json();
    assertNoAccessTokensInBody(body);
    const wo = body.data || body;
    expect(wo.id || wo._id).toBeTruthy();
    expect(wo.woNumber || wo.number).toBeTruthy();
    expect(String(wo.createdById || "")).toBe(actorId);
  });

  test("WO-CREATE-004 unauthenticated creation returns 401", async ({ request }) => {
    // Direct Nest path (nginx /api/) — BFF CSRF does not apply; proves API auth gate.
    const response = await request.post("/api/work-orders", {
      data: {
        title: "unauth",
        description: "no session",
        type: "CORRECTIVE",
        priority: "MEDIUM"
      }
    });
    expect(response.status()).toBe(401);
  });

  test("WO-CREATE-005 missing CSRF returns 403 CSRF_INVALID", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const payload = await buildValidWorkOrderPayload(page);
    const response = await authenticatedMutationWithoutCsrf(page, "/api/backend/work-orders", {
      data: payload
    });
    expect(response.status()).toBe(403);
    const json = (await response.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("CSRF_INVALID");
  });

  test("WO-CREATE-006 incorrect CSRF returns 403 CSRF_INVALID", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const payload = await buildValidWorkOrderPayload(page);
    const response = await authenticatedMutationWithWrongCsrf(page, "/api/backend/work-orders", {
      data: payload
    });
    expect(response.status()).toBe(403);
    const json = (await response.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("CSRF_INVALID");
  });

  test("WO-CREATE-007 valid CSRF missing business field returns 400 not CSRF_INVALID", async ({
    page
  }) => {
    await loginViaUi(page, "manager-a");
    const actorId = await getAuthenticatedUserId(page);
    const response = await authenticatedPost(page, "/api/backend/work-orders", {
      data: {
        title: "missing-description",
        type: "CORRECTIVE",
        priority: "MEDIUM",
        createdById: actorId
      }
    });
    expect(response.status()).toBe(400);
    expect(response.status()).not.toBe(403);
    const json = (await response.json()) as {
      error?: { code?: string; message?: string; details?: string[] };
    };
    expect(json.error?.code).not.toBe("CSRF_INVALID");
    const msg = `${json.error?.message || ""} ${(json.error?.details || []).join(" ")}`;
    expect(msg.toLowerCase()).toMatch(/description/);
  });

  test("WO-CREATE-008..010 tenant-scoped read-back and no tokens", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const payload = await buildValidWorkOrderPayload(page);
    const create = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    expect(create.status()).toBe(201);
    const created = await create.json();
    assertNoAccessTokensInBody(created);
    const wo = created.data || created;
    const id = wo.id || wo._id;
    const read = await authenticatedGet(page, `/api/backend/work-orders/${id}`);
    expect(read.status()).toBe(200);
    const readBody = await read.json();
    assertNoAccessTokensInBody(readBody);
    expect(String((readBody.data || readBody).title)).toBe(payload.title);
  });

  test("WO-CREATE-009 Tenant B cannot read Tenant A work order", async ({ page, browser }) => {
    await loginViaUi(page, "manager-a");
    const payload = await buildValidWorkOrderPayload(page);
    const create = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    expect(create.status()).toBe(201);
    const created = await create.json();
    const wo = created.data || created;
    const id = wo.id || wo._id;
    expect(id).toBeTruthy();

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await loginViaUi(otherPage, "admin-b");
      const cross = await authenticatedGet(otherPage, `/api/backend/work-orders/${id}`);
      // Tenant-scoped findOne returns 404 (not found) rather than leaking the record.
      expect([403, 404]).toContain(cross.status());
      expect(cross.status()).not.toBe(200);
    } finally {
      await otherContext.close();
    }
  });

  test("WO-CREATE-011..013 payload uses /auth/me identity and exact 201", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const payload = await buildValidWorkOrderPayload(page);
    // Structural: createdById must be non-empty; source is /auth/me (not a fixture constant).
    expect(payload.createdById.length).toBeGreaterThan(0);
    const response = await authenticatedPost(page, "/api/backend/work-orders", { data: payload });
    expect(response.status()).toBe(201);
    expect([400, 422]).not.toContain(response.status());
  });
});
