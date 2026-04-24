import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { RoleName, TenantMembershipRole } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type TenantSummary = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  membershipRole: TenantMembershipRole;
  isActive: boolean;
};

@Injectable()
export class TenancyService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  private async signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "dev-access-secret",
      expiresIn: this.configService.get<string>("JWT_ACCESS_EXPIRES", "15m")
    });
  }

  private async ensureMembershipFromLegacyTenant(userId: string, tenantId?: string | null) {
    if (!tenantId) {
      return;
    }

    await this.prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId,
          userId
        }
      },
      update: {},
      create: {
        tenantId,
        userId,
        membershipRole: TenantMembershipRole.OWNER
      }
    });
  }

  async getMyTenants(userId: string, preferredTenantId?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.ensureMembershipFromLegacyTenant(user.id, user.tenantId);

    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        userId: user.id,
        tenant: {
          isActive: true
        }
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true
          }
        }
      },
      orderBy: {
        joinedAt: "asc"
      }
    });

    const tenantSummaries: TenantSummary[] = memberships.map((membership) => ({
      tenantId: membership.tenant.id,
      tenantName: membership.tenant.name,
      tenantSlug: membership.tenant.slug,
      membershipRole: membership.membershipRole,
      isActive: membership.tenant.isActive
    }));

    if (user.role.name === RoleName.SUPER_ADMIN) {
      const allTenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true
        },
        orderBy: { name: "asc" }
      });

      for (const tenant of allTenants) {
        if (!tenantSummaries.some((entry) => entry.tenantId === tenant.id)) {
          tenantSummaries.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            membershipRole: TenantMembershipRole.OWNER,
            isActive: tenant.isActive
          });
        }
      }
    }

    tenantSummaries.sort((left, right) => left.tenantName.localeCompare(right.tenantName));

    let activeTenantId = preferredTenantId ?? user.tenantId ?? tenantSummaries[0]?.tenantId ?? null;

    if (
      activeTenantId &&
      user.role.name !== RoleName.SUPER_ADMIN &&
      !tenantSummaries.some((entry) => entry.tenantId === activeTenantId)
    ) {
      activeTenantId = tenantSummaries[0]?.tenantId ?? null;
    }

    if (activeTenantId && user.tenantId !== activeTenantId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { tenantId: activeTenantId }
      });
    }

    const activeTenant = activeTenantId
      ? await this.prisma.tenant.findUnique({
          where: { id: activeTenantId },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true
          }
        })
      : null;

    return {
      activeTenant,
      memberships: tenantSummaries
    };
  }

  async ensureTenantAccess(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true
      }
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException("Tenant not found or inactive");
    }

    if (user.role.name === RoleName.SUPER_ADMIN) {
      return {
        user,
        tenant,
        membershipRole: TenantMembershipRole.OWNER
      };
    }

    await this.ensureMembershipFromLegacyTenant(user.id, user.tenantId);

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.id
        }
      }
    });

    if (!membership) {
      throw new ForbiddenException("You do not have access to this tenant");
    }

    return {
      user,
      tenant,
      membershipRole: membership.membershipRole
    };
  }

  async switchTenant(userId: string, tenantId: string) {
    const access = await this.ensureTenantAccess(userId, tenantId);

    await this.prisma.user.update({
      where: { id: access.user.id },
      data: { tenantId: access.tenant.id }
    });

    const accessToken = await this.signAccessToken({
      sub: access.user.id,
      email: access.user.email,
      role: access.user.role.name,
      tenantId: access.tenant.id
    });

    return {
      accessToken,
      tenant: access.tenant
    };
  }
}
