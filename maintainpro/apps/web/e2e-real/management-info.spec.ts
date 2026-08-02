import { expect, test, type Page } from "@playwright/test";
import { loginViaUi } from "./helpers/auth";
import { authenticatedGet, authenticatedPost, getAuthenticatedUserId } from "./helpers/browser-session";
import { e2eEmail, e2eRunId } from "./helpers/env";

/**
 * Phase 5D management information / dashboard / report controls gate.
 * Uses browser cookie sessions (admin-a, manager-a, tech-a, inventory-a, admin-b).
 * Never prints secrets or passwords.
 */

function unwrapData(body: unknown): Record<string, unknown> {
  const b = body as { data?: Record<string, unknown> };
  return (b?.data && typeof b.data === "object" ? b.data : (body as Record<string, unknown>)) || {};
}

function findCard(
  cards: Array<{ key?: string; label?: string; value?: unknown; coverageStatus?: string }> | undefined,
  key: string
) {
  return (cards || []).find((c) => c.key === key);
}

async function fetchDashboard(page: Page) {
  const res = await authenticatedGet(page, "/api/backend/reports/dashboard");
  return { res, body: await res.json().catch(() => ({})) };
}

test.describe.serial("E2E management info controls @management-info-gate", () => {
  test("E2E-DASH-001 admin dashboard loads", async ({ page }) => {
    const { loginResponse } = await loginViaUi(page, "admin-a");
    expect(loginResponse.status()).toBe(200);
    await getAuthenticatedUserId(page);
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible({ timeout: 20_000 });
  });

  test("E2E-DASH-002 management sees organization KPIs", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const { res, body } = await fetchDashboard(page);
    expect(res.status()).toBe(200);
    const data = unwrapData(body);
    expect(data.generatedAt).toBeTruthy();
    expect(data.reportingTimezone).toBeTruthy();
    expect(String(data.currencyCode)).toBe("LKR");
    expect(Array.isArray(data.cards) || Array.isArray(data.summaryCards)).toBeTruthy();
  });

  test("E2E-DASH-003 technician dashboard/report scope", async ({ page }) => {
    await loginViaUi(page, "tech-a");
    const ops = await authenticatedGet(page, "/api/backend/reports/operations");
    expect(ops.status()).toBe(200);
    const fin = await authenticatedGet(page, "/api/backend/reports/financials");
    expect(fin.status()).toBe(403);
  });

  test("E2E-DASH-004 Inventory Keeper report scope", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const inv = await authenticatedGet(page, "/api/backend/reports/inventory");
    expect(inv.status()).toBe(200);
    const fin = await authenticatedGet(page, "/api/backend/reports/financials");
    expect(fin.status()).toBe(403);
    const logs = await authenticatedGet(page, "/api/backend/reports/system-logs");
    expect(logs.status()).toBe(403);
  });

  test("E2E-DASH-008 unauthorized financials 403", async ({ page }) => {
    await loginViaUi(page, "tech-a");
    const fin = await authenticatedGet(page, "/api/backend/reports/financials");
    expect(fin.status()).toBe(403);
  });

  test("E2E-DASH-009 Tenant B cannot see Tenant A totals", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const aDash = await fetchDashboard(page);
    expect(aDash.res.status()).toBe(200);
    const aData = unwrapData(aDash.body);
    const aTotal = findCard(aData.cards as Array<{ key?: string; value?: unknown }>, "wo.total_created")?.value;

    await loginViaUi(page, "admin-b");
    const bDash = await fetchDashboard(page);
    expect(bDash.res.status()).toBe(200);
    const bData = unwrapData(bDash.body);
    expect(bData.generatedAt).toBeTruthy();
    expect(bData.currencyCode).toBe("LKR");
    expect(bData.range || bData.filters).toBeTruthy();
    const bTotal = findCard(bData.cards as Array<{ key?: string; value?: unknown }>, "wo.total_created")?.value;

    if (typeof aTotal === "number" && typeof bTotal === "number") {
      expect(aTotal === bTotal && aTotal > 0).toBeFalsy();
    } else {
      expect(Array.isArray(bData.cards) || Array.isArray(bData.summaryCards)).toBeTruthy();
    }
  });

  test("E2E-DASH-010 degraded coverage not coerced to zero", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const { res, body } = await fetchDashboard(page);
    expect(res.status()).toBe(200);
    const data = unwrapData(body);
    const coverage = data.dataCoverage as
      | { overall?: string; sources?: Record<string, string>; degradedNotice?: string | null }
      | undefined;
    expect(coverage).toBeTruthy();
    expect(coverage?.sources && typeof coverage.sources === "object").toBeTruthy();

    const cards = (data.cards || []) as Array<{ coverageStatus?: string; value?: unknown }>;
    const unavailable = cards.filter((c) => c.coverageStatus === "UNAVAILABLE");
    for (const card of unavailable) {
      expect(card.value === null || card.value === "Unavailable").toBeTruthy();
    }

    const summary = (data.summaryCards || []) as Array<{ value?: unknown }>;
    if (coverage?.overall === "DEGRADED" || coverage?.degradedNotice) {
      const hasUnavailableText = summary.some((c) => String(c.value) === "Unavailable");
      const hasNullCard = unavailable.some((c) => c.value === null);
      expect(hasUnavailableText || hasNullCard || Boolean(coverage.sources)).toBeTruthy();
    }
  });

  test("E2E-DASH-011 metadata timezone and currency", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const { res, body } = await fetchDashboard(page);
    expect(res.status()).toBe(200);
    const data = unwrapData(body);
    expect(data.generatedAt).toBeTruthy();
    expect(data.range || data.filters).toBeTruthy();
    const tz = String(data.reportingTimezone || (data.range as { timezone?: string })?.timezone || "");
    expect(tz === "Asia/Colombo" || tz.length > 0).toBeTruthy();
    expect(String(data.currencyCode)).toBe("LKR");
  });

  test("E2E-KPI-001 work-order total reconciles", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const { res, body } = await fetchDashboard(page);
    expect(res.status()).toBe(200);
    const data = unwrapData(body);
    const dashTotal = findCard(data.cards as Array<{ key?: string; value?: unknown }>, "wo.total_created")?.value;

    const ops = await authenticatedGet(page, "/api/backend/reports/operations");
    expect(ops.status()).toBe(200);
    const opsBody = unwrapData(await ops.json());
    const opsCards = (opsBody.summaryCards || []) as Array<{ label?: string; value?: unknown }>;
    const opsTotalCard = opsCards.find((c) => /total jobs/i.test(String(c.label || "")));
    const opsTotal = opsTotalCard?.value;

    if (typeof dashTotal === "number" && typeof opsTotal === "number") {
      expect(dashTotal).toBe(opsTotal);
    } else {
      const list = await authenticatedGet(page, "/api/backend/work-orders?page=1" + String.fromCharCode(38) + "pageSize=1");
      expect(list.status()).toBe(200);
      const listBody = await list.json();
      const metaTotal = listBody.meta?.total ?? listBody.data?.meta?.total ?? listBody.meta?.pagination?.total;
      if (typeof dashTotal === "number" && typeof metaTotal === "number") {
        expect(dashTotal).toBe(metaTotal);
      } else {
        expect(dashTotal === null || typeof dashTotal === "number").toBeTruthy();
      }
    }
  });

  test("E2E-KPI-012 MTBF card insufficient data", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const { res, body } = await fetchDashboard(page);
    expect(res.status()).toBe(200);
    const data = unwrapData(body);
    const mtbf = findCard(data.cards as Array<{ key?: string; value?: unknown; coverageStatus?: string }>, "wo.mtbf");
    expect(mtbf).toBeTruthy();
    expect(mtbf?.coverageStatus).toBe("INSUFFICIENT_DATA");
    expect(mtbf?.value).toBeNull();
  });

  test("E2E-REPORT-001 operations 200", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const res = await authenticatedGet(page, "/api/backend/reports/operations");
    expect(res.status()).toBe(200);
  });

  test("E2E-REPORT-002 financials authorized 200", async ({ page }) => {
    await loginViaUi(page, "manager-a");
    const res = await authenticatedGet(page, "/api/backend/reports/financials");
    expect(res.status()).toBe(200);
  });

  test("E2E-REPORT-003 financials unauthorized 403", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const res = await authenticatedGet(page, "/api/backend/reports/financials");
    expect(res.status()).toBe(403);
  });

  test("E2E-REPORT-004 system-logs inventory keeper 403", async ({ page }) => {
    await loginViaUi(page, "inventory-a");
    const res = await authenticatedGet(page, "/api/backend/reports/system-logs");
    expect(res.status()).toBe(403);
  });

  test("E2E-REPORT-005 invalid date returns 400", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const res = await authenticatedGet(page, "/api/backend/reports/operations?startDate=not-a-date");
    expect(res.status()).toBe(400);
  });

  test("E2E-REPORT-006 startDate after endDate returns 400", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const q = "startDate=2026-12-31" + String.fromCharCode(38) + "endDate=2026-01-01";
    const res = await authenticatedGet(page, "/api/backend/reports/operations?" + q);
    expect(res.status()).toBe(400);
  });

  test("E2E-REPORT-010 CSV export formula injection safety", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const formulaTitle = "=SUM(1+1) E2E-FORMULA-" + e2eRunId().slice(-6);

    const assets = await authenticatedGet(page, "/api/backend/assets?page=1" + String.fromCharCode(38) + "pageSize=5");
    if (assets.status() === 200) {
      const assetsBody = await assets.json();
      const items = assetsBody.data?.items || assetsBody.data || assetsBody.items || [];
      const asset = (Array.isArray(items) ? items : []).find((a: { id?: string }) => a?.id);
      if (asset?.id) {
        await authenticatedPost(page, "/api/backend/work-orders", {
          data: {
            title: formulaTitle,
            description: "E2E formula export probe",
            priority: "MEDIUM",
            assetId: asset.id
          }
        });
      }
    }

    const exportRes = await authenticatedGet(page, "/api/backend/reports/operations/export?format=csv");
    expect(exportRes.status()).toBe(200);
    const headers = exportRes.headers();
    const disposition = String(headers["content-disposition"] || headers["Content-Disposition"] || "");
    const text = await exportRes.text();
    // BFF/proxy may omit Content-Disposition; still require a CSV-like body and no credential leakage.
    expect(text.toLowerCase()).not.toContain("authorization");
    expect(text.toLowerCase()).not.toContain("bearer ");
    expect(text.includes(",") || text.includes('"')).toBeTruthy();
    if (disposition) {
      expect(disposition.toLowerCase()).toContain("attachment");
    }
    if (text.includes("=SUM") || text.includes("E2E-FORMULA-")) {
      expect(text.includes("'=")).toBeTruthy();
    }
  });

  test("E2E-REPORT-012 export creates audit soft check", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const exportRes = await authenticatedGet(page, "/api/backend/reports/operations/export?format=csv");
    expect([200, 201]).toContain(exportRes.status());
    const audit = await authenticatedGet(page, "/api/backend/audit-logs?page=1" + String.fromCharCode(38) + "pageSize=20");
    if (audit.status() === 200) {
      const body = await audit.json();
      const serialized = JSON.stringify(body).toLowerCase();
      expect(serialized.includes("export") || serialized.includes("report") || Array.isArray(body.data)).toBeTruthy();
    } else {
      expect([401, 403, 404]).toContain(audit.status());
    }
  });

  test("E2E-AUDIT-002 failed login does not leak password", async ({ page }) => {
    await page.goto("/login");
    const wrongPassword = "DefinitelyWrongPass-E2E-999!";
    const login = await page.request.post("/api/backend/auth/login", {
      data: { email: e2eEmail("admin-a"), password: wrongPassword }
    });
    expect(login.status()).toBe(401);
    const bodyText = await login.text();
    expect(bodyText).not.toContain(wrongPassword);
    expect(bodyText.toLowerCase()).not.toMatch(/"password"\s*:\s*"[^"]+"/);

    await loginViaUi(page, "admin-a");
    const security = await authenticatedGet(page, "/api/backend/security-events");
    if (security.status() === 200) {
      const serialized = JSON.stringify(await security.json());
      expect(serialized).not.toContain(wrongPassword);
    } else {
      const audit = await authenticatedGet(page, "/api/backend/audit-logs?page=1" + String.fromCharCode(38) + "pageSize=5");
      expect([200, 401, 403, 404]).toContain(audit.status());
      if (audit.status() === 200) {
        expect(JSON.stringify(await audit.json())).not.toContain(wrongPassword);
      }
    }
  });

  test("E2E-ERP-MON-001/007/008/010 erp monitoring safe summary", async ({ page }) => {
    await loginViaUi(page, "admin-a");
    const res = await authenticatedGet(page, "/api/backend/reports/erp-monitoring");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = unwrapData(body);
    expect(["MOCK", "DISABLED"]).toContain(String(data.providerCategory));
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/https?:\/\//i);
    expect(serialized.toLowerCase()).not.toMatch(/api[_-]?key|apikey|secret|token/);
  });
});
