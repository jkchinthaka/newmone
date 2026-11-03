import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getCommandPaletteItems } from "../command-palette";
import {
  formatEnumLabel,
  gateMovementLabel,
  partRequestStatusLabel,
  vehicleStatusLabel,
  workOrderStatusLabel
} from "../display-labels";
import { lowerThanLastWarning, readingTimeNow } from "../meter-readings-display";
import {
  canAccessNavigationPath,
  getDefaultFavoriteNavIds,
  getMobileBottomNavItems,
  getVisibleNavigationItems,
  NAVIGATION_ITEMS
} from "../navigation";
import { activeQueueFilterChips } from "../work-order-queue-nav";
import { DEFAULT_QUEUE_FILTERS } from "../work-order-queues-api";

const TECHNICIAN = ["dashboard.view", "work_orders.view_own", "work_orders.update_status", "maintenance_requests.create", "maintenance_requests.view_own", "planning.view"];
const SECURITY_OFFICER = ["dashboard.view", "vehicles.view", "gate.out.create", "gate.in.create", "maintenance_requests.create"];
const INVENTORY_KEEPER = ["dashboard.view", "inventory.manage", "inventory.stock_issue", "part_requests.view", "part_requests.issue", "maintenance_requests.create"];
const read = (relative: string) => readFileSync(path.resolve(__dirname, "..", "..", relative), "utf8");

test("mobile bottom nav starts with the role's login home", () => {
  assert.equal(getMobileBottomNavItems("TECHNICIAN", { permissions: TECHNICIAN })[0]?.label, "My Jobs");
  assert.equal(getMobileBottomNavItems("INVENTORY_KEEPER", { permissions: INVENTORY_KEEPER })[0]?.label, "Parts");
  // The gate screen is retired: security officers land on Requests to report problems.
  const security = getMobileBottomNavItems("SECURITY_OFFICER", { permissions: SECURITY_OFFICER });
  assert.equal(security[0]?.href, "/requests");
  assert.equal(security[0]?.label, "Requests");
  assert.equal(security.some((item) => item.href.startsWith("/fleet")), false);
  // Managers land on the dashboard; Work Orders stays as the second tab.
  const manager = getMobileBottomNavItems("MANAGER");
  assert.deepEqual(manager.slice(0, 2).map((item) => item.label), ["Dashboard", "Jobs"]);
  assert.equal(manager[0]?.activeMatch, "exact");
});

test("security officer favourites are Requests and Report issue; the gate screen is gone", () => {
  const favourites = getDefaultFavoriteNavIds("SECURITY_OFFICER");
  const visible = getVisibleNavigationItems("SECURITY_OFFICER", { permissions: SECURITY_OFFICER });
  assert.deepEqual(favourites, ["requests", "report-issue"]);
  assert.ok(favourites.every((id) => visible.some((item) => item.id === id)));
  assert.equal(NAVIGATION_ITEMS.some((item) => item.id === "fleet-gate" || item.href.startsWith("/fleet/gate")), false);
  assert.equal(visible.some((item) => item.href.startsWith("/fleet")), false);
});

test("technicians get My jobs and Report issue, without the duplicate job lanes", () => {
  const ids = getVisibleNavigationItems("TECHNICIAN", { permissions: TECHNICIAN }).map((item) => item.id);
  assert.ok(ids.includes("my-jobs"));
  assert.ok(ids.includes("report-issue"));
  assert.ok(ids.includes("requests"));
  for (const lane of ["machinery-jobs", "service-jobs", "vehicle-jobs"]) assert.equal(ids.includes(lane), false, lane);
  assert.equal(getDefaultFavoriteNavIds("TECHNICIAN")[0], "my-jobs");
});

test("own-only requesters get one entry and can open My requests and Report issue", () => {
  for (const [role, keys] of [["SECURITY_OFFICER", SECURITY_OFFICER], ["INVENTORY_KEEPER", INVENTORY_KEEPER], ["TECHNICIAN", TECHNICIAN]] as const) {
    const items = getVisibleNavigationItems(role, { permissions: [...keys] });
    const entries = items.filter((item) => item.id === "requests" || item.id === "my-requests");
    assert.equal(entries.length, 1, role);
    assert.equal(entries[0]?.label, "My Requests", role);
    assert.equal(canAccessNavigationPath("/requests/mine", role, [...keys]), true, role);
    assert.equal(canAccessNavigationPath("/requests/new", role, [...keys]), true, role);
  }
});

test("menu and search descriptions are plain help, not developer notes", () => {
  const banned = /phase \d|overlaps with|not a primary|kept for administration|secondary inbox|bileeta|executable|universal|triggered/i;
  for (const item of NAVIGATION_ITEMS) {
    assert.ok(item.description, `${item.id} needs a description`);
    assert.doesNotMatch(item.description ?? "", banned, item.id);
    assert.ok((item.description ?? "").length <= 70, `${item.id} description is too long`);
  }
  for (const command of getCommandPaletteItems("ADMIN")) {
    assert.doesNotMatch(command.description, banned, command.id);
  }
});

test("status codes have one plain name", () => {
  assert.equal(workOrderStatusLabel("TECHNICIAN_COMPLETED"), "Done, waiting for check");
  assert.equal(workOrderStatusLabel("REWORK_REQUIRED"), "Needs to be fixed again");
  assert.equal(workOrderStatusLabel("WAITING_PARTS"), "Waiting for parts");
  assert.equal(workOrderStatusLabel("VERIFIED"), "Verified");
  assert.equal(workOrderStatusLabel("CLOSED"), "Closed");
  assert.equal(formatEnumLabel("TECHNICIAN_COMPLETED"), "Done, waiting for check");
  assert.equal(vehicleStatusLabel("UNDER_MAINTENANCE"), "In workshop");
  assert.equal(partRequestStatusLabel("APPROVED"), "Ready to issue");
  assert.equal(gateMovementLabel("OVERRIDE_APPROVED"), "Released by manager");
  const chips = activeQueueFilterChips({ ...DEFAULT_QUEUE_FILTERS, status: "TECHNICIAN_COMPLETED", jobDomain: "MACHINERY" });
  assert.deepEqual(chips.map((chip) => chip.label), ["Done, waiting for check", "Machinery"]);
  for (const chip of chips) assert.doesNotMatch(chip.label, /[A-Z]{2,}_[A-Z]/);
});

test("meter reading warns before submit when the value is lower than the last reading", () => {
  const last = { readingValue: 1200, readingDate: "2026-10-20T08:00:00.000Z" };
  assert.equal(lowerThanLastWarning("1100", 0, last, "kWh"), "Lower than last reading (1,200 kWh). Was the meter replaced or reset?");
  assert.equal(lowerThanLastWarning("1300", 0, last, "kWh"), null);
  assert.equal(lowerThanLastWarning("", 0, last, "kWh"), null);
  assert.equal(lowerThanLastWarning("10", 0, undefined, "kWh"), null);
  assert.ok(!Number.isNaN(new Date(readingTimeNow()).getTime()));
  const page = read("app/(dashboard)/utilities/readings/page.tsx");
  // Reading time resets on meter pick, Scan next, and after save.
  assert.ok((page.match(/setReadingAt\(readingTimeNow\(\)\)/g) ?? []).length >= 3);
});

test("inventory home uses plain card titles and lists parts to issue", () => {
  const source = read("components/inventory/inventory-control-page.tsx");
  assert.doesNotMatch(source, /"ERP snapshot"|"Advisory"|"Snapshot zero"/);
  assert.match(source, /\["On hand", summary\?\.onHand/);
  assert.match(source, /\["Available", summary\?\.available/);
  assert.match(source, /\["Out of stock", summary\?\.outOfStock/);
  assert.match(source, /\/inventory\/parts-to-issue/);
  assert.match(source, /workOrderRecordHref\(row\.workOrder\.id, "parts"\)/);
});

test("My requests page is not a dead end", () => {
  const source = read("app/(dashboard)/requests/mine/page.tsx");
  assert.match(source, /href=\{"\/requests\/new" as Route\}/);
  assert.match(source, /Report a problem/);
  assert.doesNotMatch(source, /read-only/);
});
