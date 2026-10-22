import inventory from "../database/access-route-inventory.json";
import { setAccessStudioRuntimeAllowed } from "../common/auth/effective-permissions";
import {
  ACCESS_STUDIO_SEED_VERSION,
  firstAccessMismatch,
  type AccessRoute
} from "../common/auth/access-studio-parity";
import { hasCompatiblePermission } from "../common/guards/permissions.guard";

type StartupReader = {
  appSetting: { findUnique: (args: unknown) => Promise<{ value: string } | null> };
  role: { findMany: (args: unknown) => Promise<Array<{
    name: string;
    tenantId: string | null;
    permissionLinks: Array<{ permission: { key: string } }>;
  }>> };
};

/** Env true is not enough. A failed check leaves the studio off and logs once. */
export async function applyAccessStudioStartup(prisma: StartupReader): Promise<void> {
  if (process.env.ACCESS_STUDIO_ENABLED !== "true") {
    if (process.env.NODE_ENV !== "test") setAccessStudioRuntimeAllowed(false);
    return;
  }
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { scope_scopeId_key: { scope: "GLOBAL", scopeId: "GLOBAL", key: "accessStudioSeedVersion" } }
    });
    const version = Number(setting?.value ?? "0");
    if (!Number.isFinite(version) || version < ACCESS_STUDIO_SEED_VERSION) {
      throw new Error(`seed version ${version} is below ${ACCESS_STUDIO_SEED_VERSION}`);
    }
    const roles = await prisma.role.findMany({
      select: {
        name: true,
        tenantId: true,
        permissionLinks: { select: { permission: { select: { key: true } } } }
      }
    });
    const byTenant = new Map<string, Map<string, string[]>>();
    for (const role of roles) {
      const tenant = role.tenantId ?? "global";
      const bucket = byTenant.get(tenant) ?? new Map<string, string[]>();
      bucket.set(
        role.name,
        role.permissionLinks.map((link) => link.permission.key)
      );
      byTenant.set(tenant, bucket);
    }
    const routes = (inventory as { routes: AccessRoute[] }).routes;
    for (const [tenant, keysByRole] of byTenant) {
      const mismatch = firstAccessMismatch(routes, keysByRole, (keys, permission, role) =>
        hasCompatiblePermission(keys, permission, role)
      );
      if (mismatch) throw new Error(`tenant=${tenant} ${mismatch}`);
    }
    setAccessStudioRuntimeAllowed(true);
  } catch (error) {
    setAccessStudioRuntimeAllowed(false);
    const detail = error instanceof Error ? error.message : "parity check failed";
    console.error(`ACCESS_STUDIO_ENABLED was set, but the studio stayed off: ${detail}`);
  }
}
