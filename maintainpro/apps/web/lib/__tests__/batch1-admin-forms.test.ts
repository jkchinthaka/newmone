import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { rolesPermissionsExportSheets } from "../admin-roles";
import { personLoginIssues, type PersonLoginForm } from "../person-login";

const base: PersonLoginForm = {
  canLogin: false,
  active: true,
  email: "",
  roleId: "",
  branchName: "HQ",
  inviteMethod: "SET_PASSWORD",
  initialPassword: "",
  confirmPassword: ""
};

test("email and password are not needed when the person will not log in", () => {
  assert.deepEqual(personLoginIssues(base), []);
});

test("ticking Can log in makes email, role and the first password required", () => {
  const issues = personLoginIssues({ ...base, canLogin: true });
  assert.ok(issues.includes("Enter a login email."));
  assert.ok(issues.includes("Choose a role."));
  assert.ok(issues.includes("Enter a password."));
});

test("set-a-password-now needs a strong password typed twice", () => {
  const ready = { ...base, canLogin: true, email: "kamal@nelna.lk", roleId: "r1" };
  assert.ok(personLoginIssues({ ...ready, initialPassword: "password", confirmPassword: "password" }).some((issue) => /uppercase/.test(issue)));
  assert.ok(personLoginIssues({ ...ready, initialPassword: "Start-1234!", confirmPassword: "Start-1234?" }).includes("The two passwords do not match."));
  assert.deepEqual(personLoginIssues({ ...ready, initialPassword: "Start-1234!", confirmPassword: "Start-1234!" }), []);
});

test("invite and temporary-password options do not ask for a password", () => {
  const ready = { ...base, canLogin: true, email: "kamal@nelna.lk", roleId: "r1" };
  assert.deepEqual(personLoginIssues({ ...ready, inviteMethod: "TEMP_PASSWORD" }), []);
  assert.deepEqual(personLoginIssues({ ...ready, inviteMethod: "INVITE_EMAIL" }), []);
});

test("roles download: permission x role grid and one line per role", () => {
  const sheets = rolesPermissionsExportSheets({
    permissions: [
      { id: "p2", key: "work_orders.view", module: "work_orders", description: "View jobs" },
      { id: "p1", key: "assets.manage", module: "assets", description: null }
    ],
    roles: [
      { id: "r1", name: "TECHNICIAN", tenantId: null, tenantName: null, permissionKeys: ["work_orders.view"], permissionCount: 1, isBuiltIn: true },
      { id: "r2", name: "STORE_KEEPER", tenantId: "t1", tenantName: "Nelna", permissionKeys: [], permissionCount: 0, isBuiltIn: false }
    ]
  });
  assert.deepEqual(sheets.grid[0].slice(3), ["TECHNICIAN", "STORE KEEPER (Nelna)"]);
  assert.equal(sheets.grid[1][1], "assets.manage");
  assert.deepEqual(sheets.grid[2].slice(1), ["work_orders.view", "View jobs", "Yes", ""]);
  assert.deepEqual(sheets.roles[2], ["STORE KEEPER", "Nelna", "No", 0, ""]);
});

test("requests list has a Type filter that sends jobDomain (Machinery / Vehicle / Service)", () => {
  const source = readFileSync("app/(dashboard)/requests/page.tsx", "utf8");
  assert.match(source, /aria-label="Type"/);
  assert.match(source, /jobDomain: jobDomain \|\| undefined/);
  assert.match(source, /\["MACHINERY", "VEHICLE", "SERVICE"\]/);
  assert.match(source, /SERVICE: "Service \(building\)"/);
});

test("Add Location is always clickable and asks for the site when none is selected", () => {
  const source = readFileSync("app/(dashboard)/admin/organization/page.tsx", "utf8");
  assert.doesNotMatch(source, /disabled=\{!selectedSiteId\}/);
  assert.match(source, /Add a site first/);
  assert.match(source, /siteId,\n/);
});
