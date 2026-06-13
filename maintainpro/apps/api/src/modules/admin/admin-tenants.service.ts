import { BadRequestException, Injectable } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";

export type AdminTenantOverviewRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export const ADMIN_TENANT_OVERVIEW_FIELDS = [
  "id",
  "name",
  "slug",
  "isActive",
  "memberCount",
  "createdAt",
  "updatedAt"
] as const;

export const ADMIN_TENANT_SENSITIVE_FIELDS = [
  "databaseUrl",
  "connectionString",
  "apiKey",
  "secret",
  "token",
  "password",
  "passwordHash",
  "refreshToken",
  "resetToken",
  "sessionToken",
  "stripeCustomerId",
  "stripeSecret",
  "smtpPassword",
  "smtpUser",
  "env",
  "environment",
  "subscription",
  "billingSecret",
  "invitationToken"
] as const;

@Injectable()
export class AdminTenantsService {
  constructor(private readonly prisma: PrismaService) {}

  private currentTenantScope(): { tenantId: string | null; isSuperAdmin: boolean } {
    const ctx = requestContext.get();
    const tenantId = ctx?.tenantId ?? null;
    const isSuperAdmin = ctx?.actorRole === RoleName.SUPER_ADMIN;
    return { tenantId, isSuperAdmin };
  }

  async findAllForAdminTenantReview(): Promise<AdminTenantOverviewRow[]> {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();

    if (!isSuperAdmin && !tenantId) {
      throw new BadRequestException("Tenant context is required");
    }

    const tenants = await this.prisma.tenant.findMany({
      where: !isSuperAdmin && tenantId ? { id: tenantId } : {},
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            memberships: true
          }
        }
      },
      orderBy: { name: "asc" },
      take: isSuperAdmin ? 100 : 1
    });

    return tenants.map((tenant) => this.toAdminTenantOverviewRow(tenant));
  }

  private toAdminTenantOverviewRow(tenant: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count: { memberships: number };
  }): AdminTenantOverviewRow {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      isActive: tenant.isActive,
      memberCount: tenant._count.memberships,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString()
    };
  }
}
