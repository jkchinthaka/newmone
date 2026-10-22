import assert from "node:assert/strict";
import test from "node:test";
import { canAccessNavigationPath, getVisibleNavigationItems, resolveAuthorizedDestination } from "../navigation";
import { STUDIO_ADMIN_PAGE_ROUTES, STUDIO_NAV_ROUTES } from "../studio-navigation";
import inventory from "../../../api/src/database/access-route-inventory.json";

test("Studio page mappings name actual production routes", () => {
  const routes = new Set(inventory.routes.map((r) => `${r.method} ${r.path}`));
  for (const route of [...Object.values(STUDIO_NAV_ROUTES), ...Object.values(STUDIO_ADMIN_PAGE_ROUTES)]) assert.ok(routes.has(route), route);
});
test("ON gates use the server effective-route decision across department roles", () => {
  const studio = { accessStudioEnabled: true, accessRoutes: ["GET /assets"] };
  assert.ok(getVisibleNavigationItems("CLEANER", studio).some((i) => i.id === "assets"));
  assert.equal(canAccessNavigationPath("/assets", "CLEANER", [], studio), true);
  assert.equal(canAccessNavigationPath("/assets", "ADMIN", [], { ...studio, accessRoutes: [] }), false);
  assert.equal(getVisibleNavigationItems("ADMIN", { ...studio, accessRoutes: [] }).some((i) => i.id === "assets"), false);
  assert.equal(canAccessNavigationPath("/system-health", "CLEANER", [], studio), false);
});
test("OFF ignores effective-route data and preserves role navigation; SUPER_ADMIN stays unchanged", () => {
  assert.equal(canAccessNavigationPath("/assets", "CLEANER", [], { accessStudioEnabled: false, accessRoutes: ["GET /assets"] }), false);
  assert.equal(canAccessNavigationPath("/assets", "ADMIN", [], { accessStudioEnabled: false, accessRoutes: [] }), true);
  assert.equal(canAccessNavigationPath("/assets", "SUPER_ADMIN", [], { accessStudioEnabled: true, accessRoutes: [] }), true);
});
test("ON landing uses an allowed page when the role's preferred destination is denied", () => {
  const user = { role: "TECHNICIAN", accessStudioEnabled: true, accessRoutes: ["GET /assets"] };
  assert.equal(resolveAuthorizedDestination(user, null), "/assets");
  assert.equal(resolveAuthorizedDestination(user, "/admin"), "/assets");
});
test("an Admin overview grant does not unlock unrelated Admin pages", () => {
  const studio = { accessStudioEnabled: true, accessRoutes: ["GET /admin-governance/overview"] };
  assert.equal(canAccessNavigationPath("/admin", "ADMIN", [], studio), true);
  assert.equal(canAccessNavigationPath("/admin/users", "ADMIN", [], studio), false);
  assert.equal(canAccessNavigationPath("/admin/users", "ADMIN", [], { ...studio, accessRoutes: ["GET /admin/users"] }), true);
});
