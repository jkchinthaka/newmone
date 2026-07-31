import { expect, test } from "@playwright/test";
import { assertLoopbackBaseURL } from "./helpers/env";

test.describe("E2E infrastructure @full-stack @smoke", () => {
  test("E2E-INFRA-001 login page through Nginx returns 200", async ({ page, baseURL }) => {
    assertLoopbackBaseURL(baseURL!);
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  test("E2E-INFRA-002 /api/health through Nginx returns 200", async ({ request, baseURL }) => {
    assertLoopbackBaseURL(baseURL!);
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(JSON.stringify(json)).not.toMatch(/mongodb:\/\//i);
  });

  test("E2E-INFRA-003 unauthenticated /api/backend/auth/me returns 401 not 404", async ({
    request
  }) => {
    const response = await request.get("/api/backend/auth/me");
    expect(response.status()).toBe(401);
    expect(response.status()).not.toBe(404);
  });

  test("E2E-INFRA-004 /api/backend reaches BFF", async ({ request }) => {
    const response = await request.get("/api/backend/auth/me");
    // BFF returns JSON envelope / auth error, not nginx HTML 404
    const ct = response.headers()["content-type"] || "";
    expect(ct).toContain("application/json");
  });

  test("E2E-INFRA-005 generic /api reaches Nest", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
  });

  test("E2E-INFRA-008 runtime Git SHA present in health metadata", async ({ request }) => {
    const response = await request.get("/api/health");
    const json = await response.json();
    const payload = json.data || json;
    const commit = payload.build?.commit || payload.commitSha || payload.build?.commitSha;
    expect(commit).toBeTruthy();
    expect(String(commit).toLowerCase()).not.toBe("unknown");
  });

  test("E2E-INFRA-009 no production hostname in E2E_BASE_URL", async ({ baseURL }) => {
    assertLoopbackBaseURL(baseURL!);
    expect(baseURL).not.toMatch(/workers\.dev|azure|render\.com/i);
  });

  test("E2E-INFRA-010 database name prefix configured", async () => {
    const name = (process.env.PRIMARY_DATABASE_NAME || "").trim();
    expect(name.startsWith("maintainpro_e2e_")).toBeTruthy();
  });
});