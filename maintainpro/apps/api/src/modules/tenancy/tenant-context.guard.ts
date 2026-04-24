import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleName } from "@prisma/client";

import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../database/prisma.service";

type TenantAwareRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    sub: string;
    role: RoleName | string;
    tenantId?: string | null;
  };
  tenantContext?: {
    requestedTenantId: string | null;
  };
  tenantId?: string | null;
};

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantAwareRequest>();

    if (!request.user?.sub) {
      return true;
    }

    const headerValue = request.headers["x-tenant-id"];
    const headerTenantId =
      typeof headerValue === "string"
        ? headerValue.trim() || null
        : Array.isArray(headerValue) && headerValue.length > 0
          ? headerValue[0].trim() || null
          : null;

    let tenantId = request.tenantContext?.requestedTenantId ?? headerTenantId ?? request.user.tenantId ?? null;

    if (!tenantId) {
      const firstMembership = await this.prisma.tenantMembership.findFirst({
        where: {
          userId: request.user.sub,
          tenant: {
            isActive: true
          }
        },
        select: {
          tenantId: true
        },
        orderBy: {
          joinedAt: "asc"
        }
      });

      tenantId = firstMembership?.tenantId ?? null;
    }

    if (!tenantId) {
      request.user.tenantId = null;
      request.tenantId = null;
      return true;
    }

    if (request.user.role !== RoleName.SUPER_ADMIN) {
      const membership = await this.prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: request.user.sub
          }
        },
        select: {
          tenantId: true
        }
      });

      if (!membership) {
        throw new ForbiddenException("Tenant access denied");
      }
    } else {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, isActive: true }
      });

      if (!tenant?.isActive) {
        throw new ForbiddenException("Requested tenant is inactive or missing");
      }
    }

    request.user.tenantId = tenantId;
    request.tenantId = tenantId;

    return true;
  }
}
