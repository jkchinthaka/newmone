import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { compactRegisterFilters, parseRegisterPage, registerRecordHref } from "../fleet-register";
import { listLoadPhase, LOADING_INDICATOR_DELAY_MS } from "../loading-standard";
import { getMobileBottomNavItems, getVisibleNavigationItems, NAVIGATION_ITEMS } from "../navigation";
import { NAV_ITEM_API_GATES } from "../nav-api-gates";
import { notificationContextHref, retiredGateTarget } from "../notification-inbox";
import { APP_QUERY_DEFAULT_OPTIONS, QUERY_RETRY_LIMIT } from "../query-client-defaults";
import { getPostLoginRedirect } from "../role-redirect";
import { ROLE_HOME_PROFILES } from "../role-home";
import { rowMenuPlacement } from "../row-menu-placement";

const root = path.resolve(__dirname, "..", "..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const SECURITY_OFFICER = ["dashboard.view", "vehicles.view", "gate.out.create", "gate.in.create", "maintenance_requests.create"];

test("gate screen is gone from navigation, favourites, landing, and links", () => {
  assert.equal(NAVIGATION_ITEMS.some((item) => item.href.startsWith("/fleet/gate")), false);
  assert.equal("fleet-gate" in NAV_ITEM_API_GATES, false);
  assert.equal(getPostLoginRedirect("SECURITY_OFFICER"), "/requests");
  const tabs = getMobileBottomNavItems("SECURITY_OFFICER", { permissions: SECURITY_OFFICER });
  assert.equal(tabs[0]?.label, "Requests");
  for (const role of ["ADMIN", "FLEET_MANAGER", "MANAGER", "SECURITY_OFFICER"]) {
    assert.equal(getVisibleNavigationItems(role).some((item) => item.href.includes("/fleet/gate")), false, role);
  }
  for (const profile of ROLE_HOME_PROFILES) {
    for (const card of profile.cards) assert.doesNotMatch(card.href, /\/fleet\/gate/, card.id);
  }
  for (const file of ["lib/action-center.ts", "lib/notification-inbox.ts", "lib/role-home.ts", "components/fleet/fleet-workspace.tsx"]) {
    assert.doesNotMatch(read(file), /href: "\/fleet\/gate"|`\/fleet\/gate\?/, file);
  }
  assert.equal(existsSync(path.join(root, "components/fleet/fleet-gate-panel.tsx")), false);
  assert.equal(existsSync(path.join(root, "lib/gate-operations.ts")), false);
  assert.match(read("app/(dashboard)/fleet/gate/page.tsx"), /redirect\(/);
});

test("old gate links open the vehicle or the fleet list", () => {
  assert.equal(retiredGateTarget("/fleet/gate?vehicle=abc-1"), "/vehicles/abc-1");
  assert.equal(retiredGateTarget("/fleet/gate"), "/fleet");
  assert.equal(retiredGateTarget("/fleet/gate?vehicle=../x"), "/fleet");
  assert.equal(retiredGateTarget("/fleet"), null);
  assert.equal(notificationContextHref({ deepLink: "/fleet/gate?vehicle=v9" }), "/vehicles/v9");
});

test("register pages read meta.total and fall back to the row count", () => {
  const paged = parseRegisterPage<{ id: string }>({ data: [{ id: "a" }], meta: { page: 2, pageSize: 25, total: 51, totalPages: 3 } }, 2, 25);
  assert.deepEqual(paged, { rows: [{ id: "a" }], page: 2, pageSize: 25, total: 51, totalPages: 3 });
  const legacy = parseRegisterPage<{ id: string }>({ data: [{ id: "a" }, { id: "b" }] }, 1, 25);
  assert.equal(legacy.total, 2);
  assert.equal(legacy.totalPages, 1);
  assert.deepEqual(parseRegisterPage(null, 1, 25).rows, []);
  assert.deepEqual(compactRegisterFilters({ status: " ", vehicleId: "v1", x: null }), { vehicleId: "v1" });
  assert.equal(registerRecordHref("/accidents", "a b"), "/accidents?id=a%20b");
});

test("failed loads are errors, refreshes keep rows", () => {
  assert.equal(listLoadPhase({ loading: true, hasData: false, error: false }), "initial");
  assert.equal(listLoadPhase({ loading: true, hasData: true, error: false }), "refreshing");
  assert.equal(listLoadPhase({ loading: false, hasData: false, error: true }), "error");
  assert.equal(listLoadPhase({ loading: false, hasData: true, error: false }), "ready");
  assert.equal(LOADING_INDICATOR_DELAY_MS, 250);
  for (const file of ["app/(dashboard)/accidents/page.tsx", "app/(dashboard)/insurance-claims/page.tsx", "app/(dashboard)/traffic-fines/page.tsx", "app/(dashboard)/compliance/page.tsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /"Loading\.\.\."|Loading…<\/p>/, file);
    assert.match(source, /ErrorState|RegisterList/, file);
  }
  const vehicles = read("app/(dashboard)/vehicles/page.tsx");
  assert.match(vehicles, /alertsError \?/);
  assert.match(vehicles, /summaryError && !summary/);
});

test("row menus open upward near the bottom and stay on screen", () => {
  const down = rowMenuPlacement({ anchor: { top: 100, bottom: 144, left: 300, right: 344 }, menuWidth: 176, menuHeight: 140, viewportWidth: 400, viewportHeight: 800 });
  assert.equal(down.upward, false);
  assert.equal(down.top, 148);
  const up = rowMenuPlacement({ anchor: { top: 680, bottom: 724, left: 300, right: 344 }, menuWidth: 176, menuHeight: 140, viewportWidth: 400, viewportHeight: 800 });
  assert.equal(up.upward, true);
  assert.equal(up.top, 536);
  const narrow = rowMenuPlacement({ anchor: { top: 100, bottom: 144, left: 10, right: 54 }, menuWidth: 176, menuHeight: 140, viewportWidth: 320, viewportHeight: 800 });
  assert.equal(narrow.left, 8);
});

test("query defaults suit slow networks: one retry, no focus refetch, no background polling", () => {
  const queries = APP_QUERY_DEFAULT_OPTIONS.queries;
  assert.equal(queries.staleTime, 30_000);
  assert.equal(queries.refetchOnWindowFocus, false);
  assert.equal(queries.refetchIntervalInBackground, false);
  assert.equal(QUERY_RETRY_LIMIT, 1);
  const network = { code: "ERR_NETWORK" };
  assert.equal(queries.retry(0, network), true);
  assert.equal(queries.retry(1, network), false);
  assert.equal(queries.retry(0, { response: { status: 400 } }), false);
  assert.equal(APP_QUERY_DEFAULT_OPTIONS.mutations.retry, false);
  assert.doesNotMatch(read("components/utilities/hooks.ts"), /refetchInterval/);
  assert.match(read("components/utilities/api.ts"), /days: UTILITY_READINGS_WINDOW_DAYS/);
});

test("touch targets, Colombo dates, and LKR currency in owned screens", () => {
  const pager = read("components/operational/jobs-pagination.tsx");
  assert.equal((pager.match(/min-h-11/g) ?? []).length, 3);
  assert.doesNotMatch(pager, /py-1\.5|py-1"/);
  for (const file of ["app/(dashboard)/farm/attendance/page.tsx", "app/(dashboard)/farm/traceability/page.tsx", "app/(dashboard)/cleaning/visits/page.tsx", "app/(dashboard)/vehicles/[id]/page.tsx", "components/fleet/fleet-workspace.tsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/, file);
    assert.doesNotMatch(source, /toLocaleDateString\(\)|toLocaleString\(\)/, file);
  }
  assert.doesNotMatch(read("app/(dashboard)/vehicles/[id]/page.tsx"), /INR/);
  assert.doesNotMatch(read("components/utilities/helpers.ts"), /USD/);
  assert.match(read("components/operational/operational-list-states.tsx"), /motion-reduce:animate-none/);
});
