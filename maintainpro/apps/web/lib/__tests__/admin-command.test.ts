import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_QUICK_ACTIONS, adminCommandGroups, searchAdminModules } from "../admin-console";

test("daily admin groups stay open and technical tools stay with superadmins", () => {
  const groups = adminCommandGroups("ADMIN");
  const daily = groups.filter((group) => !group.advanced).map((group) => group.title);
  assert.deepEqual(daily, ["People & Access", "Organization", "Maintenance Setup", "Assets & Fleet"]);
  const shown = new Set(groups.flatMap((group) => group.sections.map((section) => section.id)));
  assert.equal(shown.has("integrations"), false);
  assert.equal(shown.has("technical"), false);
  const technical = new Set(
    adminCommandGroups("SUPER_ADMIN").flatMap((group) => group.sections.map((section) => section.id))
  );
  assert.equal(technical.has("technical"), true);
  assert.equal(technical.has("integrations"), true);
});

test("search finds modules without loading entity lists, and quick actions are exact", () => {
  const audit = searchAdminModules("audit", "ADMIN");
  assert.equal(audit.some((section) => section.href === "/admin/audit"), true);
  assert.equal(searchAdminModules("a", "ADMIN").length, 0);
  assert.equal(searchAdminModules("system health", "ADMIN").length, 0);
  assert.equal(searchAdminModules("system health", "VIEWER").length, 0);
  assert.deepEqual(
    ADMIN_QUICK_ACTIONS.map((action) => action.href),
    ["/admin/invitations?create=1", "/master-data/departments", "/procurement/vendors", "/admin/roles", "/admin/organization"]
  );
});
