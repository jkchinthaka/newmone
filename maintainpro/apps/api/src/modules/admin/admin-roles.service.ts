import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditAction, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { PERMISSION_CATALOG } from "../../database/permission-catalog";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type PermissionCatalogSyncResult = {
  existingCount: number;
  createdCount: number;
  createdKeys: string[];
};

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

export const ADMIN_ROLES_PERMISSIONS_MATRIX_FIELDS = [
  "scope",
  "permissions",
  "permissionGroups",
  "roles",
  "coverage"
] as const;

export const ADMIN_ROLES_PERMISSIONS_SENSITIVE_FIELDS = [
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

const BUILT_IN_ROLE_NAMES = new Set<string>(Object.values(RoleName));

@Injectable()
export class AdminRolesService {
  constructor(private readonly prisma: PrismaService) {}

  private currentTenantScope(): { tenantId: string | null; isSuperAdmin: boolean } {
    const ctx = requestContext.get();
    const tenantId = ctx?.tenantId ?? null;
    const isSuperAdmin = ctx?.actorRole === RoleName.SUPER_ADMIN;
    return { tenantId, isSuperAdmin };
  }

  async findRolesPermissionsMatrixForReview(): Promise<AdminRolesPermissionsMatrix> {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();

    if (!isSuperAdmin && !tenantId) {
      throw new BadRequestException("Tenant context is required");
    }

    const permissions = await this.prisma.permission.findMany({
      select: {
        id: true,
        key: true,
        description: true
      },
      orderBy: { key: "asc" }
    });

    const roles = await this.prisma.role.findMany({
      where: !isSuperAdmin && tenantId ? { tenantId } : {},
      select: {
        id: true,
        name: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true
          }
        },
        permissions: {
          select: {
            key: true
          }
        }
      },
      orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }],
      take: isSuperAdmin ? 200 : 50
    });

    const permissionRows = permissions.map((permission) => this.toPermissionReviewRow(permission));
    const roleRows = roles.map((role) => this.toRoleReviewRow(role, isSuperAdmin));
    const coverage = this.buildCoverage(roleRows);

    return {
      scope: isSuperAdmin ? "cross-tenant" : "tenant",
      permissions: permissionRows,
      permissionGroups: this.groupPermissions(permissionRows),
      roles: roleRows,
      coverage
    };
  }

  private toPermissionReviewRow(permission: {
    id: string;
    key: string;
    description: string | null;
  }): AdminPermissionReviewRow {
    return {
      id: permission.id,
      key: permission.key,
      module: this.permissionModule(permission.key),
      description: permission.description
    };
  }

  private toRoleReviewRow(
    role: {
      id: string;
      name: RoleName;
      tenantId: string | null;
      tenant: { id: string; name: string } | null;
      permissions: Array<{ key: string }>;
    },
    isSuperAdmin: boolean
  ): AdminRoleReviewRow {
    const permissionKeys = role.permissions.map((permission) => permission.key).sort();

    return {
      id: role.id,
      name: role.name,
      tenantId: isSuperAdmin ? role.tenantId : role.tenantId,
      tenantName: isSuperAdmin ? role.tenant?.name ?? null : role.tenant?.name ?? null,
      permissionKeys,
      permissionCount: permissionKeys.length,
      isBuiltIn: BUILT_IN_ROLE_NAMES.has(role.name)
    };
  }

  private buildCoverage(roles: AdminRoleReviewRow[]): Record<string, string[]> {
    const coverage: Record<string, string[]> = {};

    for (const role of roles) {
      for (const permissionKey of role.permissionKeys) {
        if (!coverage[permissionKey]) {
          coverage[permissionKey] = [];
        }
        coverage[permissionKey].push(role.id);
      }
    }

    for (const permissionKey of Object.keys(coverage)) {
      coverage[permissionKey].sort();
    }

    return coverage;
  }

  private groupPermissions(permissions: AdminPermissionReviewRow[]): AdminPermissionGroup[] {
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

  private permissionModule(key: string): string {
    const [module = "general"] = key.split(".");
    return module;
  }

  /**
   * SUPER_ADMIN-only, idempotent catalog sync: upserts any Permission rows
   * that exist in the canonical source catalog (PERMISSION_CATALOG — the
   * same list `db:seed` uses) but are missing from this database, without
   * running the full production seed. Never deletes, never renames a key,
   * and never touches any Role.permissionIds — a sync only makes new
   * permission keys *available* to be granted; granting them to a role is
   * a separate, explicit action.
   */
  async syncPermissionCatalog(actor: Actor): Promise<PermissionCatalogSyncResult> {
    const existing = await this.prisma.permission.findMany({
      where: { key: { in: PERMISSION_CATALOG } },
      select: { key: true }
    });
    const existingKeys = new Set(existing.map((p) => p.key));
    const missingKeys = PERMISSION_CATALOG.filter((key) => !existingKeys.has(key));

    for (const key of missingKeys) {
      // upsert (not create) so a concurrent sync can never race into a duplicate-key error.
      await this.prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key }
      });
    }

    await writeAuditTrail(this.prisma, {
      entity: "Permission",
      entityId: "catalog",
      action: AuditAction.CREATE,
      module: "admin-roles",
      actor,
      reason: "Permission catalog synced via Admin Console",
      metadata: { event: "PERMISSION_CATALOG_SYNCED", createdCount: missingKeys.length, createdKeys: missingKeys }
    });

    return {
      existingCount: existingKeys.size,
      createdCount: missingKeys.length,
      createdKeys: missingKeys
    };
  }
}
