export type AdminUserAccessRow = {
  id: string;
  displayName: string;
  email: string;
  roleName: string;
  tenantId: string | null;
  tenantName: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ADMIN_USER_ACCESS_TABLE_FIELDS = [
  "displayName",
  "email",
  "roleName",
  "tenantName",
  "tenantId",
  "isActive",
  "lastLogin",
  "createdAt",
  "updatedAt"
] as const;

export const ADMIN_USER_ACCESS_SENSITIVE_FIELDS = [
  "passwordHash",
  "password",
  "refreshToken",
  "resetToken",
  "sessionToken",
  "failedLoginAttempts",
  "lockedUntil"
] as const;

export function adminUserAccessTableUsesSensitiveFields(): boolean {
  return ADMIN_USER_ACCESS_TABLE_FIELDS.some((field) =>
    (ADMIN_USER_ACCESS_SENSITIVE_FIELDS as readonly string[]).includes(field)
  );
}

export function formatAdminUserStatus(isActive: boolean): string {
  return isActive ? "Active" : "Inactive";
}

export type AdminUserStatusActionContext = {
  viewerUserId: string | null;
  viewerRoleName: string | null;
};

export function canShowAdminUserStatusAction(
  row: AdminUserAccessRow,
  context: AdminUserStatusActionContext
): boolean {
  if (!context.viewerUserId || !context.viewerRoleName) {
    return false;
  }

  if (row.id === context.viewerUserId) {
    return false;
  }

  if (context.viewerRoleName !== "SUPER_ADMIN" && row.roleName === "SUPER_ADMIN") {
    return false;
  }

  return true;
}

export function getAdminUserStatusActionLabel(isActive: boolean): string {
  return isActive ? "Deactivate" : "Reactivate";
}
