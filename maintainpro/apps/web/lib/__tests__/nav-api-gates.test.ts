import assert from "node:assert/strict";
import test from "node:test";

import { canAccessNavigationPath, getVisibleNavigationItems } from "../navigation";

// Seeded keys (plus the v1.0.3 request grant) for the login groups used at Nelna.
const TECHNICIAN = ["dashboard.view", "work_orders.view_own", "work_orders.update_status", "maintenance_requests.create", "maintenance_requests.view_own"];
const SECURITY_OFFICER = ["dashboard.view", "vehicles.view", "vehicles.operate", "gate.out.create", "gate.in.create", "maintenance_requests.create"];
const INVENTORY_KEEPER = ["dashboard.view", "inventory.manage", "inventory.stock_issue", "part_requests.view", "part_requests.issue", "maintenance_requests.create"];
const hrefs = (role: string, permissions: string[]) => getVisibleNavigationItems(role, { permissions }).map((item) => item.href);

test("menu items whose page request the API refuses are hidden", () => {
  const tech = hrefs("TECHNICIAN", TECHNICIAN);
  assert.equal(tech.includes("/assets"), false, "GET /assets has no TECHNICIAN in @Roles");
  assert.equal(tech.includes("/maintenance/inspections"), false, "needs planning.view");
  assert.equal(tech.includes("/maintenance/plans"), false, "needs planning.view");
  assert.equal(tech.includes("/work-orders/my") || tech.some((h) => h.startsWith("/work-orders")), true);

  const security = hrefs("SECURITY_OFFICER", SECURITY_OFFICER);
  assert.equal(security.includes("/fleet"), false, "fleet overview excludes SECURITY_OFFICER");
  assert.equal(security.includes("/fleet/gate"), true);
});

test("everyone who can raise a request can open My requests", () => {
  for (const [role, keys] of [["SECURITY_OFFICER", SECURITY_OFFICER], ["INVENTORY_KEEPER", INVENTORY_KEEPER], ["TECHNICIAN", TECHNICIAN]] as const) {
    assert.equal(canAccessNavigationPath("/requests/mine", role, [...keys]), true, role);
  }
});

test("admin pages follow the API: bulk imports are SUPER_ADMIN only", () => {
  assert.equal(canAccessNavigationPath("/admin/bulk-imports", "ADMIN", ["users.view", "settings.view"]), false);
  assert.equal(canAccessNavigationPath("/admin/bulk-imports", "SUPER_ADMIN", []), true);
});
