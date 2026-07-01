import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

const VENDOR_MANAGE_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER
]);

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  private scopeByTenant(actor?: Actor): { tenantId?: string | null } {
    if (!actor) {
      return {};
    }

    if (actor.role === "SUPER_ADMIN" && actor.tenantId === undefined) {
      return {};
    }

    return { tenantId: actor.tenantId ?? null };
  }

  private assertCanManage(actor?: Actor) {
    if (!actor || !VENDOR_MANAGE_ROLES.has(actor.role as RoleName)) {
      throw new ForbiddenException("Only Admin, Manager, or Operations can manage vendors.");
    }
  }

  findAll(actor?: Actor) {
    return this.prisma.supplier.findMany({
      where: {
        ...this.scopeByTenant(actor)
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string, actor?: Actor) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        ...this.scopeByTenant(actor)
      }
    });

    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    return supplier;
  }

  async create(
    data: {
      name: string;
      vendorCode?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      website?: string;
      taxNumber?: string;
      serviceCategories?: string[];
      notes?: string;
      tenantId?: string;
    },
    actor?: Actor
  ) {
    this.assertCanManage(actor);
    const tenantScope = this.scopeByTenant(actor);
    const tenantId = tenantScope.tenantId ?? data.tenantId ?? null;

    const supplier = await this.prisma.supplier.create({
      data: {
        name: data.name,
        vendorCode: data.vendorCode?.trim() || null,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        website: data.website,
        taxNumber: data.taxNumber,
        serviceCategories: data.serviceCategories ?? [],
        notes: data.notes,
        tenantId,
        createdById: actor?.sub ?? null
      }
    });

    await this.recordAudit(actor, "vendor_created", supplier.id, { vendorName: supplier.name });
    return supplier;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      vendorCode: string;
      contactName: string;
      email: string;
      phone: string;
      address: string;
      website: string;
      taxNumber: string;
      serviceCategories: string[];
      notes: string;
      isActive: boolean;
      performanceScore: number;
    }>,
    actor?: Actor
  ) {
    this.assertCanManage(actor);
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        ...this.scopeByTenant(actor)
      },
      select: { id: true }
    });

    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    const updated = await this.prisma.supplier.update({ where: { id }, data });
    await this.recordAudit(actor, "vendor_updated", id, data);
    return updated;
  }

  async setBlacklist(id: string, blacklisted: boolean, reason: string | undefined, actor?: Actor) {
    this.assertCanManage(actor);
    if (blacklisted && !reason?.trim()) {
      throw new BadRequestException("Blacklist reason is required.");
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id, ...this.scopeByTenant(actor) },
      select: { id: true }
    });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        blacklisted,
        blacklistReason: blacklisted ? reason?.trim() ?? null : null
      }
    });

    await this.recordAudit(actor, blacklisted ? "vendor_blacklisted" : "vendor_unblacklisted", id, {
      reason: reason ?? null
    });
    return updated;
  }

  private async recordAudit(actor: Actor | undefined, event: string, supplierId: string, metadata: Record<string, unknown>) {
    const ctx = requestContext.get();
    await this.prisma.auditLog.create({
      data: {
        tenantId: actor?.tenantId ?? ctx?.tenantId ?? null,
        actorId: actor?.sub ?? ctx?.actorId ?? null,
        module: "maintenance",
        entity: "Supplier",
        entityId: supplierId,
        action: AuditAction.UPDATE,
        metadata: { event, supplierId, ...metadata }
      }
    });
  }
}
