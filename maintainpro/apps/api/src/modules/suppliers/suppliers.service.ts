import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "tenantId" | "role">;

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

  create(data: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    taxNumber?: string;
    notes?: string;
    tenantId?: string;
  }, actor?: Actor) {
    const tenantScope = this.scopeByTenant(actor);
    const tenantId = tenantScope.tenantId ?? data.tenantId ?? null;

    return this.prisma.supplier.create({
      data: {
        ...data,
        tenantId
      }
    });
  }

  async update(
    id: string,
    data: Partial<{ name: string; contactName: string; email: string; phone: string; address: string; website: string; taxNumber: string; notes: string; isActive: boolean }>,
    actor?: Actor
  ) {
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

    return this.prisma.supplier.update({ where: { id }, data });
  }
}
