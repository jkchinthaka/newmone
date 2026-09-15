type RolePermissionSource = {
  permissionLinks?: Array<{ permission?: { key?: string | null } }>;
  permissions?: Array<{ key?: string | null }>;
};

/** Resolve permission keys from junction rows or legacy inline permission arrays. */
export function rolePermissionKeys(role: RolePermissionSource | null | undefined): string[] {
  if (!role) return [];

  if (Array.isArray(role.permissionLinks)) {
    const keys = role.permissionLinks
      .map((link) => link.permission?.key)
      .filter((key): key is string => typeof key === "string" && key.trim().length > 0);
    if (keys.length > 0) {
      return keys;
    }
  }

  if (Array.isArray(role.permissions)) {
    return role.permissions
      .map((permission) => permission.key)
      .filter((key): key is string => typeof key === "string" && key.trim().length > 0);
  }

  return [];
}
