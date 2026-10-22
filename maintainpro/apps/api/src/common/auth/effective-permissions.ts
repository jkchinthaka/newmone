import { requestContext } from "../context/request-context";

export type PermissionOverrideEffect = "GRANT" | "DENY";

export type PermissionOverrideRow = {
  permissionKey: string;
  effect: string;
  expiresAt?: Date | string | null;
};

type OverrideReader = {
  userPermissionOverride?: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: { permissionKey: true; effect: true; expiresAt: true };
    }) => Promise<PermissionOverrideRow[]>;
  };
  tenant?: {
    findUnique: (args: {
      where: { id: string };
      select: { accessConfigVersion: true };
    }) => Promise<{ accessConfigVersion: number } | null>;
  };
};

type EffectiveAccess = {
  keys: string[];
  denied: Set<string>;
};

type RequestBag = {
  effectiveAccess?: Map<string, EffectiveAccess>;
  accessConfigVersions?: Map<string, number>;
};

/** True only when the studio flag is explicitly on. Unset stays off. */
export function accessStudioEnabled(): boolean {
  return process.env.ACCESS_STUDIO_ENABLED === "true";
}

export function isActiveOverride(row: PermissionOverrideRow, now = new Date()): boolean {
  if (row.expiresAt == null) return true;
  const at = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);
  return !Number.isNaN(at.getTime()) && at.getTime() > now.getTime();
}

/**
 * Role keys, plus GRANT, minus DENY. DENY wins when both exist.
 * Expired rows are ignored. Callers must not pass override rows when the flag is off.
 */
export function resolveEffectivePermissions(
  roleKeys: readonly string[],
  overrides: readonly PermissionOverrideRow[],
  now = new Date()
): string[] {
  const effective = new Set(roleKeys.filter((key) => key.trim().length > 0));
  const active = overrides.filter((row) => isActiveOverride(row, now));

  for (const row of active) {
    if (row.effect === "GRANT" && row.permissionKey.trim().length > 0) {
      effective.add(row.permissionKey);
    }
  }

  for (const row of active) {
    if (row.effect === "DENY") {
      effective.delete(row.permissionKey);
    }
  }

  return [...effective];
}

export function deniedPermissionKeys(
  overrides: readonly PermissionOverrideRow[],
  now = new Date()
): Set<string> {
  return new Set(
    overrides
      .filter((row) => isActiveOverride(row, now) && row.effect === "DENY" && row.permissionKey.trim().length > 0)
      .map((row) => row.permissionKey)
  );
}

function requestBag(): RequestBag | null {
  const ctx = requestContext.get();
  return ctx ? (ctx as RequestBag) : null;
}

async function tenantAccessVersion(prisma: OverrideReader, tenantId: string): Promise<number> {
  const bag = requestBag();
  const versions = bag ? (bag.accessConfigVersions ??= new Map()) : null;
  const cached = versions?.get(tenantId);
  if (cached !== undefined) return cached;

  const row = await prisma.tenant?.findUnique?.({
    where: { id: tenantId },
    select: { accessConfigVersion: true }
  });
  const version = row?.accessConfigVersion ?? 0;
  versions?.set(tenantId, version);
  return version;
}

/**
 * Flag off returns the role keys and does not read UserPermissionOverride or Tenant.
 * Flag on caches the result for the current request and accessConfigVersion.
 */
export async function loadEffectiveAccess(
  prisma: OverrideReader,
  user: { id: string; tenantId: string | null },
  roleKeys: readonly string[]
): Promise<EffectiveAccess> {
  if (!accessStudioEnabled() || !user.tenantId || !prisma.userPermissionOverride?.findMany) {
    return { keys: [...roleKeys], denied: new Set() };
  }

  const version = await tenantAccessVersion(prisma, user.tenantId);
  const cacheKey = `${user.tenantId}:${user.id}:${version}`;
  const bag = requestBag();
  const cache = bag ? (bag.effectiveAccess ??= new Map()) : null;
  const hit = cache?.get(cacheKey);
  if (hit) return hit;

  const now = new Date();
  const rows = await prisma.userPermissionOverride.findMany({
    where: {
      tenantId: user.tenantId,
      userId: user.id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    select: { permissionKey: true, effect: true, expiresAt: true }
  });
  const access = {
    keys: resolveEffectivePermissions(roleKeys, rows, now),
    denied: deniedPermissionKeys(rows, now)
  };
  cache?.set(cacheKey, access);
  return access;
}

export async function loadEffectivePermissionKeys(
  prisma: OverrideReader,
  user: { id: string; tenantId: string | null },
  roleKeys: readonly string[]
): Promise<string[]> {
  return (await loadEffectiveAccess(prisma, user, roleKeys)).keys;
}

/** Flag off returns 0 and does not read Tenant. */
export async function readAccessConfigVersion(
  prisma: OverrideReader,
  tenantId: string | null
): Promise<number> {
  if (!accessStudioEnabled() || !tenantId) return 0;
  return tenantAccessVersion(prisma, tenantId);
}
