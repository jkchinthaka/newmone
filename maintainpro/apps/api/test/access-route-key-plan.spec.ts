import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { hasCompatiblePermission } from "../src/common/guards/permissions.guard";
import { RoleName } from "../src/database/prisma-enums";
import { rolePermissions } from "../src/database/seed";

type RouteRow = {
  method: string;
  path: string;
  controller: string;
  handler: string;
  roles: string[];
  permissions: string[];
  isPublic: boolean;
};

function keyFor(controller: string, handler: string): string {
  const slug = (value: string) => value.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  return `access.${slug(controller)}.${slug(handler)}`;
}

function rolePasses(role: string, permissions: string[]): boolean {
  if (permissions.length === 0) return false;
  const keys = new Set(rolePermissions[role as RoleName] ?? []);
  return permissions.every((permission) => hasCompatiblePermission(keys, permission, role));
}

describe("access route key plan", () => {
  it("plans keys so seed roles match the role list", () => {
    const inventory = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../../docs/handover/access/route-inventory.json"), "utf8")
    ) as { routes: RouteRow[] };
    const roles = Object.values(RoleName).filter((role) => role !== RoleName.SUPER_ADMIN);
    const additions = new Map<string, { controller: string; handler: string; key: string; roles: string[]; reason: string }>();
    let keep = 0;
    for (const route of inventory.routes) {
      if (route.isPublic || route.roles.length === 0) continue;
      const id = `${route.controller}.${route.handler}`;
      const outside = roles.filter((role) => rolePasses(role, route.permissions) && !route.roles.includes(role));
      if (route.permissions.length > 0 && outside.length === 0) {
        keep += 1;
        continue;
      }
      additions.set(id, {
        controller: route.controller,
        handler: route.handler,
        key: keyFor(route.controller, route.handler),
        roles: route.roles.filter((role) => role !== "SUPER_ADMIN"),
        reason: route.permissions.length === 0 ? "roles-only" : `extra:${outside.join(",")}`
      });
    }
    const out = path.resolve(__dirname, "../../../docs/handover/access/route-key-plan.json");
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(
      out,
      `${JSON.stringify({ keep, additionCount: additions.size, additions: [...additions.values()] }, null, 2)}\n`
    );
    expect(additions.size).toBeGreaterThan(0);
  });
});
