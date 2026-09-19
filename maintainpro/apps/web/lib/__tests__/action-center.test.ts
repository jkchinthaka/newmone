import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolveActionCenterVariant,
  resolveFacilityIssuesSource,
  actionCenterShowsFacilityIssues,
  actionCenterShowsFinanceSignals,
  actionCenterShowsInventory,
  actionCenterShowsWorkOrders,
  actionCenterShowsInvitations,
  actionCenterIsReadOnly,
  buildActionCenterSections,
  filterActionCenterSections,
  type ActionCenterSnapshot,
  type ActionCenterVariant
} from "../action-center";

function emptySnapshot(overrides: Partial<ActionCenterSnapshot> = {}): ActionCenterSnapshot {
  return {
    variant: "minimal",
    roleName: null,
    connections: {
      workOrders: false,
      inventory: false,
      systemHealth: false,
      invitations: false,
      facilityIssues: false
    },
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// resolveActionCenterVariant just delegates to resolveDashboardVariant
// ---------------------------------------------------------------------------

test("resolveActionCenterVariant delegates to resolveDashboardVariant", () => {
  assert.equal(resolveActionCenterVariant("PROCUREMENT_OFFICER"), "procurement");
  assert.equal(resolveActionCenterVariant("FINANCE"), "finance");
  assert.equal(resolveActionCenterVariant(null), "minimal");
});

// ---------------------------------------------------------------------------
// resolveFacilityIssuesSource / actionCenterShowsFacilityIssues
//
// Regression coverage for the RBAC-mismatch bug: showing the facility section
// for a `variant === "management"` role used to guarantee a 403 for roles
// that have no backend access to either facility endpoint. Gating must now be
// by real per-role backend authorization, not by the coarse variant bucket.
// ---------------------------------------------------------------------------

test("resolveFacilityIssuesSource: dashboard-authorized roles", () => {
  for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "FACILITY_MANAGER", "BUILDING_SUPERVISOR", "SUPERVISOR", "VIEWER"]) {
    assert.equal(resolveFacilityIssuesSource(role), "dashboard", role);
  }
});

test("resolveFacilityIssuesSource: legacy-cleaning-only roles", () => {
  assert.equal(resolveFacilityIssuesSource("CLEANER"), "cleaning");
  assert.equal(resolveFacilityIssuesSource("ASSET_MANAGER"), "cleaning");
});

test("resolveFacilityIssuesSource: management-bucket roles with NO backend facility access resolve to 'none' (would previously guarantee a 403)", () => {
  for (const role of ["FLEET_MANAGER", "COMPLIANCE_MANAGER", "OPERATIONS_MANAGER", "SECURITY_OFFICER"]) {
    assert.equal(resolveFacilityIssuesSource(role), "none", role);
    assert.equal(actionCenterShowsFacilityIssues("management", role), false, role);
  }
});

test("resolveFacilityIssuesSource: null/unknown role -> none", () => {
  assert.equal(resolveFacilityIssuesSource(null), "none");
  assert.equal(resolveFacilityIssuesSource("TOTALLY_UNKNOWN"), "none");
});

test("actionCenterShowsFacilityIssues: true exactly when resolveFacilityIssuesSource is not 'none', regardless of variant", () => {
  assert.equal(actionCenterShowsFacilityIssues("management", "MANAGER"), true);
  assert.equal(actionCenterShowsFacilityIssues("cleaner", "CLEANER"), true);
  assert.equal(actionCenterShowsFacilityIssues("admin", "SECURITY_OFFICER"), false);
});

// ---------------------------------------------------------------------------
// Finance / procurement variant gating (previously fell back to REQUESTER-ish
// generic content instead of real finance/procurement signals)
// ---------------------------------------------------------------------------

test("actionCenterShowsFinanceSignals: finance variant only", () => {
  assert.equal(actionCenterShowsFinanceSignals("finance"), true);
  assert.equal(actionCenterShowsFinanceSignals("procurement"), false);
  assert.equal(actionCenterShowsFinanceSignals("management"), false);
});

test("actionCenterShowsInventory: admin/inventory/management/procurement", () => {
  for (const v of ["admin", "inventory", "management", "procurement"] as ActionCenterVariant[]) {
    assert.equal(actionCenterShowsInventory(v), true, v);
  }
  assert.equal(actionCenterShowsInventory("finance"), false);
});

test("actionCenterShowsWorkOrders: admin/management/technician/viewer", () => {
  for (const v of ["admin", "management", "technician", "viewer"] as ActionCenterVariant[]) {
    assert.equal(actionCenterShowsWorkOrders(v), true, v);
  }
  assert.equal(actionCenterShowsWorkOrders("finance"), false);
  assert.equal(actionCenterShowsWorkOrders("procurement"), false);
});

test("actionCenterShowsInvitations: SUPER_ADMIN/ADMIN only, by real role not variant", () => {
  assert.equal(actionCenterShowsInvitations("SUPER_ADMIN"), true);
  assert.equal(actionCenterShowsInvitations("ADMIN"), true);
  assert.equal(actionCenterShowsInvitations("MANAGER"), false);
  assert.equal(actionCenterShowsInvitations(null), false);
});

test("actionCenterIsReadOnly: viewer/minimal/finance", () => {
  assert.equal(actionCenterIsReadOnly("viewer"), true);
  assert.equal(actionCenterIsReadOnly("minimal"), true);
  assert.equal(actionCenterIsReadOnly("finance"), true);
  assert.equal(actionCenterIsReadOnly("admin"), false);
  assert.equal(actionCenterIsReadOnly("management"), false);
});

// ---------------------------------------------------------------------------
// buildActionCenterSections: structural / per-variant section presence
// ---------------------------------------------------------------------------

test("buildActionCenterSections: finance variant gets a finance section and no facility section (no facility role)", () => {
  const snapshot = emptySnapshot({
    variant: "finance",
    roleName: "FINANCE",
    connections: { workOrders: true, inventory: false, systemHealth: false, invitations: false, facilityIssues: false },
    workOrders: { open: 1, inProgress: 0, overdue: 0, highPriority: 0, financeVendorPending: 3 }
  });
  const sections = buildActionCenterSections(snapshot);
  const ids = sections.map((s) => s.id);
  assert.ok(ids.includes("finance"), `expected a finance section, got: ${ids.join(", ")}`);
  assert.ok(!ids.includes("facility"), "FINANCE role has no facility backend access and should get no facility section");
  assert.ok(ids.includes("reports"));

  const financeSection = sections.find((s) => s.id === "finance")!;
  assert.equal(financeSection.items[0].metricValue, "3");
});

test("buildActionCenterSections: procurement variant gets inventory but not finance", () => {
  const snapshot = emptySnapshot({
    variant: "procurement",
    roleName: "PROCUREMENT_OFFICER",
    connections: { workOrders: false, inventory: true, systemHealth: false, invitations: false, facilityIssues: false },
    inventory: { lowStockCount: 2, criticalCount: 0, pendingPurchaseOrders: 5 }
  });
  const sections = buildActionCenterSections(snapshot);
  const ids = sections.map((s) => s.id);
  assert.ok(ids.includes("inventory"));
  assert.ok(!ids.includes("finance"));
});

test("buildActionCenterSections: minimal variant gets the minimal section with Notifications/Settings, never a /dashboard self-loop card", () => {
  const snapshot = emptySnapshot({ variant: "minimal", roleName: "SOME_UNKNOWN_ROLE" });
  const sections = buildActionCenterSections(snapshot);
  const minimal = sections.find((s) => s.id === "minimal");
  assert.ok(minimal, "minimal variant should include the minimal section");
  const hrefs = minimal!.items.map((i) => i.href);
  assert.ok(!hrefs.includes("/dashboard"), "must not link back to the self-redirecting /dashboard route");
  assert.ok(hrefs.includes("/notifications"));
  assert.ok(hrefs.includes("/settings"));
});

test("buildActionCenterSections: facility section is present, with a visible degraded item (not a silent empty state), when the feed is down for an authorized role", () => {
  const snapshot = emptySnapshot({
    variant: "management",
    roleName: "MANAGER",
    connections: { workOrders: false, inventory: false, systemHealth: false, invitations: false, facilityIssues: false },
    errors: { facilityIssues: "server" }
  });
  const sections = buildActionCenterSections(snapshot);
  const facility = sections.find((s) => s.id === "facility");
  assert.ok(facility, "MANAGER is facility-dashboard-authorized and should still get the section even when the feed failed");
  assert.ok(facility!.items.length > 0, "degraded facility state must render a real item, not an unreachable empty-state");
  assert.ok(facility!.items.some((i) => i.id === "facility-issues-unavailable"));
});

test("buildActionCenterSections: sections with zero items and no emptyTitle are dropped", () => {
  // admin variant with everything disconnected and no errors recorded still
  // produces emptyTitle-bearing sections (system-health, inventory) which
  // must survive filtering; but a hypothetical zero-item/no-emptyTitle
  // section (e.g. minimal for a non-minimal variant) must not appear.
  const snapshot = emptySnapshot({ variant: "admin", roleName: "ADMIN" });
  const sections = buildActionCenterSections(snapshot);
  const ids = sections.map((s) => s.id);
  assert.ok(!ids.includes("minimal"), "minimal section should only appear for the minimal variant");
  for (const section of sections) {
    assert.ok(section.items.length > 0 || Boolean(section.emptyTitle), `section ${section.id} has no items and no emptyTitle`);
  }
});

// ---------------------------------------------------------------------------
// filterActionCenterSections: search behavior
// ---------------------------------------------------------------------------

test("filterActionCenterSections: blank query returns all sections unchanged", () => {
  const snapshot = emptySnapshot({ variant: "admin", roleName: "ADMIN" });
  const sections = buildActionCenterSections(snapshot);
  assert.deepEqual(filterActionCenterSections(sections, ""), sections);
  assert.deepEqual(filterActionCenterSections(sections, "   "), sections);
});

test("filterActionCenterSections: a section whose title matches keeps all its items", () => {
  const snapshot = emptySnapshot({ variant: "admin", roleName: "ADMIN" });
  const sections = buildActionCenterSections(snapshot);
  const filtered = filterActionCenterSections(sections, "admin & security");
  const match = filtered.find((s) => s.id === "admin-security");
  assert.ok(match);
  assert.equal(match!.items.length, 2);
});

test("filterActionCenterSections: item-level match keeps only matching items, and non-matching sections are dropped entirely", () => {
  const snapshot = emptySnapshot({ variant: "admin", roleName: "ADMIN" });
  const sections = buildActionCenterSections(snapshot);
  const filtered = filterActionCenterSections(sections, "compliance");
  // "Compliance" only appears as an item inside the reports section.
  assert.ok(filtered.every((s) => s.items.every((i) => i.title.toLowerCase().includes("compliance") || i.description.toLowerCase().includes("compliance") || s.title.toLowerCase().includes("compliance"))));
  assert.ok(filtered.length >= 1);
  assert.ok(filtered.some((s) => s.items.some((i) => i.id === "compliance")));
});

test("filterActionCenterSections: query matching nothing returns an empty array", () => {
  const snapshot = emptySnapshot({ variant: "admin", roleName: "ADMIN" });
  const sections = buildActionCenterSections(snapshot);
  assert.deepEqual(filterActionCenterSections(sections, "zzz-not-a-real-match-zzz"), []);
});
