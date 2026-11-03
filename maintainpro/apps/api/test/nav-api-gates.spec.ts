import "reflect-metadata";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";

import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";

type Gate = { route: string; roles: readonly string[]; permissions: readonly string[] };
// Loaded at runtime so the API tsc rootDir stays apps/api.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const web = require(path.resolve(__dirname, "../../web/lib/nav-api-gates.ts")) as {
  NAV_ITEM_API_GATES: Record<string, Gate>;
  ADMIN_PAGE_API_GATES: Record<string, Gate>;
};

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(controller|module)\.ts$/.test(name)) out.push(full);
  }
  return out;
}

function joinPath(base: string, sub: string): string {
  const joined = `/${base}/${sub}`.replace(/\/+/g, "/");
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}

function routeTable(): Map<string, { roles: string[]; permissions: string[] }> {
  const table = new Map<string, { roles: string[]; permissions: string[] }>();
  for (const file of files(path.resolve(__dirname, "../src/modules"))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;
    for (const value of Object.values(mod)) {
      if (typeof value !== "function") continue;
      const basePath = Reflect.getMetadata(PATH_METADATA, value) as string | string[] | undefined;
      if (basePath === undefined) continue;
      const bases = Array.isArray(basePath) ? basePath : [basePath];
      const proto = (value as { prototype: Record<string, unknown> }).prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (typeof handler !== "function" || name === "constructor") continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (method === undefined) continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
        const subs = Array.isArray(sub) ? sub : [sub ?? ""];
        const roles = (Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, value) ?? []) as string[];
        const permissions = (Reflect.getMetadata(PERMISSIONS_KEY, handler) ??
          Reflect.getMetadata(PERMISSIONS_KEY, value) ??
          []) as string[];
        for (const base of bases) {
          for (const s of subs) {
            table.set(`${RequestMethod[method]} ${joinPath(base, s)}`, { roles: [...roles].sort(), permissions });
          }
        }
      }
    }
  }
  return table;
}

describe("web nav API gates match the API decorators", () => {
  it("has the same @Roles and @Permissions as the route that opens each page", () => {
    const table = routeTable();
    const drift: string[] = [];
    for (const [name, gate] of Object.entries({ ...web.NAV_ITEM_API_GATES, ...web.ADMIN_PAGE_API_GATES })) {
      const actual = table.get(gate.route);
      if (!actual) {
        drift.push(`${name}: ${gate.route} not found`);
        continue;
      }
      if (JSON.stringify(actual.roles) !== JSON.stringify([...gate.roles].sort())) {
        drift.push(`${name}: roles ${actual.roles.join(",")} != ${gate.roles.join(",")}`);
      }
      if (JSON.stringify([...actual.permissions].sort()) !== JSON.stringify([...gate.permissions].sort())) {
        drift.push(`${name}: permissions ${actual.permissions.join(",")} != ${gate.permissions.join(",")}`);
      }
    }
    expect(drift).toEqual([]);
  });
});
