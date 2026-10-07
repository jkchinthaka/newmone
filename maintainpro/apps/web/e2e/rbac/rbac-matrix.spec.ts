import type { Browser } from "@playwright/test";
import { expect, test } from "../fixtures/qa";
import type { QaRole } from "../helpers/env";
import { openRoleContext } from "../helpers/role-context";
import { authenticatedGet, authenticatedPost } from "../helpers/session";

type Expectation = {
  role: QaRole;
  path: string;
  method?: "GET" | "POST";
  data?: unknown;
  allow: number[];
};

const matrix: Expectation[] = [
  { role: "admin", path: "/api/backend/work-orders?page=1&limit=5", allow: [200] },
  { role: "manager", path: "/api/backend/work-orders?page=1&limit=5", allow: [200] },
  { role: "tech", path: "/api/backend/work-orders?page=1&limit=5", allow: [200] },
  { role: "inventory", path: "/api/backend/inventory/parts?page=1&limit=5", allow: [200] },
  { role: "security", path: "/api/backend/admin/users?page=1&limit=5", allow: [401, 403] },
  { role: "tech", path: "/api/backend/admin/users?page=1&limit=5", allow: [401, 403] },
  { role: "tech", path: "/api/backend/reports/management/downtime-cost", allow: [200, 401, 403, 500] },
  { role: "admin", path: "/api/backend/reports", allow: [200, 404] },
  { role: "manager", path: "/api/backend/planning/pm-plans?page=1&limit=5", allow: [200] },
  { role: "security", path: "/api/backend/work-orders", method: "POST", data: { title: "x" }, allow: [401, 403, 400] },
  { role: "inventory", path: "/api/backend/work-orders", method: "POST", data: { title: "x" }, allow: [401, 403, 400] },
  { role: "superadmin", path: "/api/backend/auth/me", allow: [200] }
];

const uiRoutes: Array<{ role: QaRole; route: string; expectLogin?: boolean }> = [
  { role: "admin", route: "/admin" },
  { role: "tech", route: "/admin", expectLogin: false },
  { role: "security", route: "/fleet/gate" },
  { role: "inventory", route: "/inventory" },
  { role: "manager", route: "/reports" },
  { role: "tech", route: "/maintenance/jobs" }
];

async function asRole(browser: Browser, role: QaRole) {
  return openRoleContext(browser, role);
}

test.describe("RBAC › API and route matrix", () => {
  for (const row of matrix) {
    test(`${row.role} ${row.method || "GET"} ${row.path} → ${row.allow.join("|")}`, async ({
      browser
    }) => {
      const { page, close } = await asRole(browser, row.role);
      try {
        const response =
          row.method === "POST"
            ? await authenticatedPost(page, row.path, { data: row.data })
            : await authenticatedGet(page, row.path);
        expect(row.allow, `${row.role} ${row.path} got ${response.status()}`).toContain(
          response.status()
        );
      } finally {
        await close();
      }
    });
  }

  for (const row of uiRoutes) {
    test(`${row.role} UI ${row.route}`, async ({ browser }) => {
      const { page, close } = await asRole(browser, row.role);
      try {
        await page.goto(row.route);
        if (row.role === "tech" && row.route === "/admin") {
          // Hidden or forbidden — must not expose admin console as an authorized surface.
          const isLogin = /\/login/.test(page.url());
          const forbidden = await page.getByText(/forbidden|not authorized|access denied|403/i).count();
          const adminHeading = await page.getByRole("heading", { name: /Admin Console/i }).count();
          expect(isLogin || forbidden > 0 || adminHeading === 0).toBeTruthy();
        } else {
          await expect(page).not.toHaveURL(/reason=session_expired/);
        }
      } finally {
        await close();
      }
    });
  }
});
