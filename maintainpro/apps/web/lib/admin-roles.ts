export type AdminPermissionReviewRow = {
  id: string;
  key: string;
  module: string;
  description: string | null;
};

export type AdminRoleReviewRow = {
  id: string;
  name: string;
  tenantId: string | null;
  tenantName: string | null;
  permissionKeys: string[];
  permissionCount: number;
  isBuiltIn: boolean;
};

export type AdminPermissionGroup = {
  module: string;
  permissions: AdminPermissionReviewRow[];
};

export type AdminRolesPermissionsMatrix = {
  scope: "tenant" | "cross-tenant";
  permissions: AdminPermissionReviewRow[];
  permissionGroups: AdminPermissionGroup[];
  roles: AdminRoleReviewRow[];
  coverage: Record<string, string[]>;
};

export const ADMIN_ROLES_MATRIX_SENSITIVE_FIELDS = [
  "passwordHash",
  "password",
  "refreshToken",
  "resetToken",
  "sessionToken",
  "assignedUsers",
  "roleIds",
  "permissionIds",
  "secret",
  "token",
  "session",
  "email",
  "tenantSecret"
] as const;

export function formatRoleLabel(roleName: string): string {
  return roleName.replace(/_/g, " ");
}

export function formatPermissionModuleLabel(module: string): string {
  return module
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function roleHasPermission(
  matrix: AdminRolesPermissionsMatrix,
  permissionKey: string,
  roleId: string
): boolean {
  return (matrix.coverage[permissionKey] ?? []).includes(roleId);
}

export function adminRolesMatrixAllowsMutations(): boolean {
  return false;
}

export function filterRolesPermissionsMatrix(
  matrix: AdminRolesPermissionsMatrix,
  query: string
): AdminRolesPermissionsMatrix {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return matrix;
  }

  const roles = matrix.roles.filter((role) =>
    [role.name, role.tenantName ?? "", role.tenantId ?? "", ...role.permissionKeys]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
  const roleIds = new Set(roles.map((role) => role.id));

  const permissions = matrix.permissions.filter((permission) =>
    [permission.key, permission.module, permission.description ?? ""].join(" ").toLowerCase().includes(needle)
  );

  const visiblePermissions =
    permissions.length > 0
      ? permissions
      : matrix.permissions.filter((permission) =>
          roles.some((role) => role.permissionKeys.includes(permission.key))
        );

  const permissionKeys = new Set(visiblePermissions.map((permission) => permission.key));
  const coverage = Object.fromEntries(
    Object.entries(matrix.coverage)
      .filter(([key]) => permissionKeys.has(key))
      .map(([key, ids]) => [key, ids.filter((id) => roleIds.has(id))])
  );

  const permissionGroups = groupPermissionRows(visiblePermissions);

  return {
    scope: matrix.scope,
    permissions: visiblePermissions,
    permissionGroups,
    roles,
    coverage
  };
}

function groupPermissionRows(permissions: AdminPermissionReviewRow[]): AdminPermissionGroup[] {
  const groups = new Map<string, AdminPermissionReviewRow[]>();

  for (const permission of permissions) {
    const existing = groups.get(permission.module) ?? [];
    existing.push(permission);
    groups.set(permission.module, existing);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([module, modulePermissions]) => ({
      module,
      permissions: modulePermissions
    }));
}
