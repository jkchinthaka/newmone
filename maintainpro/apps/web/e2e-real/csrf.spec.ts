import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import {
  authenticatedGet,
  authenticatedMutationWithoutCsrf,
  authenticatedMutationWithWrongCsrf,
  authenticatedPost
} from "./helpers/browser-session";

const WO_PAYLOAD = {
  title: "E2E CSRF WO",
  description: "Created with CSRF",
  type: "CORRECTIVE",
  priority: "MEDIUM"
};

test.describe("E2E CSRF @full-stack @security", () => {
  test("E2E-CSRF-001 mutation without CSRF returns 403", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    // Browser cookies present; omit only the CSRF header.
    const response = await authenticatedMutationWithoutCsrf(page, "/api/backend/work-orders", {
      data: { ...WO_PAYLOAD, title: "csrf-missing" }
    });
    expect(response.status()).toBe(403);
    expect(response.status()).not.toBe(401);
    const json = (await response.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("CSRF_INVALID");
  });

  test("E2E-CSRF-002 incorrect CSRF returns 403", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const response = await authenticatedMutationWithWrongCsrf(page, "/api/backend/work-orders", {
      data: { ...WO_PAYLOAD, title: "csrf-wrong" }
    });
    expect(response.status()).toBe(403);
    expect(response.status()).not.toBe(401);
    const json = (await response.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe("CSRF_INVALID");
  });

  test("E2E-CSRF-003 correct CSRF allows mutation path", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const response = await authenticatedPost(page, "/api/backend/work-orders", {
      data: WO_PAYLOAD
    });
    // Exact Nest POST create default is 201 Created for a new work-order resource.
    expect(response.status()).toBe(201);
    const body = await response.json();
    const wo = body.data || body;
    const id = wo.id || wo._id;
    expect(id).toBeTruthy();
  });

  test("E2E-CSRF-004 GET does not require CSRF", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const response = await authenticatedGet(page, "/api/backend/auth/me");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/"accessToken"\s*:/);
    expect(serialized).not.toMatch(/"refreshToken"\s*:/);
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
