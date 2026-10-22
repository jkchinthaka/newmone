export type PermissionOverrideEffect = "GRANT" | "DENY";

export type PermissionOverrideRow = {
  permissionKey: string;
  effect: string;
};

type OverrideReader = {
  userPermissionOverride?: {
    findMany: (args: {
      where: { tenantId: string; userId: string };
      select: { permissionKey: true; effect: true };
    }) => Promise<PermissionOverrideRow[]>;
  };
};

/** True only when the studio flag is explicitly on. Unset stays off. */
export function accessStudioEnabled(): boolean {
  return process.env.ACCESS_STUDIO_ENABLED === "true";
}

/**
 * Role keys, plus GRANT, minus DENY. DENY wins when both exist.
 * Callers must not pass override rows when the flag is off.
 */
export function resolveEffectivePermissions(
  roleKeys: readonly string[],
  overrides: readonly PermissionOverrideRow[]
): string[] {
  const effective = new Set(roleKeys.filter((key) => key.trim().length > 0));

  for (const row of overrides) {
    if (row.effect === "GRANT" && row.permissionKey.trim().length > 0) {
      effective.add(row.permissionKey);
    }
  }

  for (const row of overrides) {
    if (row.effect === "DENY") {
      effective.delete(row.permissionKey);
    }
  }

  return [...effective];
}

/**
 * Flag off returns the role keys and does not read UserPermissionOverride.
 */
export async function loadEffectivePermissionKeys(
  prisma: OverrideReader,
  user: { id: string; tenantId: string | null },
  roleKeys: readonly string[]
): Promise<string[]> {
  if (!accessStudioEnabled()) {
    return [...roleKeys];
  }

  if (!user.tenantId || !prisma.userPermissionOverride?.findMany) {
    return [...roleKeys];
  }

  const rows = await prisma.userPermissionOverride.findMany({
    where: { tenantId: user.tenantId, userId: user.id },
    select: { permissionKey: true, effect: true }
  });

  return resolveEffectivePermissions(roleKeys, rows);
}
