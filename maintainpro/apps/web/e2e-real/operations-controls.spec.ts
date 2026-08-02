import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import { authenticatedGet, authenticatedPost, getAuthenticatedUserId } from "./helpers/browser-session";

/**
 * Phase 6B operations controls gate.
 * Never prints secrets or passwords.
 */

test.describe.serial("E2E operations controls @operations-gate", () => {
  test("E2E-OPS-001 live 200", async ({ page }) => {
    const res = await page.request.get("/api/health/live");
    expect(res.status()).toBe(200);
  });

  test("E2E-OPS-002 ready 200", async ({ page }) => {
    const res = await page.request.get("/api/health/ready");
    expect(res.status()).toBe(200);
  });

  test("E2E-OPS-003 detailed readiness unauthorized", async ({ page }) => {
    const res = await page.request.get("/api/health/readiness");
    expect([401, 403]).toContain(res.status());
  });

  test("E2E-OPS-004 admin readiness 200", async ({ page }) => {
    const { loginResponse } = await loginViaUi(page, "admin-a");
    expect(loginResponse.status()).toBe(200);
    await getAuthenticatedUserId(page);
    const res = await authenticatedGet(page, "/api/backend/health/readiness");
    expect(res.status()).toBe(200);
  });

  test("E2E-OPS-005 request id returned", async ({ page }) => {
    const reqId = "ops-e2e-corr-001";
    const res = await page.request.get("/api/health/live", {
      headers: { "X-Request-Id": reqId }
    });
    expect(res.status()).toBe(200);
    const raw = res.headers()["x-request-id"];
    const returned = String(Array.isArray(raw) ? raw[0] : raw || "")
      .split(",")[0]
      .trim();
    expect(returned.length).toBeGreaterThan(0);
    expect(/^[A-Za-z0-9\-_.:]{8,64}$/.test(returned)).toBeTruthy();
  });

  test("E2E-OPS-006 invalid request id does not crash", async ({ page }) => {
    const res = await page.request.get("/api/health/live", {
      headers: { "X-Request-Id": "bad id with spaces !!!" }
    });
    expect(res.status()).toBe(200);
    const rawInvalid = res.headers()["x-request-id"];
    const returned = String(Array.isArray(rawInvalid) ? rawInvalid[0] : rawInvalid || "")
      .split(",")[0]
      .trim();
    expect(returned.length).toBeGreaterThan(0);
    expect(returned).not.toContain(" ");
  });

  test("E2E-OPS-009 metrics unauthorized without auth", async ({ page }) => {
    const res = await page.request.get("/api/operations/metrics");
    expect([401, 403]).toContain(res.status());
  });

  test("E2E-OPS-011 soft alerts evaluate", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const res = await authenticatedPost(page, "/api/backend/operations/alerts/evaluate");
    expect(res.status(), "alerts/evaluate must not be missing").not.toBe(404);
    expect([200, 201]).toContain(res.status());
  });

  test("E2E-OPS-012 soft alerts list after evaluate", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const evalRes = await authenticatedPost(page, "/api/backend/operations/alerts/evaluate");
    expect(evalRes.status(), "alerts/evaluate must not be missing").not.toBe(404);
    const list = await authenticatedGet(page, "/api/backend/operations/alerts");
    expect(list.status(), "alerts list must not be missing").not.toBe(404);
    expect([200, 201]).toContain(list.status());
  });

  test("E2E-OPS-013 soft metrics after login", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const res = await authenticatedGet(page, "/api/backend/operations/metrics");
    expect(res.status(), "operations/metrics must not be missing").not.toBe(404);
    expect([200, 201]).toContain(res.status());
  });

  test("E2E-OPS-014 soft queue reconciliation status", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const res = await authenticatedGet(page, "/api/backend/operations/queue-reconciliation");
    expect(res.status(), "queue-reconciliation must not be missing").not.toBe(404);
    expect([200, 201]).toContain(res.status());
  });
});
