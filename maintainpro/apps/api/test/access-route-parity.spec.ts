import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ACCESS_STUDIO_ROUTE_GRANTS } from "../src/common/auth/access-route-keys";
import { oldAccessDecision, type AccessRoute } from "../src/common/auth/access-studio-parity";
import { RoleName } from "../src/database/prisma-enums";
import { rolePermissions } from "../src/database/seed";
import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { PermissionsGuard, hasCompatiblePermission } from "../src/common/guards/permissions.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { PrismaService } from "../src/database/prisma.service";

describe("access route parity", () => {
  it("matches develop guards with the flag off, and flag on once grants exist", async () => {
    const inventory = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../../docs/handover/access/route-inventory.json"), "utf8")
    ) as { routes: AccessRoute[] };
    const develop: Record<string, string[]> = {};
    const granted: Record<string, string[]> = {};
    for (const role of Object.values(RoleName)) {
      develop[role] = [...(rolePermissions[role] ?? [])].filter((key) => !Object.prototype.hasOwnProperty.call(ACCESS_STUDIO_ROUTE_GRANTS, key));
      granted[role] = [...develop[role]];
    }
    for (const [key, roles] of Object.entries(ACCESS_STUDIO_ROUTE_GRANTS)) {
      for (const role of roles) {
        if (granted[role] && !granted[role].includes(key)) granted[role].push(key);
      }
      if (granted[RoleName.SUPER_ADMIN] && !granted[RoleName.SUPER_ADMIN].includes(key)) {
        granted[RoleName.SUPER_ADMIN].push(key);
      }
    }

    let route: AccessRoute = inventory.routes[0]!;
    let role: string = RoleName.ADMIN;
    let mode: "off" | "on" = "off";
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
            permissionLinks: ((mode === "on" ? granted : develop)[role] ?? []).map((key) => ({ permission: { key } }))
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
        getRequest: () => ({
          user: { sub: "user-1", role },
          headers: {},
          method: route.method,
          baseUrl: "",
          route: { path: route.path }
        })
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
    const developMismatches: string[] = [];
    const flagMismatches: string[] = [];
    try {
      for (const candidate of inventory.routes) {
        route = candidate;
        for (const candidateRole of Object.values(RoleName)) {
          role = candidateRole;
          const held = new Set(develop[candidateRole] ?? []);
          const expected = oldAccessDecision(candidate, candidateRole, held, (keys, permission, roleName) =>
            hasCompatiblePermission(keys, permission, roleName)
          );
          mode = "off";
          process.env.ACCESS_STUDIO_ENABLED = "false";
          const before = await allowed();
          if (before !== expected) developMismatches.push(`${candidate.method} ${candidate.path} ${candidateRole}`);
          mode = "on";
          process.env.ACCESS_STUDIO_ENABLED = "true";
          const after = await allowed();
          if (before !== after) flagMismatches.push(`${candidate.method} ${candidate.path} ${candidateRole}`);
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
        developMismatches: developMismatches.length,
        flagMismatches: flagMismatches.length,
        sample: [...developMismatches, ...flagMismatches].slice(0, 40)
      }, null, 2)}\n`
    );
    expect(developMismatches).toEqual([]);
    expect(flagMismatches).toEqual([]);
  }, 180000);
});
