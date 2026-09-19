import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolveDashboardVariant,
  normalizeDashboardRole,
  dashboardShowsWorkOrdersSummary,
  dashboardShowsInventorySummary,
  dashboardShowsReportsSummary,
  dashboardIsReadOnly,
  type DashboardVariant
} from "../dashboard-roles";

/**
 * Every role in the backend-authoritative Prisma RoleName enum
 * (apps/api/src/database/prisma-enums.ts), paired with the variant the
 * frontend must resolve it to. This is the canonical 27-role matrix; keep it
 * in sync any time RoleName or resolveDashboardVariant's buckets change.
 */
const REAL_ROLE_VARIANT_MATRIX: Array<[string, DashboardVariant]> = [
  ["SUPER_ADMIN", "admin"],
  ["ADMIN", "admin"],
  ["OPERATIONS_MANAGER", "management"],
  ["FLEET_MANAGER", "management"],
  ["COMPLIANCE_MANAGER", "management"],
  ["MANAGER", "management"],
  ["TECHNICIAN", "technician"],
  ["MECHANIC", "technician"],
  ["ASSET_MANAGER", "management"],
  ["INVENTORY_KEEPER", "inventory"],
  ["PROCUREMENT_OFFICER", "procurement"],
  ["FINANCE", "finance"],
  ["SUPERVISOR", "management"],
  ["SECURITY_OFFICER", "management"],
  ["CLEANER", "cleaner"],
  ["DRIVER", "driver"],
  ["VIEWER", "viewer"],
  ["FARM_OWNER", "management"],
  ["FARM_MANAGER", "management"],
  ["FIELD_SUPERVISOR", "management"],
  ["AGRONOMIST", "management"],
  ["VETERINARIAN", "management"],
  ["FARM_WORKER", "management"],
  ["IRRIGATION_OPERATOR", "management"],
  ["HARVEST_CREW", "management"],
  ["FACILITY_MANAGER", "management"],
  ["BUILDING_SUPERVISOR", "management"]
];

test(`resolveDashboardVariant: all ${REAL_ROLE_VARIANT_MATRIX.length} real RoleName enum roles`, () => {
  for (const [role, expected] of REAL_ROLE_VARIANT_MATRIX) {
    assert.equal(
      resolveDashboardVariant(role),
      expected,
      `role ${role} should resolve to variant "${expected}"`
    );
  }
});

test("resolveDashboardVariant: known frontend/backend drift roles (referenced in UI code but absent from RoleName enum) still resolve sensibly", () => {
  // These are not in the real backend RoleName enum (see prisma-enums.ts) but
  // are referenced by frontend role tables. They must not throw and must land
  // on a defensible bucket rather than crash the UI.
  assert.equal(resolveDashboardVariant("MAINTENANCE_SUPERVISOR"), "management");
  assert.equal(resolveDashboardVariant("STOREKEEPER"), "inventory");
  assert.equal(resolveDashboardVariant("FINANCE_APPROVER"), "finance");
  assert.equal(resolveDashboardVariant("AUDITOR"), "viewer");
  // REQUESTER and VENDOR are not in any bucket set at all -> minimal fallback.
  assert.equal(resolveDashboardVariant("REQUESTER"), "minimal");
  assert.equal(resolveDashboardVariant("VENDOR"), "minimal");
});

test("resolveDashboardVariant: null/undefined/blank -> minimal", () => {
  assert.equal(resolveDashboardVariant(null), "minimal");
  assert.equal(resolveDashboardVariant(undefined), "minimal");
  assert.equal(resolveDashboardVariant(""), "minimal");
  assert.equal(resolveDashboardVariant("   "), "minimal");
});

test("resolveDashboardVariant: unknown role string -> minimal (never throws)", () => {
  assert.equal(resolveDashboardVariant("SOME_UNRECOGNIZED_ROLE"), "minimal");
});

test("resolveDashboardVariant: case-insensitive", () => {
  assert.equal(resolveDashboardVariant("manager"), "management");
  assert.equal(resolveDashboardVariant("Manager"), "management");
  assert.equal(resolveDashboardVariant("  technician  "), "technician");
});

test("normalizeDashboardRole: uppercases and trims via extractRoleName", () => {
  assert.equal(normalizeDashboardRole(" finance "), "FINANCE");
  assert.equal(normalizeDashboardRole(null), null);
});

test("dashboardShowsWorkOrdersSummary: admin/management/finance/procurement/technician only", () => {
  const yes: DashboardVariant[] = ["admin", "management", "finance", "procurement", "technician"];
  const no: DashboardVariant[] = ["cleaner", "inventory", "driver", "viewer", "minimal"];
  for (const v of yes) assert.equal(dashboardShowsWorkOrdersSummary(v), true, v);
  for (const v of no) assert.equal(dashboardShowsWorkOrdersSummary(v), false, v);
});

test("dashboardShowsInventorySummary: admin/inventory/procurement only", () => {
  assert.equal(dashboardShowsInventorySummary("admin"), true);
  assert.equal(dashboardShowsInventorySummary("inventory"), true);
  assert.equal(dashboardShowsInventorySummary("procurement"), true);
  assert.equal(dashboardShowsInventorySummary("finance"), false);
  assert.equal(dashboardShowsInventorySummary("management"), false);
});

test("dashboardShowsReportsSummary: admin/management/finance/procurement/viewer only", () => {
  const yes: DashboardVariant[] = ["admin", "management", "finance", "procurement", "viewer"];
  const no: DashboardVariant[] = ["technician", "cleaner", "inventory", "driver", "minimal"];
  for (const v of yes) assert.equal(dashboardShowsReportsSummary(v), true, v);
  for (const v of no) assert.equal(dashboardShowsReportsSummary(v), false, v);
});

test("dashboardIsReadOnly: viewer/minimal only (dashboard-roles copy predates the finance read-only fix)", () => {
  assert.equal(dashboardIsReadOnly("viewer"), true);
  assert.equal(dashboardIsReadOnly("minimal"), true);
  assert.equal(dashboardIsReadOnly("finance"), false);
  assert.equal(dashboardIsReadOnly("admin"), false);
});
