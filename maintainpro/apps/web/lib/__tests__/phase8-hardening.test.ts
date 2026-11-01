import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { pageTemplate } from "../client-error-report";
import { resolveRoleHome } from "../role-home";
import { welcomeGuideFor, welcomeGuideForRole } from "../welcome-tips";

const src = (...parts: string[]) =>
  readFileSync(path.resolve(__dirname, "../..", ...parts), "utf8").replace(/\r\n/g, "\n");

test("crash reports carry the page path without record ids", () => {
  assert.equal(pageTemplate("/work-orders/clx1234567890abcdefghij"), "/work-orders/:id");
  assert.equal(pageTemplate("/vehicles/3f2b8c1e-aaaa-bbbb-cccc-1234567890ab/history"), "/vehicles/:id/history");
  assert.equal(pageTemplate("/requests/new"), "/requests/new");
  assert.equal(pageTemplate("/x".repeat(200)).length, 200);
});

test("crash reporting sends only after sign-in, never throws, and is capped", () => {
  const file = src("lib", "client-error-report.ts");
  assert.match(file, /if \(!currentStoredUserId\(\)\) return;/);
  assert.match(file, /MAX_SERVER_REPORTS_PER_PAGE_LOAD = 3/);
  assert.match(file, /catch \{\n\s+\/\/ Reporting must never make a crash worse\./);
  assert.doesNotMatch(file, /error\.message|error\.stack/);
});

test("every role gets a short welcome guide of three tips", () => {
  for (const role of ["TECHNICIAN", "SUPERVISOR", "MANAGER", "ADMIN", "VIEWER", "PROCUREMENT_OFFICER", "FLEET_MANAGER", "REQUESTER", "SOMETHING_NEW"]) {
    const guide = welcomeGuideFor(resolveRoleHome(role).roleKey);
    assert.ok(guide.title.length > 0, role);
    assert.equal(guide.tips.length, 3, role);
  }
  assert.match(welcomeGuideFor("TECHNICIAN").tips.join(" "), /Finish job/);
});

test("store staff get a store guide and other roles keep theirs", () => {
  const store = welcomeGuideForRole("INVENTORY_KEEPER", resolveRoleHome("INVENTORY_KEEPER").roleKey);
  assert.match(store.tips.join(" "), /Goods in/);
  assert.equal(welcomeGuideForRole("TECHNICIAN", "TECHNICIAN"), welcomeGuideFor("TECHNICIAN"));
  assert.equal(store.tips.length, 3);
  const gate = welcomeGuideForRole("SECURITY_OFFICER", resolveRoleHome("SECURITY_OFFICER").roleKey);
  assert.match(gate.tips.join(" "), /Send now/);
  assert.doesNotMatch(gate.tips.join(" "), /Compliance/);
});

test("the welcome guide is shown once per person and mounted in the dashboard", () => {
  const component = src("components", "onboarding", "welcome-tips.tsx");
  assert.match(component, /dismissKey\(userId\)/);
  assert.doesNotMatch(component, /userScopedStorageKey/);
  assert.match(component, /Got it/);
  assert.match(src("app", "(dashboard)", "layout.tsx"), /<WelcomeTips \/>\n\s+<NavigationRouteGuard>/);
});
