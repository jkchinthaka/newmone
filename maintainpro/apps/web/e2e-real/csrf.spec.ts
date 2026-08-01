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

test.describe("E2E CSRF @full-stack @security", () => {
  test("E2E-CSRF-001 mutation without CSRF returns 403", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const payload = await buildValidWorkOrderPayload(page, { title: "csrf-missing" });
    const response = await authenticatedMutationWithoutCsrf(page, "/api/backend/work-orders", {
      data: payload
    });
    expect(response.status()).toBe(403);
    expect(response.status()).not.toBe(401);
    const json = (await response.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("CSRF_INVALID");
  });

  test("E2E-CSRF-002 incorrect CSRF returns 403", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const payload = await buildValidWorkOrderPayload(page, { title: "csrf-wrong" });
    const response = await authenticatedMutationWithWrongCsrf(page, "/api/backend/work-orders", {
      data: payload
    });
    expect(response.status()).toBe(403);
    expect(response.status()).not.toBe(401);
    const json = (await response.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("CSRF_INVALID");
  });

  test("E2E-CSRF-003 correct CSRF allows mutation path", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const actorId = await getAuthenticatedUserId(page);
    const payload = await buildValidWorkOrderPayload(page, { createdById: actorId });
    const response = await authenticatedPost(page, "/api/backend/work-orders", {
      data: payload
    });
    // Exact Nest POST create default is 201 Created for a new work-order resource.
    expect(response.status()).toBe(201);
    const body = await response.json();
    assertNoAccessTokensInBody(body);
    const wo = body.data || body;
    const id = wo.id || wo._id;
    expect(id).toBeTruthy();
    expect(wo.woNumber || wo.number).toBeTruthy();
    expect(wo.title).toBe(payload.title);
    expect(wo.type).toBe("CORRECTIVE");
    expect(wo.priority).toBe("MEDIUM");
    expect(String(wo.createdById || "")).toBe(actorId);

    const readBack = await authenticatedGet(page, `/api/backend/work-orders/${id}`);
    expect(readBack.status()).toBe(200);
    const readBody = await readBack.json();
    assertNoAccessTokensInBody(readBody);
    const persisted = readBody.data || readBody;
    expect(String(persisted.id || persisted._id)).toBe(String(id));
    expect(persisted.title).toBe(payload.title);
    expect(String(persisted.createdById || "")).toBe(actorId);
  });

  test("E2E-CSRF-004 GET does not require CSRF", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const response = await authenticatedGet(page, "/api/backend/auth/me");
    expect(response.status()).toBe(200);
    const body = await response.json();
    assertNoAccessTokensInBody(body);
    const serialized = JSON.stringify(body);
    expect(serialized).toMatch(/email|"id"/i);
  });

  test("E2E-CSRF-005 login remains CSRF exempt", async ({ request }) => {
    // Isolated request is intentional: no browser session exists yet.
    const response = await request.post("/api/backend/auth/login", {
      data: {
        email: `nobody.${Date.now()}@e2e.maintainpro.test`,
        password: "DefinitelyWrongPass999!"
      }
    });
    expect(response.status()).not.toBe(403);
    expect(response.status()).toBe(401);
  });
});
