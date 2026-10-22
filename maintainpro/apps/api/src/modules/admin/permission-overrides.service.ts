import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";

import { accessStudioEnabled } from "../../common/auth/effective-permissions";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

const EFFECTS = new Set(["GRANT", "DENY"]);

export type PermissionOverrideInput = {
  permissionKey?: string;
  effect?: string;
  reason?: string;
  expiresAt?: string | null;
};

@Injectable()
export class PermissionOverridesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(actor: JwtPayload, userId: string) {
    this.assertEnabled();
    const target = await this.requireSameTenantUser(actor, userId);
    this.assertNotSuperAdminTarget(target.roleName);
    const rows = await this.prisma.userPermissionOverride.findMany({
      where: { tenantId: target.tenantId, userId: target.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        permissionKey: true,
        effect: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
        createdById: true
      }
    });

    return { data: rows, message: "Permission overrides loaded" };
  }

  async create(actor: JwtPayload, userId: string, input: PermissionOverrideInput) {
    this.assertEnabled();
    this.assertNotSelf(actor, userId);

    const permissionKey = input.permissionKey?.trim() ?? "";
    const effect = input.effect?.trim() ?? "";
    const reason = input.reason?.trim() ?? "";
    const expiresAt = this.parseExpiresAt(input.expiresAt);

    if (!permissionKey) {
      throw new BadRequestException("permissionKey is required");
    }
    if (!EFFECTS.has(effect)) {
      throw new BadRequestException("effect must be GRANT or DENY");
    }
    if (!reason) {
      throw new BadRequestException("A reason is required");
    }

    const catalogue = await this.prisma.permission.findUnique({
      where: { key: permissionKey },
      select: { key: true }
    });
    if (!catalogue) {
      throw new BadRequestException("Unknown permission");
    }

    const target = await this.requireSameTenantUser(actor, userId);
    this.assertNotSuperAdminTarget(target.roleName);
    const existing = await this.prisma.userPermissionOverride.findUnique({
      where: {
        tenantId_userId_permissionKey: {
          tenantId: target.tenantId,
          userId: target.id,
          permissionKey
        }
      },
      select: { id: true }
    });
    if (existing) {
      throw new ConflictException("An override already exists for this permission");
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.userPermissionOverride.create({
          data: {
            tenantId: target.tenantId,
            userId: target.id,
            permissionKey,
            effect,
            reason,
            expiresAt,
            createdById: actor.sub
          }
        });

        await writeAuditTrail(tx as unknown as PrismaService, {
          entity: "UserPermissionOverride",
          entityId: created.id,
          action: AuditAction.CREATE,
          module: "admin",
          actor,
          reason,
          tenantId: target.tenantId,
          afterData: { userId: target.id, permissionKey, effect, expiresAt }
        });
        await this.bumpAccessConfigVersion(tx as unknown as PrismaService, target.tenantId);

        return created;
      });

      return { data: row, message: "Permission override saved" };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("An override already exists for this permission");
      }
      throw error;
    }
  }

  async remove(actor: JwtPayload, userId: string, permissionKey: string, reason: string) {
    this.assertEnabled();
    this.assertNotSelf(actor, userId);

    const key = permissionKey.trim();
    const auditReason = reason.trim();
    if (!key) {
      throw new BadRequestException("permissionKey is required");
    }
    if (!auditReason) {
      throw new BadRequestException("A reason is required");
    }

    const target = await this.requireSameTenantUser(actor, userId);
    this.assertNotSuperAdminTarget(target.roleName);
    const row = await this.prisma.userPermissionOverride.findUnique({
      where: {
        tenantId_userId_permissionKey: {
          tenantId: target.tenantId,
          userId: target.id,
          permissionKey: key
        }
      }
    });
    if (!row) {
      throw new NotFoundException("Permission override not found");
    }
    if (auditReason === (row.reason ?? "").trim()) {
      throw new BadRequestException("Enter a new removal reason");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermissionOverride.delete({ where: { id: row.id } });
      await writeAuditTrail(tx as unknown as PrismaService, {
        entity: "UserPermissionOverride",
        entityId: row.id,
        action: AuditAction.DELETE,
        module: "admin",
        actor,
        reason: auditReason,
        tenantId: target.tenantId,
        beforeData: { userId: target.id, permissionKey: row.permissionKey, effect: row.effect }
      });
      await this.bumpAccessConfigVersion(tx as unknown as PrismaService, target.tenantId);
    });

    return { data: { id: row.id }, message: "Permission override removed" };
  }

  private assertEnabled() {
    if (!accessStudioEnabled()) {
      throw new NotFoundException();
    }
  }

  private assertNotSelf(actor: JwtPayload, userId: string) {
    if (actor.sub === userId) {
      throw new ForbiddenException("You cannot edit your own permission overrides");
    }
  }

  private async requireSameTenantUser(actor: JwtPayload, userId: string) {
    if (!actor.tenantId) {
      throw new BadRequestException("Active tenant is required");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: actor.tenantId },
      select: { id: true, tenantId: true, role: { select: { name: true } } }
    });

    if (!user?.tenantId) {
      throw new NotFoundException("User not found");
    }

    return { id: user.id, tenantId: user.tenantId, roleName: user.role?.name ?? "" };
  }

  private assertNotSuperAdminTarget(roleName: string) {
    if (roleName === "SUPER_ADMIN") {
      throw new BadRequestException("Change the role instead");
    }
  }

  private parseExpiresAt(value: string | null | undefined): Date | null {
    if (value == null || value.trim() === "") return null;
    const parsed = new Date(value.length === 10 ? `${value}T23:59:59.999Z` : value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("expiresAt must be a date");
    }
    if (parsed.getTime() <= Date.now()) {
      throw new BadRequestException("expiresAt must be in the future");
    }
    return parsed;
  }

  private async bumpAccessConfigVersion(tx: PrismaService, tenantId: string) {
    if (!tx.tenant?.update) return;
    await tx.tenant.update({
      where: { id: tenantId },
      data: { accessConfigVersion: { increment: 1 } }
    });
  }
}
