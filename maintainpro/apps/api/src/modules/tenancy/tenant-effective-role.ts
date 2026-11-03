import { RoleName, TenantMembershipRole } from "@prisma/client";

import { rolePermissionKeys } from "../../common/utils/role-permissions.util";

/**
 * The active tenant is per session (token claim / X-Tenant-Id), and User.role is the
 * role in the user's HOME tenant (User.tenantId). In any other tenant the caller acts
 * with the role granted by their TenantMembership there — never their global role.
 * SUPER_ADMIN keeps platform-wide access everywhere.
 */
export type TenantEffectiveRole = {
  roleName: string;
  tenantId: string | null;
  /** True when the global User.role applies (home tenant or SUPER_ADMIN). */
  usesGlobalRole: boolean;
};

export function roleNameForMembership(membershipRole: TenantMembershipRole | string | null | undefined): RoleName {
  switch (membershipRole) {
    case TenantMembershipRole.OWNER:
    case TenantMembershipRole.ADMIN:
      return RoleName.ADMIN;
    case TenantMembershipRole.BILLING:
      return RoleName.MANAGER;
    case TenantMembershipRole.MEMBER:
      return RoleName.TECHNICIAN;
    default:
      // Unknown / blank membership role: least privilege.
      return RoleName.VIEWER;
  }
}

export function effectiveRoleForTenant(input: {
  globalRole: string;
  homeTenantId: string | null | undefined;
  activeTenantId: string | null | undefined;
  membershipRole: TenantMembershipRole | string | null | undefined;
}): TenantEffectiveRole {
  const activeTenantId = input.activeTenantId ?? null;
  if (
    input.globalRole === RoleName.SUPER_ADMIN ||
    !activeTenantId ||
    activeTenantId === (input.homeTenantId ?? null)
  ) {
    return { roleName: input.globalRole, tenantId: activeTenantId, usesGlobalRole: true };
  }
  return {
    roleName: roleNameForMembership(input.membershipRole),
    tenantId: activeTenantId,
    usesGlobalRole: false
  };
}

type RoleReader = {
  role?: {
    findFirst: (args: any) => Promise<any>;
  };
};

/** Permission keys of the named role in a tenant (tenant-specific row first, then the global row). */
export async function loadRolePermissionKeysForTenant(
  prisma: RoleReader,
  roleName: string,
  tenantId: string | null
): Promise<string[]> {
  if (!prisma.role?.findFirst) {
    return [];
  }
  const include = { permissionLinks: { select: { permission: { select: { key: true } } } } };
  const role =
    (tenantId ? await prisma.role.findFirst({ where: { name: roleName, tenantId }, include }) : null) ??
    (await prisma.role.findFirst({ where: { name: roleName, tenantId: null }, include }));
  return rolePermissionKeys(role);
}

/** Request key under which TenantContextGuard stores the resolved role for later guards. */
export const TENANT_EFFECTIVE_ROLE_KEY = "tenantEffectiveRole" as const;

export type RequestWithTenantRole = {
  [TENANT_EFFECTIVE_ROLE_KEY]?: TenantEffectiveRole;
};
