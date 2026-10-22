import type { PrismaClient } from "@prisma/client";

import { ACCESS_STUDIO_SEED_VERSION, firstAccessMismatch, type AccessRoute } from "../common/auth/access-studio-parity";
import { hasCompatiblePermission } from "../common/guards/permissions.guard";
import inventory from "./access-route-inventory.json";
import { ACCESS_STUDIO_ROUTE_GRANTS } from "./access-studio-route-keys";

type RoleRow = {
  id: string;
  name: string;
  tenantId: string | null;
  permissionLinks: Array<{ permission: { key: string } }>;
};

type GrantClient = {
  permission: {
    findMany: () => Promise<Array<{ id: string; key: string }>>;
    create: (args: { data: { key: string; description: string } }) => Promise<{ id: string }>;
  };
  role: { findMany: () => Promise<RoleRow[]> };
  rolePermission: { create: (args: { data: { roleId: string; permissionId: string } }) => Promise<unknown> };
  appSetting: {
    upsert: (args: {
      where: { scope_scopeId_key: { scope: string; scopeId: string; key: string } };
      update: { value: string };
      create: { scope: string; scopeId: string; key: string; value: string };
    }) => Promise<unknown>;
  };
};

export function assertGrantDatabase(url: string, apply: boolean): string {
  const named = url.match(/(?:^|;)database=([^;]+)/i);
  const name = named?.[1] ? decodeURIComponent(named[1]) : "";
  if (/nelna/i.test(name)) throw new Error("Refusing: nelna is out of scope.");
  if (apply && /maintainprodev/i.test(name)) throw new Error("Refusing: MaintainProDev is read only.");
  if (!name) throw new Error("Refusing: DATABASE_URL has no database name.");
  return name;
}

function keysAfterGrants(role: RoleRow): string[] {
  const keys = new Set(role.permissionLinks.map((link) => link.permission.key));
  for (const [key, roleNames] of Object.entries(ACCESS_STUDIO_ROUTE_GRANTS)) {
    if (roleNames.includes(role.name)) keys.add(key);
  }
  if (role.name === "SUPER_ADMIN") {
    for (const key of Object.keys(ACCESS_STUDIO_ROUTE_GRANTS)) keys.add(key);
  }
  return [...keys];
}

export async function grantAccessStudioKeys(prisma: GrantClient, options: { dryRun: boolean }) {
  const lines: string[] = [];
  const routes = (inventory as { routes: AccessRoute[] }).routes;
  const roles = await prisma.role.findMany();
  const byTenant = new Map<string, Map<string, string[]>>();
  for (const role of roles) {
    const tenant = role.tenantId ?? "global";
    const bucket = byTenant.get(tenant) ?? new Map<string, string[]>();
    bucket.set(role.name, keysAfterGrants(role));
    byTenant.set(tenant, bucket);
  }
  let blocked = false;
  for (const [tenant, keysByRole] of byTenant) {
    const mismatch = firstAccessMismatch(routes, keysByRole, (keys, permission, role) =>
      hasCompatiblePermission(keys, permission, role)
    );
    if (mismatch) {
      blocked = true;
      lines.push(`MISMATCH tenant=${tenant} ${mismatch}`);
    } else {
      lines.push(`PARITY tenant=${tenant}`);
    }
  }
  if (blocked) return { lines, applied: false };

  const permissions = await prisma.permission.findMany();
  const permissionId = new Map(permissions.map((permission) => [permission.key, permission.id]));
  for (const key of Object.keys(ACCESS_STUDIO_ROUTE_GRANTS)) {
    if (permissionId.has(key)) continue;
    lines.push(`CREATE permission ${key}`);
    if (!options.dryRun) {
      const created = await prisma.permission.create({ data: { key, description: key } });
      permissionId.set(key, created.id);
    }
  }
  for (const role of roles) {
    const wanted = new Set(keysAfterGrants(role));
    const held = new Set(role.permissionLinks.map((link) => link.permission.key));
    for (const key of wanted) {
      if (held.has(key) || !key.startsWith("access.")) continue;
      const id = permissionId.get(key);
      lines.push(`GRANT tenant=${role.tenantId ?? "global"} role=${role.name} ${key}`);
      if (!options.dryRun && id) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: id } });
      }
    }
  }
  lines.push(`SEED version ${ACCESS_STUDIO_SEED_VERSION}`);
  if (!options.dryRun) {
    await prisma.appSetting.upsert({
      where: { scope_scopeId_key: { scope: "GLOBAL", scopeId: "GLOBAL", key: "accessStudioSeedVersion" } },
      update: { value: String(ACCESS_STUDIO_SEED_VERSION) },
      create: {
        scope: "GLOBAL",
        scopeId: "GLOBAL",
        key: "accessStudioSeedVersion",
        value: String(ACCESS_STUDIO_SEED_VERSION)
      }
    });
  }
  return { lines, applied: !options.dryRun };
}

export type { PrismaClient };
