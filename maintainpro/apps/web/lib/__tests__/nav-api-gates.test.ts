import assert from "node:assert/strict";
import test from "node:test";

import { canAccessNavigationPath, getVisibleNavigationItems } from "../navigation";

// Seeded keys (plus the v1.0.3 request grant) for the login groups used at Nelna.
const TECHNICIAN = ["dashboard.view", "work_orders.view_own", "work_orders.update_status", "maintenance_requests.create", "maintenance_requests.view_own", "planning.view", "planning.manage"];
const SECURITY_OFFICER = ["dashboard.view", "vehicles.view", "vehicles.operate", "gate.out.create", "gate.in.create", "maintenance_requests.create"];
const INVENTORY_KEEPER = ["dashboard.view", "inventory.manage", "inventory.stock_issue", "part_requests.view", "part_requests.issue", "maintenance_requests.create"];
const hrefs = (role: string, permissions: string[]) => getVisibleNavigationItems(role, { permissions }).map((item) => item.href);

test("menu items whose page request the API refuses are hidden", () => {
  // Owner decision 2026-10-22: technicians view assets and run inspections/PM checklists.
  const tech = hrefs("TECHNICIAN", TECHNICIAN);
  assert.equal(tech.includes("/assets"), true);
  assert.equal(tech.includes("/maintenance/inspections"), true);
  assert.equal(tech.includes("/maintenance/plans"), true);
  // Without planning.view (e.g. a database where the grant script has not run) they stay hidden.
  const before = hrefs("TECHNICIAN", TECHNICIAN.filter((key) => !key.startsWith("planning.")));
  assert.equal(before.includes("/maintenance/inspections"), false);
  assert.equal(before.includes("/maintenance/plans"), false);

  const security = hrefs("SECURITY_OFFICER", SECURITY_OFFICER);
  assert.equal(security.includes("/fleet"), false, "fleet overview excludes SECURITY_OFFICER");
  assert.equal(security.includes("/fleet/gate"), false, "gate screen retired from the UI");
  assert.equal(security.includes("/requests"), true);
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
