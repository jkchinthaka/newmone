import { expect, test } from "@playwright/test";
import { loginViaUi, readCookieMap } from "./helpers/auth";

test.describe("E2E CSRF @full-stack @security", () => {
  test("E2E-CSRF-001 mutation without CSRF returns 403", async ({ page, request }) => {
    await loginViaUi(page, "admin-a");
    const response = await request.post("/api/backend/work-orders", {
      data: { title: "csrf-missing", description: "x", type: "CORRECTIVE", priority: "LOW" }
    });
    expect(response.status()).toBe(403);
  });

  test("E2E-CSRF-002 incorrect CSRF returns 403", async ({ page, request }) => {
    await loginViaUi(page, "admin-a");
    const response = await request.post("/api/backend/work-orders", {
      headers: { "x-csrf-token": "definitely-wrong-csrf" },
      data: { title: "csrf-wrong", description: "x", type: "CORRECTIVE", priority: "LOW" }
    });
    expect(response.status()).toBe(403);
  });

  test("E2E-CSRF-003 correct CSRF allows mutation path", async ({ page, request }) => {
    await loginViaUi(page, "manager-a");
    const cookies = await readCookieMap(page);
    const csrf = cookies.get("maintainpro_csrf")?.value;
    expect(csrf).toBeTruthy();
    const response = await request.post("/api/backend/work-orders", {
      headers: { "x-csrf-token": csrf! },
      data: {
        title: "E2E CSRF WO",
        description: "Created with CSRF",
        type: "CORRECTIVE",
        priority: "MEDIUM"
      }
    });
    // 201/200 success, or 400 validation if payload shape differs — never 403
    expect(response.status()).not.toBe(403);
    expect([200, 201, 400, 422]).toContain(response.status());
  });

  test("E2E-CSRF-004 GET does not require CSRF", async ({ page, request }) => {
    await loginViaUi(page, "admin-a");
    const response = await request.get("/api/backend/auth/me");
    expect(response.status()).toBe(200);
  });

  test("E2E-CSRF-005 login remains CSRF exempt", async ({ request }) => {
    const response = await request.post("/api/backend/auth/login", {
      data: { email: "nobody@e2e.maintainpro.test", password: "x" }
    });
    expect(response.status()).not.toBe(403);
  });
});