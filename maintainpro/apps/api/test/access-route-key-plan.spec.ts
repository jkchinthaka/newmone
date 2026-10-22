import { readFileSync } from "node:fs";
import path from "node:path";

import { ACCESS_KEY_CATALOG, ACCESS_ROUTE_KEYS } from "../src/common/auth/access-route-keys";
import { planAccessRouteKeys, type AccessPlanRoute } from "../src/common/auth/access-route-plan";

function loadRoutes(): AccessPlanRoute[] {
  const inventory = JSON.parse(
    readFileSync(path.resolve(__dirname, "../../../docs/handover/access/route-inventory.json"), "utf8")
  ) as { routes: AccessPlanRoute[] };
  return inventory.routes;
}

describe("access route key plan", () => {
  const routes = loadRoutes();
  const plan = planAccessRouteKeys(routes);

  it("covers every role-gated route with 110 to 210 consolidated keys", () => {
    const gated = routes.filter((route) => route.roles.length > 0);
    const covered = new Set(plan.routes.map((route) => `${route.method} ${route.path}`));
    const missing = gated.filter((route) => !covered.has(`${route.method} ${route.path}`));
    expect(missing).toEqual([]);
    expect(plan.keyCount).toBeGreaterThanOrEqual(110);
    expect(plan.keyCount).toBeLessThanOrEqual(210);
    for (const entry of plan.keys) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.module.length).toBeGreaterThan(0);
    }
  });

  it("keeps the same key when a handler is renamed", () => {
    const renamed = routes.map((route) => ({ ...route, handler: `renamed_${route.handler ?? "handler"}`, controller: "RenamedController" }));
    expect(planAccessRouteKeys(renamed)).toEqual(plan);
  });

  it("matches the committed route map", () => {
    const fromPlan: Record<string, string> = {};
    for (const route of plan.routes) fromPlan[`${route.method} ${route.path}`] = route.key;
    expect(ACCESS_ROUTE_KEYS).toEqual(fromPlan);
    expect(new Set(ACCESS_KEY_CATALOG.map((entry) => entry.key))).toEqual(new Set(plan.keys.map((entry) => entry.key)));
  });
});
