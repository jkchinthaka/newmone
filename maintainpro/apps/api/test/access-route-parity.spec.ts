import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ACCESS_STUDIO_ROUTE_GRANTS } from "../src/database/access-studio-route-keys";
import { RoleName } from "../src/database/prisma-enums";
import { rolePermissions } from "../src/database/seed";
import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { PermissionsGuard } from "../src/common/guards/permissions.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { PrismaService } from "../src/database/prisma.service";

type RouteRow = {
  method: string;
  path: string;
  roles: string[];
  permissions: string[];
  isPublic: boolean;
};

describe("access route parity", () => {
  it("matches the real guards with the flag off and on", async () => {
    const inventory = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../../docs/handover/access/route-inventory.json"), "utf8")
    ) as { routes: RouteRow[] };
    const effective: Record<string, string[]> = {};
    for (const role of Object.values(RoleName)) effective[role] = [...(rolePermissions[role] ?? [])];
    for (const [key, roles] of Object.entries(ACCESS_STUDIO_ROUTE_GRANTS)) {
      for (const role of roles) {
        if (effective[role] && !effective[role].includes(key)) effective[role].push(key);
      }
    }

    let route: RouteRow = inventory.routes[0];
    let role: string = RoleName.ADMIN;
    const reflector = {
      getAllAndOverride: (key: string) => {
        if (key === ROLES_KEY) return route.roles.length > 0 ? route.roles : undefined;
        if (key === PERMISSIONS_KEY) return route.permissions.length > 0 ? route.permissions : undefined;
        return undefined;
      }
    } as unknown as Reflector;
    const prisma = {
      user: {
        findUnique: async () => ({
          id: "user-1",
          tenantId: "tenant-1",
          isActive: true,
          lockedUntil: null,
          role: {
            name: role,
            permissionLinks: (effective[role] ?? []).map((key) => ({ permission: { key } }))
          }
        })
      },
      userPermissionOverride: { findMany: async () => [] },
      tenant: { findUnique: async () => ({ accessConfigVersion: 0 }) }
    } as unknown as PrismaService;
    const rolesGuard = new RolesGuard(reflector, prisma);
    const permissionsGuard = new PermissionsGuard(reflector, prisma);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: "user-1", role }, headers: {} })
      })
    } as unknown as ExecutionContext;

    async function allowed(): Promise<boolean> {
      if (route.isPublic) return true;
      try {
        if (!(await rolesGuard.canActivate(context))) return false;
      } catch {
        return false;
      }
      try {
        return await permissionsGuard.canActivate(context);
      } catch {
        return false;
      }
    }

    const previous = process.env.ACCESS_STUDIO_ENABLED;
    const mismatches: string[] = [];
    try {
      for (const candidate of inventory.routes) {
        route = candidate;
        for (const candidateRole of Object.values(RoleName)) {
          role = candidateRole;
          process.env.ACCESS_STUDIO_ENABLED = "false";
          const before = await allowed();
          process.env.ACCESS_STUDIO_ENABLED = "true";
          const after = await allowed();
          if (before !== after) {
            const accessKey = candidate.permissions.find((permission) => permission.startsWith("access."));
            mismatches.push(
              `${candidate.method} ${candidate.path} ${candidateRole} before=${before} after=${after} holds=${accessKey ? (effective[candidateRole] ?? []).includes(accessKey) : "none"}`
            );
          }
        }
      }
    } finally {
      if (previous === undefined) delete process.env.ACCESS_STUDIO_ENABLED;
      else process.env.ACCESS_STUDIO_ENABLED = previous;
    }

    writeFileSync(
      path.resolve(__dirname, "../../../docs/handover/access/parity-matrix.json"),
      `${JSON.stringify({
        routes: inventory.routes.length,
        roles: Object.values(RoleName).length,
        mismatches: mismatches.length,
        sample: mismatches.slice(0, 40)
      }, null, 2)}\n`
    );
    expect(mismatches).toEqual([]);
  }, 120000);
});
